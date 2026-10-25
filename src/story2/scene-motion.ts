import {emitSound} from './scene-sound';
import {performAction} from './action-motion';
/** Run finite performances alongside a readable beat. Each actor has one motion owner.
 * Cancel before navigation; old completions must never clear a newer reaction. */
export function playSceneMotion(root:HTMLElement,cues:any[],current:any,reduced:boolean,publish:(r:Record<string,string>)=>void,signal:AbortSignal){
 if(signal.aborted)return Promise.resolve();
 signal.addEventListener('abort',()=>root.dispatchEvent(new Event('story-sound-stop')),{once:true});
 let responses:Record<string,string>={};
 const valid=()=>!signal.aborted;
 const wait=(ms:number)=>new Promise<void>(resolve=>{if(!valid()){resolve();return;}const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,ms);signal.addEventListener('abort',done,{once:true});});
 const animate=async(el:HTMLElement|null,frames:Keyframe[],duration=420)=>{
  if(!valid()||!el?.animate)return;
  const a=el.animate(frames,{duration,easing:'ease-in-out'}),cancel=()=>a.cancel();
  signal.addEventListener('abort',cancel,{once:true});
  try{await a.finished;}catch{/* Interrupted by navigation. */}finally{signal.removeEventListener('abort',cancel);}
 };
 const jobs=new Map<string,Promise<void>>();
 const nodes=[...cues,...(current?.type==='act'?[current]:[])];
 for(const n of nodes){
  if(!['react','perform','act','show','move','effect','sound'].includes(n.type))continue;
  if(n.type==='move'&&['exit','left','center','right','turn'].includes(n.action))continue;
  const owners=[n.actor||'world',n.targetActor].filter(Boolean);
  const update=(value:Record<string,string>)=>{if(!valid())return;for(const id of owners)delete responses[id];responses={...responses,...value};publish({...responses});};
  const run=async()=>{
   if(!valid())return;
   if(n.type==='sound'){emitSound(root,n.preset);return;}
   if(reduced)return;
   const el=root.querySelector<HTMLElement>(n.actor?`[data-actor="${n.actor}"]`:'.story-world');
   if(n.type==='act'||n.type==='perform'){
    for(let i=0;i<(n.repeat||1)&&valid();i++){
     await performAction(root,n,false,update,valid,signal);
     // Recovery grows as the character tires; bounded, never an infinite idle loop.
     if(i<(n.repeat||1)-1&&valid())await wait(n.pace==='tiring'?180+i*180:80);
    }
   }else if(n.type==='react'){update({[n.actor]:n.action});await wait(1900);update({});}
   else if(n.type==='show'&&n.entering)await animate(el,[{opacity:0,transform:'translateX(-45px)'},{opacity:1,transform:'translateX(0)'}]);
   else if(n.type==='effect'||n.type==='move'){
    const transforms:Record<string,string[]>={enter:['translateX(-70px)','translateX(0)'],nod:['translateY(0)','translateY(10px)','translateY(0)'],shake:['translateX(-8px)','translateX(8px)','translateX(0)'],bounce:['translateY(0)','translateY(-25px)','translateY(0)'],recoil:['rotate(0)','rotate(-5deg)','rotate(0)'],closeup:['scale(1)','scale(1.08)','scale(1)'],magic:['scale(.6) rotate(-4deg)','scale(1.08) rotate(2deg)','scale(1)']};
    await animate(el,(transforms[n.action]||['scale(.98)','scale(1)']).map((transform,i)=>({transform,opacity:(n.action==='fade'||n.action==='magic')&&i===0?0:1})),n.action==='magic'?850:420);
   }
  };
  const job=Promise.all(owners.map(id=>jobs.get(id))).then(run);
  owners.forEach(id=>jobs.set(id,job));
 }
 return Promise.all([...jobs.values()]).then(()=>{});
}
