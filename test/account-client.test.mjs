import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../public/device-access.mjs',import.meta.url),'utf8')).replace('export function','function');
test('banned browsing client follows only its configured dispenser appeal redirect',async()=>{
 for(const destination of ['https://accounts.example/appeal','https://attacker.example/appeal']){
  const redirects=[],context=vm.createContext({URL,AbortSignal,Error,location:{replace:url=>redirects.push(url)},fetch:async path=>({ok:path==='/api/config',json:async()=>path==='/api/config'?{dispenserOrigin:'https://accounts.example'}:{redirect:destination,error:'Restricted'}})});
  vm.runInContext(source,context);await assert.rejects(vm.runInContext('checkDevice()',context),/Restricted/);assert.deepEqual(redirects,destination.startsWith('https://accounts.example')?[destination]:[]);
 }
});
