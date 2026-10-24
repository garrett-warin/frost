export function snowman(){return `<svg viewBox="0 0 100 124" aria-hidden="true" class="snowman">
<g class="snow-body" fill="var(--surface)" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M50 62c-16-1-27 10-27 24 0 15 12 24 28 24 15 0 26-11 25-25-1-14-11-24-26-23Z"/>
<path d="M49 24c-11-1-19 8-19 19 0 12 9 20 21 20 11 0 19-9 18-20 0-11-8-20-20-19Z"/>
<g class="snow-eyes" fill="currentColor" stroke="none"><circle cx="43" cy="42" r="1.6"/><circle cx="56" cy="42" r="1.6"/></g>
<path d="m49 48 5 2-5 1" fill="none" stroke-width="1.5"/>
</g></svg>`;}

export const JUMP_DURATION=.85;
export function jumpPose(age){
 if(age<0||age>=JUMP_DURATION)return {y:0,s:1};
 if(age<.12){const t=Math.sin(age/.12*Math.PI/2);return {y:2*t,s:1-.06*t};}
 if(age<.62){const t=Math.sin((age-.12)/.5*Math.PI);return {y:-11*t,s:1+.025*t};}
 const t=Math.sin((age-.62)/.23*Math.PI);return {y:1.5*t,s:1-.04*t};
}

export function companionMotion(element){
 const body=element.querySelector('.snow-body'),eyes=element.querySelector('.snow-eyes');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 body.style.transformOrigin='50px 110px';eyes.style.transformOrigin='50px 42px';
 let state='idle',age=JUMP_DURATION,last=0,time=0,raf,visible=true,disposed=false,nextBlink=3;
 const position={y:0,s:1},velocity={y:0,s:0};
 function reset(){position.y=velocity.y=velocity.s=0;position.s=1;body.style.transform='none';eyes.style.transform='none';}
 function tick(ms){
  const dt=Math.min((ms-last)/1000||.016,.032);last=ms;age=Math.min(age+dt,JUMP_DURATION);time+=dt;
  const pose=jumpPose(age);
  for(const key of ['y','s']){velocity[key]+=(pose[key]-position[key])*145*dt-velocity[key]*21*dt;position[key]+=velocity[key]*dt;}
  body.style.transform=`translateY(${position.y}px) scale(${1/position.s},${position.s})`;
  const blinking=time>nextBlink&&time<nextBlink+.12;if(time>nextBlink+.12)nextBlink=time+3+Math.random()*4;
  eyes.style.transform=blinking?'scaleY(.15)':'none';
  if(visible&&!document.hidden&&!reduced.matches&&!disposed)raf=requestAnimationFrame(tick);
 }
 function restart(){cancelAnimationFrame(raf);if(disposed)return;if(reduced.matches){age=JUMP_DURATION;reset();return;}last=performance.now();if(visible&&!document.hidden)raf=requestAnimationFrame(tick);}
 document.addEventListener('visibilitychange',restart);reduced.addEventListener('change',restart);reset();restart();
 return {
  set(value){if(value!==state){state=value;if(['thinking','success','opening'].includes(value)&&age>=JUMP_DURATION)age=0;restart();}},
  visible(value){visible=value;restart();},
  destroy(){disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',restart);reduced.removeEventListener('change',restart);}
 };
}
