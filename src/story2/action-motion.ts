import {emitSound} from './scene-sound';
import {armGeometry} from './character-geometry';
import {ACTIONS,ACTION_DURATION,POSES} from './engine/acting-library.js';
/** Finite, paired choreography. Coordinates use the actual stage, including phone layouts. */
export function actionFrames(action:string,direction:number,distance:number,reactionScale=1){
 const d=direction,r=Math.max(0,Math.min(1,reactionScale)),step=Math.max(0,distance)*d;
 const keys=(values:string[])=>values.map((transform,i)=>({transform,offset:[0,.15,.34,.48,.72,1][i]}));
 const actor=action==='mounted-charge'?keys(['translateX(0)',`translateX(${-d*4}px)`,`translateX(${step*.5}px)`,`translateX(${step}px)`,`translateX(${step}px)`,'translateX(0)']):(action.startsWith('attack')||action.startsWith('sword-'))?keys(['translateX(0)',`translateX(${-d*8}px) rotate(${-d*3}deg)`,`translateX(${step}px) rotate(${d*5}deg)`,`translateX(${step}px) rotate(${d*3}deg)`,`translateX(${step*.45}px)`,'translateX(0)']):
 action==='stumble'?keys(['translateX(0)','rotate(-4deg)','translateX(14px) rotate(10deg)','translateX(18px) rotate(5deg)','translateX(6px) rotate(-3deg)','translateX(0)']):
 action==='bow'?keys(['rotate(0)','rotate(2deg)','rotate(8deg)','rotate(8deg)','rotate(3deg)','rotate(0)']):
 action==='cheer'?keys(['translateY(0)','translateY(3px)','translateY(-12px)','translateY(-6px)','translateY(0)','translateY(0)']):
 keys(['translateX(0)','translateX(0)',`translateX(${['give','steady'].includes(action)?step*.6:0}px)`,`translateX(${['give','steady'].includes(action)?step*.6:0}px)`,'translateX(0)','translateX(0)']);
 const target=keys(['translateX(0)','translateX(0)','translateX(0)',`translateX(${d*r*(['attack-dodged','sword-dodged'].includes(action)?32:['attack','sword-strike','shoot-arrow','magic-beam'].includes(action)?18:4)}px) rotate(${d*r*(action==='attack-dodged'?12:action==='attack'?7:0)}deg)`,`translateX(${d*r*4}px)`,'translateX(0)']);
 return {actor,target};
}
export async function performAction(root:HTMLElement,node:any,reduced:boolean,setResponses:(r:Record<string,string>)=>void,valid:()=>boolean,signal?:AbortSignal){
 const cue=ACTIONS[node.action];if(!cue||reduced||!valid()||signal?.aborted)return;
 const actor=root.querySelector<HTMLElement>(`[data-actor="${node.actor}"]`),target=node.targetActor?root.querySelector<HTMLElement>(`[data-actor="${node.targetActor}"]`):null;
 if(!actor)return;
 const world=root.querySelector<HTMLElement>('.story-world'),zoom=world?.offsetWidth?(world.getBoundingClientRect().width/world.offsetWidth)||1:1;
 const rect=(el:Element)=>{const b=el.getBoundingClientRect();return {x:b.x/zoom,y:b.y/zoom,width:b.width/zoom,height:b.height/zoom,left:b.left/zoom,right:b.right/zoom};};
 const a=rect(actor),b=target?rect(target):undefined;const direction=b?(b.x<a.x?-1:1):(actor.querySelector<HTMLElement>('.story-facing')?.style.transform.includes('-1')?-1:1);
 // Close most of the gap, retaining room for the arm; never travel off the stage.
 const gap=b?Math.abs((b.x+b.width/2)-(a.x+a.width/2)):0;
 const stageElement=(root.matches('.story-stage')?root:root.querySelector('.story-stage')),stage=stageElement?rect(stageElement):undefined;
 const room=b&&stage?(direction>0?stage.right-(b.x+b.width/2):(b.x+b.width/2)-stage.left)-b.height*.12:1000;
 const reactionScale=b?Math.min(1,Math.max(0,room)/(32+b.height*.21)):1;
 const soloRoom=stage?Math.max(0,direction>0?stage.right-a.right:a.left-stage.left):0;
 // Use the sword hand at contact, rather than closing an arbitrary body-sized gap.
 const pose=POSES[cue.actor],hand=armGeometry('right',pose.rightUpperArm||0,pose.rightForearm||0);
 const reach=node.action.startsWith('sword-')?(hand.wx-120+Math.sin(hand.b+(pose.rightHand||0)*Math.PI/180)*116)*a.height/600:a.height*.19;
 const travel=node.action==='mounted-charge'?Math.min(a.width*.28,soloRoom):Math.max(0,gap-reach-(b?.width||0)*.18);
 const frames=actionFrames(node.action,direction,travel,reactionScale);
 const dummy=target?.dataset.impact==='anchored';
 if(dummy&&node.action==='sword-strike')frames.target=[0,0,0,7,-2,0].map((angle,i)=>({transform:`rotate(${direction*angle}deg)`,transformOrigin:'50% 96%',offset:[0,.15,.34,.48,.72,1][i]}));
 const sounds:ReturnType<typeof setTimeout>[]=[];
 const at=(ms:number,cue:string)=>sounds.push(setTimeout(()=>{if(valid()&&!signal?.aborted)emitSound(root,cue);},ms));
 if(node.action.startsWith('sword-')){at(ACTION_DURATION*.15,'swish');if(node.action==='sword-strike')at(ACTION_DURATION*.34,dummy?'straw':'thud');else if(node.action==='sword-blocked')at(ACTION_DURATION*.34,'clang');}
 else if(['attack','mounted-charge'].includes(node.action))at(ACTION_DURATION*.34,'thud');
 const reaction={[node.actor]:cue.actor,...(node.targetActor&&cue.target?{[node.targetActor]:cue.target}:{})};
 const delayed=cue.target==='recoil';
 setResponses(delayed?{[node.actor]:cue.actor}:reaction);
 const impact=delayed?setTimeout(()=>{if(valid()&&!signal?.aborted)setResponses(reaction);},ACTION_DURATION*.34):undefined;
 const animations=[actor.animate?.(frames.actor,{duration:ACTION_DURATION,easing:'ease-in-out'}),target?.animate?.(frames.target,{duration:ACTION_DURATION,easing:'ease-in-out'})].filter(Boolean) as Animation[];
 const cancel=()=>{sounds.forEach(clearTimeout);clearTimeout(impact);animations.forEach(a=>a.cancel());};signal?.addEventListener('abort',cancel,{once:true});
 try{await Promise.all(animations.map(a=>a.finished));}catch{/* Navigation cancels this performance. */}finally{sounds.forEach(clearTimeout);clearTimeout(impact);signal?.removeEventListener('abort',cancel);}
 if(valid())setResponses({});
}
