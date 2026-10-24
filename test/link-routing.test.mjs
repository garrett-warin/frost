import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLink,installLinkRouting} from '../public/link-routing.mjs';
test('link destinations decode engine URLs and reject non-web/credential URLs',()=>{
 const base='https://example.com/path/', origin='https://frost.test',prefix='/browse/frame/';
 assert.equal(resolveLink('../next',base,origin,prefix),'https://example.com/next');
 assert.equal(resolveLink(origin+prefix+encodeURIComponent('https://other.test/a?x=1')+'#part',base,origin,prefix),'https://other.test/a?x=1#part');
 for(const value of ['javascript:alert(1)','data:text/html,test','https://user:pass@test/'])assert.equal(resolveLink(value,base,origin,prefix),null);
});

test('programmatic form submission stays in frame and preserves native call',()=>{
 const calls=[];
 function Form() { this.target='_blank'; this.body='unchanged'; }
 Form.prototype.submit=function(...args){calls.push({form:this,args});return 42;};
 const win={document:{addEventListener(){},querySelector(){return null;}},HTMLFormElement:Form};
 installLinkRouting(win,{base:()=> 'https://example.com/',proxyOrigin:'https://frost.test',prefix:'/browse/id/',open(){}});
 const form=new Form();
 assert.equal(form.submit('argument'),42);
 assert.equal(form.target,'_self');
 assert.equal(calls[0].form,form);
 assert.deepEqual(calls[0].args,['argument']);
 assert.equal(form.body,'unchanged');
});
test('new window, dynamic and modified links stay in Frost; downloads and ordinary links retain defaults',()=>{
 const listeners={},calls=[];
 const doc={addEventListener:(type,fn)=>listeners[type]=fn,querySelector:()=>null};
 const originals=[];const win={open:(...args)=>originals.push(args),document:doc,navigator:{userActivation:{isActive:true}}};installLinkRouting(win,{base:()=> 'https://example.com/',proxyOrigin:'https://frost.test',prefix:'/browse/id/',open:(...args)=>calls.push(args)});
 const click=(target,options={})=>{let prevented=false;const link={href:'https://other.test/',matches:()=>true,hasAttribute:()=>!!options.download,getAttribute:()=>target};const event={type:'click',button:0,composedPath:()=>[{},link],preventDefault:()=>prevented=true,stopImmediatePropagation(){},...options};listeners[event.type](event);return prevented;};
 assert.equal(click('_blank'),true);assert.equal(calls.at(-1)[1].newTab,true);
 assert.equal(click('_self'),false);
 assert.equal(click('_self',{ctrlKey:true}),true);assert.equal(calls.at(-1)[1].background,true);
 assert.equal(click('_self',{type:'auxclick',button:1}),true);
 assert.equal(click('_top'),false);
 assert.equal(click('_blank',{download:true}),false);
 assert.equal(win.open('/popup'),null);assert.equal(calls.at(-1)[0],'https://example.com/popup');
 doc.baseURI='https://base.test/folder/';win.open('relative');assert.equal(calls.at(-1)[0],'https://base.test/folder/relative');
 win.open('nested','_self');assert.equal(originals.at(-1)[0],'nested');
 const n=calls.length;win.open('javascript:alert(1)');assert.equal(calls.length,n);
 win.navigator.userActivation.isActive=false;win.open('/unwanted');click('_blank');assert.equal(calls.length,n);
 const form={tagName:'FORM',target:'_blank'},submitter={formTarget:'_top'};listeners.submit({target:form,submitter});assert.equal(form.target,'_self');assert.equal(submitter.formTarget,'_self');
});
