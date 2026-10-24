import test from "node:test";
import assert from "node:assert/strict";
import {
  makeTab,
  recordNavigation,
  historyTarget,
  normalizeSettings,
  loadPreferences,
} from "../public/state.mjs";
import { createProxyUrl, validateEndpoint } from "../public/transport.mjs";
test("per-tab history preserves forward navigation and truncates on new visit", () => {
  const a = makeTab("a"),
    b = makeTab("b");
  recordNavigation(a, "https://one.test");
  recordNavigation(a, "https://two.test");
  assert.equal(historyTarget(a, -1), "https://one.test");
  assert.deepEqual(a.forwardHistory, ["https://two.test"]);
  assert.equal(historyTarget(a, -1), null);
  recordNavigation(a, "https://three.test");
  assert.equal(historyTarget(a, 1), null);
  assert.deepEqual(b.history, []);
  recordNavigation(a, "https://redirect.test", { replace: true });
  assert.deepEqual(a.history, ["https://one.test", "https://redirect.test"]);
});
test("settings tolerate corrupt storage and preserve numeric accent intensity", () => {
  assert.equal(loadPreferences({ getItem: () => "{bad" }).theme, "light");
  assert.equal(normalizeSettings({ accentIntensity: 50 }).accentIntensity, 50);
  assert.equal(
    normalizeSettings({ searchEngine: "google" }).searchEngine,
    "duckduckgo",
  );
  assert.equal(
    normalizeSettings({ accentIntensity: 1000 }).accentIntensity,
    100,
  );
});
test("proxy transformer encodes targets and rejects unsafe configurations", () => {
  assert.equal(
    createProxyUrl("https://example.com/a?q=a&b=c", { prefix: "/browse/a/b/" }),
    "/browse/a/b/https%3A%2F%2Fexample.com%2Fa%3Fq%3Da%26b%3Dc",
  );
  assert.equal(
    createProxyUrl("https://example.com", {
      endpoint: "https://proxy.test/?url=",
    }),
    "https://proxy.test/?url=https%3A%2F%2Fexample.com%2F",
  );
  for (const endpoint of [
    "http://proxy.test/",
    "javascript:alert(1)",
    "https://user:pass@proxy.test",
  ])
    assert.throws(() => validateEndpoint(endpoint));
  assert.throws(() => createProxyUrl("file:///test", { prefix: "/browse/" }));
});

import { saveSession, loadSession, writeList, readList } from '../public/state.mjs';
test('tabs, active selection, forward history and visits survive reopening', () => {
 const data=new Map(); const storage={setItem:(k,v)=>data.set(k,v), getItem:k=>data.get(k)};
 const a=makeTab('a'), b=makeTab('b');
 a.url='https://one.test/'; a.home=false; a.title='One';
 recordNavigation(a,a.url); recordNavigation(a,'https://two.test/'); historyTarget(a,-1);
 saveSession(storage,[a,b],'a');
 const restored=loadSession(storage);
 assert.equal(restored.activeId,'a'); assert.equal(restored.tabs.length,2);
 assert.equal(restored.tabs[0].url,a.url); assert.equal(restored.tabs[0].loading,false);
 assert.equal(historyTarget(restored.tabs[0],1),'https://two.test/');
 writeList(storage,'history',[{url:a.url,title:'One',visitedAt:1}]);
 assert.equal(readList(storage,'history')[0].title,'One');
 saveSession(storage,[b],'b'); assert.equal(loadSession(storage).tabs.length,1);
});
test('saved dark themes migrate and unsafe or corrupt sessions do not execute URLs', () => {
 assert.equal(normalizeSettings({theme:'dark'}).theme,'light');
 assert.deepEqual(loadSession({getItem:()=>'{broken'}).tabs,[]);
 const restored=loadSession({getItem:()=>JSON.stringify({tabs:[{id:'x',url:'javascript:alert(1)',history:['file:///a']},{id:'x'}]})});
 assert.equal(restored.tabs.length,1); assert.equal(restored.tabs[0].home,true); assert.equal(restored.tabs[0].url,'');
});

test('large saved histories retain a window around the current back/forward position', () => {
 let saved; const storage={setItem:(_,v)=>saved=v,getItem:()=>saved};
 const tab=makeTab('long'); tab.history=Array.from({length:150},(_,i)=>`https://example.com/${i}`); tab.historyIndex=10; tab.url=tab.history[10]; tab.home=false;
 saveSession(storage,[tab],tab.id);
 const restored=loadSession(storage).tabs[0];
 assert.equal(restored.history[restored.historyIndex],tab.url);
 assert.equal(historyTarget(restored,-1),'https://example.com/9');
 assert.equal(historyTarget(restored,1),'https://example.com/10');
 assert.equal(historyTarget(restored,1),'https://example.com/11');
});
