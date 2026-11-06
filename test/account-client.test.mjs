import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../public/device-access.mjs',import.meta.url),'utf8')).replace('export function','function').replace(/^import .*;$/mg,'');
test('banned browsing client follows only its configured dispenser appeal redirect',async()=>{
 for(const destination of ['https://accounts.example/appeal','https://attacker.example/appeal']){
  const redirects=[],context=vm.createContext({showAdminNotifications(){},clearAdminNotifications(){},URL,AbortSignal,Error,document:{getElementById:()=>null},location:{replace:url=>redirects.push(url)},fetch:async path=>({ok:path==='/api/config',json:async()=>path==='/api/config'?{dispenserOrigin:'https://accounts.example'}:{redirect:destination,error:'Restricted'}})});
  vm.runInContext(source,context);await assert.rejects(vm.runInContext('checkDevice()',context),/Restricted/);assert.deepEqual(redirects,destination.startsWith('https://accounts.example')?[destination]:[]);
 }
});


test('support notification appears only for admin signal and clears on errors',async()=>{
 const nodes=new Map();let data={supportUnclaimed:true},fails=false;
 const document={getElementById:id=>nodes.get(id)||null,createElement:()=>({setAttribute(){},remove(){nodes.delete(this.id);}}),body:{append(n){nodes.set(n.id,n);}}};
 const context=vm.createContext({showAdminNotifications(){},clearAdminNotifications(){},URL,AbortSignal,Error,document,fetch:async path=>{if(fails)throw Error('Offline');return {ok:true,json:async()=>path==='/api/config'?{dispenserOrigin:'https://accounts.example'}:data};}});
 vm.runInContext(source,context);await vm.runInContext('checkDevice()',context);assert.equal(nodes.get('admin-support-notification').href,'https://accounts.example/admin#support');
 data={};await vm.runInContext('checkDevice()',context);assert.equal(nodes.size,0);
 data={supportUnclaimed:true};await vm.runInContext('checkDevice()',context);fails=true;await assert.rejects(vm.runInContext('checkDevice()',context),/Offline/);assert.equal(nodes.size,0);
});
