import test from 'node:test';
import assert from 'node:assert/strict';
import {showAdminNotifications,clearAdminNotifications} from '../public/admin-notifications.mjs';

class Element {
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.dataset={};this.events={};this.classList={add:()=>{}};}
 setAttribute(k,v){this.attributes[k]=v;}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 addEventListener(name,fn){this.events[name]=fn;}
}
function fixture(){
 const head=new Element('head'),body=new Element('body');
 globalThis.document={head,body,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),getElementById:id=>head.children.find(x=>x.id===id)};
 globalThis.localStorage={getItem:()=>null};globalThis.matchMedia=()=>({matches:false});clearAdminNotifications();
 return {head,body,current:()=>body.children[0],close:()=>body.children[0].children[2]};
}
test('notification queue is bounded, deduplicated and literal; dismiss acknowledges only the visible item',async()=>{
 const f=fixture(),acked=[];const items=Array.from({length:7},(_,i)=>({id:String(i),message:i===0?'<img src=x onerror=alert(1)>':'Message '+i}));
 showAdminNotifications(items,id=>{acked.push(id);});showAdminNotifications(items,id=>{acked.push(id);});
 assert.equal(f.body.children.length,1);assert.equal(f.head.children.length,1);
 assert.equal(f.current().attributes.role,'status');assert.equal(f.current().attributes['aria-live'],'polite');
 assert.equal(f.current().children[1].children[1].textContent,items[0].message);
 assert.equal(acked.length,0);
 for(let i=0;i<5;i++)await f.close().events.click();
 assert.deepEqual(acked,['0','1','2','3','4']);assert.equal(f.body.children.length,0);
 showAdminNotifications(items.slice(0,1),()=>{});assert.equal(f.body.children.length,0);
 clearAdminNotifications();
});
test('failed acknowledgement retains the message for retry and clear invalidates in-flight dismissals',async()=>{
 const f=fixture();let attempts=0;
 showAdminNotifications([{id:'retry',message:'Keep this message'}],async()=>{if(++attempts===1)throw Error('offline');});
 await f.close().events.click();assert.equal(f.close().disabled,false);assert.equal(f.close().textContent,'Retry');assert.equal(f.current().children[1].children[2].hidden,false);
 await f.close().events.click();assert.equal(f.body.children.length,0);
 let resolve;showAdminNotifications([{id:'old',message:'Old account'}],()=>new Promise(r=>resolve=r));const pending=f.close().events.click();clearAdminNotifications();
 showAdminNotifications([{id:'new',message:'New account'}],async()=>{});resolve();await pending;
 assert.equal(f.current().children[1].children[1].textContent,'New account');clearAdminNotifications();
});
test('invalid messages are ignored and local reduced motion disables notification animation',()=>{
 const f=fixture();f.body.dataset.animations='false';
 showAdminNotifications([{id:'bad',message:'x'.repeat(501)},{id:'blank',message:' '},{id:'good',message:'Hello'}],()=>{});
 assert.equal(f.body.children.length,1);assert.equal(f.current().dataset.reducedMotion,'true');
 clearAdminNotifications();assert.equal(f.body.children.length,0);
});
