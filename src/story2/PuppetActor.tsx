import CartoonActor from './CartoonActor';
import type {StoryActivity} from './engine/story-engine.js';
import {useEffect,useState,type CSSProperties,type ReactNode} from 'react';
import {AUTO_ACTING,POSES} from './engine/acting-library.js';

/** The teen-v1 rig: image slots on shared articulated joints, with an independent face. */
function LegacyPuppetActor({character,emotion='neutral',talking=false,gesture,rest,response,reduced=false,idlePaused=false,actorId='actor'}:{character:any;emotion?:string;talking?:boolean;gesture?:string;rest?:string;prop?:string;response?:string;reduced?:boolean;actorId?:string;performanceKey?:number;gazeX?:number;gazeY?:number;activity?:StoryActivity;activityPaused?:boolean;turn?:number;listening?:boolean;idlePaused?:boolean}){
 const [blink,setBlink]=useState(false),[mouth,setMouth]=useState(false);
 const phase=[...actorId].reduce((a,c)=>a+c.charCodeAt(0),0)%7;
 useEffect(()=>{if(reduced||idlePaused){setBlink(false);return;}let timer:ReturnType<typeof setTimeout>,closed:ReturnType<typeof setTimeout>;let alive=true;const schedule=()=>{timer=setTimeout(()=>{if(!alive)return;setBlink(true);closed=setTimeout(()=>{setBlink(false);schedule();},130);},3400+phase*370);};schedule();return()=>{alive=false;clearTimeout(timer);clearTimeout(closed);};},[phase,reduced,idlePaused]);
 useEffect(()=>{setMouth(false);if(!talking||reduced)return;let count=0;const timer=setInterval(()=>{count++;setMouth(count%5!==0&&count%2===1);},145);return()=>clearInterval(timer);},[talking,reduced]);
 const automatic=AUTO_ACTING[emotion]||AUTO_ACTING.neutral;
 const pose=POSES[response|| (talking?(gesture||automatic.talk):(rest||automatic.rest))]||POSES.relaxed;
 const src=(key:string)=>character.rig.parts[key]?.src;
 const art=(key:string,x:number,y:number,w:number,h:number)=><image href={src(key)} x={x} y={y} width={w} height={h} preserveAspectRatio="none"/>;
 const bone=(name:string,x:number,y:number,children:ReactNode)=><g transform={`translate(${x} ${y})`} data-joint={name}><g className="puppet-joint" style={{transform:`rotate(${pose[name]||0}deg)`,transitionDuration:reduced?'0ms':undefined}}><g className={talking&&!reduced&&name.endsWith('Forearm')?'puppet-talk-pulse':undefined}>{children}</g></g></g>;
 const arm=(side:'left'|'right')=>bone(side+'UpperArm',side==='left'?-49:49,-112,<>{art(side+'UpperArm',-19,-10,38,99)}{bone(side+'Forearm',side==='left'?-5:5,77,<>{art(side+'Forearm',-13,-10,26,91)}{bone(side+'Hand',0,71,art(side+'Hand',-13,-5,26,46))}</>)}</>);
 const leg=(side:'left'|'right')=>bone(side+'Thigh',side==='left'?-25:25,9,<>{art(side+'Thigh',-24,-7,48,127)}{bone(side+'Shin',0,104,art(side+'Shin',-26,-10,52,143))}</>);
 const browTilt=emotion==='angry'||emotion==='determined'?-8:emotion==='worried'||emotion==='sad'?9:0;
 const eyebrowY=['surprised','curious'].includes(emotion)?-73:emotion==='relieved'?-63:-65;
 const squint=['skeptical','angry','determined'].includes(emotion);
 const worried=['worried','sad','embarrassed'].includes(emotion);
 const smile=['happy','relieved'].includes(emotion);
 return <svg viewBox="0 0 240 600" className={`puppet-actor ${reduced?'puppet-still':''} ${talking?'puppet-speaking':''} ${response?'response-'+response:''}`} role="img" aria-label={`${character.name} — ${emotion}${talking?', speaking':''}`} style={{'--idle-delay':`${-phase*.47}s`} as CSSProperties}>
  <ellipse cx="120" cy="587" rx="48" ry="5" fill="#10202a" opacity=".18"/>
  {bone('pelvis',120,338,<>{leg('right')}{leg('left')}{art('pelvis',-48,-16,96,70)}</>)}
  <g className="puppet-breath">{bone('torso',120,322,<>{art('torso',-66,-149,132,170)}{arm('right')}{arm('left')}{bone('head',0,-147,<>
   {art('head',-54,-132,108,148)}
   <g className="puppet-face" fill="none" stroke="#342423" strokeWidth="1.5" strokeLinecap="round">
    <path d={`M -29 ${eyebrowY+2} Q -20 ${eyebrowY-3} -11 ${eyebrowY}`} transform={`rotate(${browTilt} -20 ${eyebrowY})`}/>
    <path d={`M 11 ${eyebrowY} Q 20 ${eyebrowY-3} 29 ${eyebrowY+2}`} transform={`rotate(${-browTilt+(['skeptical','confused','curious'].includes(emotion)?12:0)} 20 ${eyebrowY})`}/>
    {[-20,20].map(x=><g key={x} transform={`translate(${x} -53)`}>{blink?<path d="M -8 0 Q 0 4 8 0"/>:<><path d={squint?'M -8 -1 Q 0 -5 8 -1 Q 0 5 -8 -1':'M -8 0 Q 0 -8 8 0 Q 0 7 -8 0'} fill="#fff9ef"/><ellipse cx="0" cy="0" rx="3.8" ry={squint?3:4.8} fill="#382e2a"/><circle cx="-1" cy="-1.5" r="1.1" fill="white" stroke="none"/></>}</g>)}
    <path d="M 0 -47 L -2 -36 L 2 -35" stroke="#b78064" strokeWidth="1"/>
    {mouth?<ellipse cx="0" cy="-24" rx="6" ry={smile?4:5.5} fill="#733b3a"/>:emotion==='surprised'?<ellipse cx="0" cy="-24" rx="3.5" ry="5" fill="#733b3a"/>:<path d={smile?'M -8 -26 Q 0 -18 8 -26':worried?'M -7 -23 Q 0 -28 7 -23':'M -7 -25 Q 0 -23 7 -25'}/>}
    {emotion==='embarrassed'&&<><ellipse cx="-27" cy="-32" rx="7" ry="3" fill="#d57978" opacity=".4" stroke="none"/><ellipse cx="27" cy="-32" rx="7" ry="3" fill="#d57978" opacity=".4" stroke="none"/></>}
   </g>
  </>)}</>)}</g>
 </svg>;
}

export default function PuppetActor(props:Parameters<typeof LegacyPuppetActor>[0]){return props.character.rig?.preset==='cartoon-v1'?<CartoonActor {...props}/>:<LegacyPuppetActor {...props}/>;}
