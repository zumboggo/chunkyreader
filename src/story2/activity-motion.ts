import {useEffect,useRef,useState} from 'react';
import type {StoryActivity} from './engine/story-engine.js';
import {performAction} from './action-motion';

/** A gait clock belongs to the activity, never the dialogue cursor. Pause retains phase. */
export function useWalkClock(active:boolean){
 const elapsed=useRef(0),[time,setTime]=useState(0);
 useEffect(()=>{if(!active)return;let frame=0,last:number|undefined,published=0;
  const tick=(now:number)=>{if(last!==undefined)elapsed.current+=Math.min(80,now-last);last=now;if(now-published>=32){setTime(elapsed.current);published=now;}frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[active]);return time;
}
export function walkingPose(ms:number,pace:string){
 const period=pace==='slow'?1800:pace==='brisk'?1050:1400,phase=ms/period*Math.PI*2,s=Math.sin(phase),lift=7;
 return {bodyDrop:3+Math.cos(phase*2),leftFootX:24*s,rightFootX:-24*s,leftFootLift:Math.max(0,s)*lift,rightFootLift:Math.max(0,-s)*lift,leftUpperArm:-11*s,rightUpperArm:11*s,leftForearm:-8,rightForearm:-8,torso:1.5*s,head:-s};
}
/** Pausable recovery; cancellation cannot leave a pending timer or sound. */
export function activityWait(ms:number,signal:AbortSignal){return new Promise<void>(resolve=>{
 if(signal.aborted){resolve();return;}const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,ms);signal.addEventListener('abort',done,{once:true});
});}
export async function trainContinuously(root:HTMLElement,actor:string,activity:StoryActivity,publish:(r:Record<string,string>)=>void,signal:AbortSignal){
 let strokes=0;
 while(!signal.aborted){
  await performAction(root,{action:'sword-strike',actor,targetActor:activity.targetActor},false,publish,()=>!signal.aborted,signal);
  if(signal.aborted)break;
  strokes++;
  // A short recovery on every stroke, plus a longer breath after a small set.
  await activityWait(activity.pace==='tiring'?(strokes%3===0?1900:750):450,signal);
 }
}

/** Two rigid arm segments reach the spoon and bowl; the meal never changes scale. */
function mealArm(side:'left'|'right',wx:number,wy:number){
 const dx=wx-(side==='left'?76:164),dy=wy-213;
 const f=(side==='left'?-1:1)*Math.acos(Math.max(-1,Math.min(1,(dx*dx+dy*dy-58*58-57*57)/(2*58*57))));
 const a=Math.atan2(-dx,dy)-Math.atan2(57*Math.sin(f),58+57*Math.cos(f));
 return {[side+'UpperArm']:a*180/Math.PI,[side+'Forearm']:f*180/Math.PI};
}
export function eatingPose(ms:number,pace:string){
 const phase=(ms/(pace==='eager'?2400:3400))%1;
 const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 const lift=phase<.15?0:phase<.4?smooth((phase-.15)/.25):phase<.53?1:1-smooth((phase-.53)/.25);
 const wx=155-10*lift,wy=268-73*lift;
 return {pose:{...mealArm('left',103,281),...mealArm('right',wx,wy),head:0,torso:0},wx,wy,tipX:128-8*lift,tipY:248-100*lift,mouth:phase>.38&&phase<.55?2:phase>.55&&phase<.85?(Math.floor(phase*28)%2):0,rice:phase<.48};
}
