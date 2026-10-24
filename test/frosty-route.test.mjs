import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrostyRoute} from '../public/frosty/route.mjs';
test('Frosty page has its own route, restores browsing, and responds to browser navigation',()=>{
 const listeners={},states=[],entries=[];
 const location={hash:'',pathname:'/',search:'?preview=1'};
 const win={location,addEventListener:(type,fn)=>listeners[type]=fn,history:{pushState(state,title,url){entries.push(url);location.hash=url;},replaceState(state,title,url){entries.push(url);location.hash='';}}};
 const route=createFrostyRoute({window:win,render:open=>states.push(open)});
 route.sync();assert.equal(states.at(-1),false);route.open();assert.equal(location.hash,'#frosty');assert.equal(states.at(-1),true);
 route.open();assert.equal(entries.length,1,'opening twice does not create history duplicates');
 location.hash='';listeners.popstate();assert.equal(states.at(-1),false);
 location.hash='#frosty';listeners.hashchange();assert.equal(states.at(-1),true);
 route.close();assert.equal(entries.at(-1),'/?preview=1');assert.equal(states.at(-1),false);
});
