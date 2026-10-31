import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserRefresh} from '../public/browser-refresh.mjs';
test('reload once for newer commands, never for baseline, repeated, invalid or stale replies',()=>{
 let reloads=0;const receive=createBrowserRefresh(()=>reloads++);
 for(const value of [null,{}, {all:-1,account:0}, {all:0,account:'1'}])assert.equal(receive(value),false);
 assert.equal(receive({all:5,account:2}),false);
 assert.equal(receive({all:4,account:1}),false);
 assert.equal(receive({all:5,account:2}),false);
 assert.equal(receive({all:5,account:3}),true);
 receive({all:5,account:3});receive({all:6,account:3});assert.equal(reloads,1);
 const reloaded=createBrowserRefresh(()=>reloads++);reloaded({all:6,account:3});assert.equal(reloads,1);
 reloaded({all:7,account:3});assert.equal(reloads,2);
});
