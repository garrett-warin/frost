import test from 'node:test';
import assert from 'node:assert/strict';
import {createWordmarkIntro} from '../public/wordmark-intro.mjs';
test('wordmark intro affects only its element, once per fresh home tab, and respects motion preference',()=>{
 const calls=[];let cancels=0,change;const motion={matches:false,addEventListener:(_,fn)=>change=fn};
 const intro=createWordmarkIntro({animate:(frames,options)=>{calls.push({frames,options});return {cancel:()=>cancels++};}},{motion});
 const home={home:true};intro(home);assert.equal(calls.length,1);assert.equal(calls[0].options.duration,1300);intro(home);assert.equal(calls.length,1);assert.equal(cancels,1);
 intro({home:false});intro({home:true,error:{}});assert.equal(calls.length,1);intro({home:true});assert.equal(calls.length,2);
 motion.matches=true;change();intro({home:true});assert.equal(calls.length,2);assert.equal(cancels,2);
 const disabled=createWordmarkIntro({animate:()=>assert.fail('Animations disabled')},{motion:{matches:false},enabled:()=>false});disabled({home:true});
});
