import pg from 'pg';
export const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,statement_timeout:15000});
export async function initializeDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS frost_records (
    namespace text NOT NULL, id text NOT NULL, version bigint NOT NULL,
    payload jsonb NOT NULL, kind text NOT NULL, sort text COLLATE "C" NOT NULL,
    expires bigint, PRIMARY KEY(namespace,id));
    CREATE INDEX IF NOT EXISTS frost_kind_sort ON frost_records(namespace,kind,sort DESC,id DESC);
    CREATE INDEX IF NOT EXISTS frost_expiry ON frost_records(expires) WHERE expires IS NOT NULL;`);
}
export async function transaction(namespace, callback) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
                                                                                        
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[namespace]);
    const result=await callback(client);
    await client.query('COMMIT'); return result;
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function row(db,namespace,id) {
  return (await db.query('SELECT * FROM frost_records WHERE namespace=$1 AND id=$2',[namespace,id])).rows[0];
}
async function put(db,namespace,id,value,version) {
  const {_v,...payload}=value;
  await db.query(`INSERT INTO frost_records(namespace,id,version,payload,kind,sort,expires) VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(namespace,id) DO UPDATE SET version=EXCLUDED.version,payload=EXCLUDED.payload,kind=EXCLUDED.kind,sort=EXCLUDED.sort,expires=EXCLUDED.expires`,
    [namespace,id,version,payload,payload.kind||'internal',payload.sort||id,payload.expires||null]);
}
export function accountStore(namespace,Conflict) {
  if(!namespace || typeof Conflict!=='function') throw Error('Store configuration required');
  return {
    async get(id) {const value=await row(pool,namespace,id); return value?{...value.payload,_v:Number(value.version)}:null;},
    async list(kind,{cursor,limit=50}={}) {
      let start;
      if(cursor) {
        try {start=JSON.parse(Buffer.from(cursor,'base64url')); if(start.kind?.S!==kind || typeof start.id?.S!=='string' || typeof start.sort?.S!=='string') throw Error();}
        catch {throw Error('Invalid page cursor.');}
      }
      limit=Math.min(100,Math.max(1,Math.trunc(Number(limit)||50)));
      const args=[namespace,kind,limit+1];
      let where='';
      if(start){args.push(start.sort.S,start.id.S);where=' AND (sort,id) < ($4 COLLATE "C",$5)';}
      const rows=(await pool.query(`SELECT * FROM frost_records WHERE namespace=$1 AND kind=$2${where} ORDER BY sort DESC,id DESC LIMIT $3`,args)).rows;
      const more=rows.length>limit, values=rows.slice(0,limit),last=values.at(-1);
      return {items:values.map(r=>({...r.payload,_v:Number(r.version)})),cursor:more?Buffer.from(JSON.stringify({kind:{S:kind},sort:{S:last.sort},id:{S:last.id}})).toString('base64url'):null};
    },
    async commit(ops) {
      if(!ops.length)return;
      if(new Set(ops.map(o=>o.id)).size!==ops.length)throw Error('Duplicate transaction key');
      await transaction(namespace,async db=>{
        for(const op of ops){const current=await row(db,namespace,op.id);if((current?Number(current.version):null)!==op.version)throw new Conflict();}
        for(const op of ops) {
          if(!op.write)continue;
          if(op.value===null)await db.query('DELETE FROM frost_records WHERE namespace=$1 AND id=$2',[namespace,op.id]);
          else await put(db,namespace,op.id,op.value,(op.version||0)+1);
        }
      });
    }
  };
}
export function adminStore(namespace='admin') {
  async function mutate(id,fn) {
    return transaction(namespace,async db=>{
      const current=await row(db,namespace,id),next=fn(current?.payload);
      if(next===false)return false;
      await put(db,namespace,id,next,Number(current?.version||0)+1);return true;
    });
  }
  return {
    async get(id){return (await row(pool,namespace,id))?.payload||null;},
    async put(id,value){await mutate(id,()=>value);},
    async create(id,value){return mutate(id,current=>current?false:value);},
    async remove(id){await transaction(namespace,db=>db.query('DELETE FROM frost_records WHERE namespace=$1 AND id=$2',[namespace,id]));},
    async attempt(minute){return mutate('attempt:'+minute,current=>(current?.attempts||0)>=5?false:{...current,attempts:(current?.attempts||0)+1,expires:minute*60+120});},
    async consume(counter,enroll){return mutate('auth',current=>current?.lastCounter!==undefined&&current.lastCounter>=counter?false:{...current,lastCounter:counter,...(enroll?{enrolled:true}:{})});}
  };
}
