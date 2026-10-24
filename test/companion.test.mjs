import test from 'node:test';
import assert from 'node:assert/strict';
import {companionMotion,jumpPose,JUMP_DURATION} from '../public/frosty/companion.mjs';

test('small hop anticipates, rises, and returns to rest',()=>{
 assert.ok(jumpPose(.08).y>0);assert.ok(jumpPose(.37).y<0);
 assert.deepEqual(jumpPose(JUMP_DURATION),{y:0,s:1});
});

test('whole snowman hops without turning and respects visibility, reduced motion, and cleanup',()=>{
 const original=Object.fromEntries(['matchMedia','document','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,globalThis[key]]));
 let frame,preferenceChange,pending=false;
 const media={matches:false,addEventListener(type,fn){preferenceChange=fn;},removeEventListener(){}};
 globalThis.matchMedia=()=>media;globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
 globalThis.requestAnimationFrame=fn=>{frame=fn;pending=true;return 1;};globalThis.cancelAnimationFrame=()=>{pending=false;};
 const nodes={'.snow-body':{style:{}},'.snow-eyes':{style:{}}};
 try{
  const motion=companionMotion({querySelector:key=>nodes[key]});motion.set('opening');
  let now=performance.now(),highest=0;
  for(let i=0;i<180;i++){now+=1000/60;frame(now);const transform=nodes['.snow-body'].style.transform;assert.doesNotMatch(transform,/rotate/);highest=Math.min(highest,Number(transform.match(/translateY\(([-\d.e+]+)px\)/)[1]));}
  assert.ok(highest<-5);assert.ok(Math.abs(Number(nodes['.snow-body'].style.transform.match(/translateY\(([-\d.e+]+)px\)/)[1]))<.1);
  motion.visible(false);assert.equal(pending,false);motion.visible(true);assert.equal(pending,true);
  media.matches=true;preferenceChange();assert.equal(nodes['.snow-body'].style.transform,'none');assert.equal(nodes['.snow-eyes'].style.transform,'none');assert.equal(pending,false);
  motion.destroy();
 }finally{Object.assign(globalThis,original);}
});
