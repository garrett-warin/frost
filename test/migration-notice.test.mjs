import test from 'node:test';
import assert from 'node:assert/strict';
import {startMigrationNotice, validateNotice} from '../public/migration-notice.mjs';
const notice = {enabled:true,id:'move-1',title:'Moving',message:'Keep browsing.',detail:'Save work.'};
function fixture({brokenStorage = false} = {}) {
  const elements = [];
  const document = {visibilityState:'visible', addEventListener(){}, body:{append(){}}, createElement(tag) {
    const element = {tag, open:false, handlers:{}, setAttribute(){}, append(){}, remove(){}, showModal(){this.open=true;}, close(){this.open=false;}, addEventListener(name,handler){this.handlers[name]=handler;}};
    elements.push(element); return element;
  }};
  const values = new Map();
  const storage = {getItem(k){if(brokenStorage) throw Error(); return values.get(k);},setItem(k,v){if(brokenStorage) throw Error(); values.set(k,v);}};
  let data = notice;
  const options = {document,storage,fetchNotice:async()=>({ok:true,json:async()=>data}),setTimer(){}};
  return {elements,options,setData(value){data=value;}};
}
const tick = () => new Promise(resolve=>setImmediate(resolve));
test('rejects disabled, oversized and malformed notices',()=>{
  assert.equal(validateNotice(notice),notice);
  for(const value of [null,{}, {...notice,enabled:false},{...notice,id:'../bad'},{...notice,message:'x'.repeat(801)}]) assert.equal(validateNotice(value),null);
});
test('dismissal survives reload; a new notice can be shown',async()=>{
  const f=fixture(); const instance=startMigrationNotice(f.options); await tick();
  assert.equal(f.elements[0].open,true);
  f.elements.find(e=>e.tag==='button').handlers.click();
  await instance.check(); assert.equal(f.elements[0].open,false);
  const count=f.elements.length; startMigrationNotice(f.options); await tick(); assert.equal(f.elements.length,count);
  f.setData({...notice,id:'move-2'}); await instance.check(); assert.equal(f.elements.at(-1).tag,'button'); assert.equal(f.elements[count].open,true);
});
test('blocked storage, Escape, withdrawal and literal text are safe',async()=>{
  const f=fixture({brokenStorage:true}); f.setData({...notice,title:'<img src=x onerror=alert(1)>'});
  const instance=startMigrationNotice(f.options); await tick();
  assert.equal(f.elements.find(e=>e.tag==='h1').textContent,'<img src=x onerror=alert(1)>');
  f.elements[0].handlers.cancel({preventDefault(){}}); await instance.check(); assert.equal(f.elements[0].open,false);
  f.setData({...notice,id:'move-2'}); await instance.check();
  const current=f.elements.findLast(e=>e.tag==='dialog'); assert.equal(current.open,true);
  f.setData({...notice,enabled:false}); await instance.check(); assert.equal(current.open,false);
});
