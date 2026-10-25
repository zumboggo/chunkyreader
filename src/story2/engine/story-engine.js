import {SCENE_BEATS,expandSceneBeat} from './scene-beats.js';
import {PROPS,ACTIONS,EMOTIONS,RESTS,TALKS,RESPONSES,CAMERAS,MOVES,EFFECTS,validateRig} from './acting-library.js';
/** Story 1/2: deliberately small, data-only language shared by browser and server. */
export const STORY_VERSION=2;
const id='[a-zA-Z][a-zA-Z0-9_-]*';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const value=s=>s==='true'?true:s==='false'?false:Number(s);
export function compileStory(source,assets={}) {
 const errors=[], nodes=[], variables={}, labels={}; let choice=null;
 const error=(line,message)=>errors.push({line,message});
 const add=(n,line)=>{nodes.push({...n,line});return nodes.at(-1);};
 if(typeof source!=='string'||source.length>150000)return {errors:[{line:1,message:'Script must be at most 150,000 characters.'}]};
 const lines=source.replace(/\r/g,'').split('\n');
 const version=lines[0]?.trim()==='story 2'?2:1;
 if(!['story 1','story 2'].includes(lines[0]?.trim()))error(1,'Begin with story 1 or story 2');
 for(let index=1;index<lines.length;index++){
  const line=index+1,s=lines[index].trim(); if(!s||s.startsWith('#'))continue;let m;
  if(s.startsWith('option ')){
   m=s.match(new RegExp(`^option (${id}) "(.+)" -> (${id})(?: ; (.+))?$`));
   if(!m||!choice){error(line,'Use option id "Text" -> label ; variable += 1 after a choice');continue;}
   const changes=[];for(const raw of (m[4]||'').split(',').filter(Boolean)){const op=raw.trim().match(new RegExp(`^(${id}) (=|\\+=|-=) (true|false|-?\\d+)$`));if(!op)error(line,'Invalid variable update');else changes.push({variable:op[1],op:op[2],value:value(op[3])});}
   choice.options.push({id:m[1],text:m[2],target:m[3],changes,line});continue;
  }
  choice=null;
  if((m=s.match(new RegExp(`^variable (${id}) = (true|false|-?\\d+)(?: range (-?\\d+) (-?\\d+))? (visible|hidden)$`)))){
   if(own(variables,m[1]))error(line,'Duplicate variable');variables[m[1]]={initial:value(m[2]),min:m[3]===undefined?0:Number(m[3]),max:m[4]===undefined?100:Number(m[4]),visible:m[5]==='visible'};
   const v=variables[m[1]];if(typeof v.initial==='number'&&(!m[3]||v.min>v.max||v.initial<v.min||v.initial>v.max))error(line,'Numeric variables require a valid range containing the initial value');continue;
  }
  if((m=s.match(new RegExp(`^label (${id})$`)))){if(own(labels,m[1]))error(line,'Duplicate label');labels[m[1]]=nodes.length;add({type:'label',id:m[1]},line);continue;}
  if((m=s.match(new RegExp(`^scene (${id})$`)))){if(!assets.backgrounds?.[m[1]])error(line,'Unknown background '+m[1]);add({type:'scene',asset:m[1]},line);continue;}
  if(version===2&&(m=s.match(new RegExp(`^beat (${id}) (${id}) (${id}) "([^"\\n]+)"$`)))){
   if(!Object.hasOwn(SCENE_BEATS,m[1]))error(line,'Unknown scene beat '+m[1]);
   else if(!assets.characters?.[m[2]]||!assets.characters?.[m[3]])error(line,'Unknown scene beat character');
   else if(m[2]===m[3])error(line,'A scene beat needs two different characters');
   else expandSceneBeat(m[1],m[2],m[3],m[4]).forEach(n=>add(n,line));
   continue;
  }
  if(version===2&&(m=s.match(new RegExp(`^prop (${id}) (${id})$`)))){
   if(!assets.characters?.[m[1]])error(line,'Unknown prop character');
   else if(assets.characters[m[1]].rig?.preset!=='cartoon-v1')error(line,'Props require a polished or hybrid cartoon-v1 rig');
   if(!PROPS.includes(m[2]))error(line,'Unknown prop '+m[2]);
   add({type:'prop',actor:m[1],prop:m[2]},line);continue;
  }
  if(version===2&&(m=s.match(new RegExp(`^(express|look) (${id}) (${id})$`)))){
   if(!assets.characters?.[m[2]])error(line,'Unknown actor');
   if(m[1]==='express'&&!EMOTIONS.includes(m[3]))error(line,'Unknown emotion '+m[3]);
   if(m[1]==='look'&&!['auto','front','away','down'].includes(m[3])&&(!assets.characters?.[m[3]]||m[2]===m[3]))error(line,'Look needs another character or auto/front/away/down');
   add({type:m[1],actor:m[2],value:m[3]},line);continue;
  }
  if(version===2&&(m=s.match(new RegExp(`^activity (${id}) eat (steady|eager)$`)))){
   if(assets.characters?.[m[1]]?.rig?.preset!=='cartoon-v1')error(line,'Eating requires a cartoon-v1 rig');
   add({type:'activity',actor:m[1],kind:'eat',pace:m[2]},line);continue;
  }
  if(version===2&&(m=s.match(new RegExp(`^activity (${id}) (?:walk (left|right) (slow|steady|brisk)|train (${id}) (steady|tiring)|(pause|resume|stop))$`)))){
   const actor=m[1],kind=m[2]?'walk':m[4]?'train':m[6];
   if(!assets.characters?.[actor])error(line,'Unknown activity character');
   if(['walk','train'].includes(kind)&&assets.characters?.[actor]?.rig?.preset!=='cartoon-v1')error(line,'Activities require a cartoon-v1 rig');
   if(kind==='train'&&(!assets.characters?.[m[4]]||m[4]===actor||assets.characters[m[4]].impact!=='anchored'))error(line,'Training needs a distinct anchored practice target');
   add({type:'activity',actor,kind,...(kind==='walk'?{direction:m[2],pace:m[3]}:kind==='train'?{targetActor:m[4],pace:m[5]}:{})},line);continue;
  }
  if(version===2&&(m=s.match(new RegExp(`^scroll (none|${id})$`)))){
   if(m[1]!=='none'&&!assets.characters?.[m[1]])error(line,'Unknown scrolling actor');
   add({type:'scroll',actor:m[1]==='none'?undefined:m[1]},line);continue;
  }
  // A finite performance accompanies the next readable beat; it adds no saved step.
  if(version===2&&(m=s.match(new RegExp(`^perform (${id}) (${id})(?: (${id}))? repeat ([1-6])(?: (steady|tiring))?$`)))){
   const action=ACTIONS[m[2]];
   if(!action)error(line,'Unknown action '+m[2]);
   if(action?.prop&&assets.characters?.[m[1]]?.rig?.preset!=='cartoon-v1')error(line,'Prop actions require a polished or hybrid cartoon-v1 rig');
   if(!assets.characters?.[m[1]]||m[3]&&!assets.characters?.[m[3]])error(line,'Unknown action character');
   if(action?.paired!==!!m[3]||m[1]===m[3])error(line,'Action needs its distinct paired target, or no target for a solo action');
   add({type:'perform',actor:m[1],action:m[2],targetActor:m[3],repeat:+m[4],pace:m[5]||'steady'},line);continue;
  }
  if(version===2&&(m=s.match(new RegExp(`^act (${id}) (${id})(?: (${id}))? "([^"\\n]+)"$`)))){
   const action=ACTIONS[m[2]];
   if(!action)error(line,'Unknown action '+m[2]);
   if(action?.prop&&assets.characters?.[m[1]]?.rig?.preset!=='cartoon-v1')error(line,'Prop actions require a polished or hybrid cartoon-v1 rig');
   if(!assets.characters?.[m[1]]||m[3]&&!assets.characters?.[m[3]])error(line,'Unknown action character');
   if(action?.paired!==!!m[3])error(line,action?.paired?'This action needs a second character':'This action uses one character');
   if(m[1]===m[3])error(line,'An interaction needs two different characters');
   add({type:'act',actor:m[1],action:m[2],targetActor:m[3],text:m[4]},line);continue;
  }
  if(version===2&&s.startsWith('camera ')){
   const parts=s.split(/\s+/).slice(1),shot=parts.shift();let duration;
   if(parts.at(-1)==='cut'){duration=0;parts.pop();}
   else if(parts.at(-2)==='over'){const raw=parts.pop();parts.pop();duration=Number(raw);if(!/^(?:[0-3](?:\.\d{1,3})?)$/.test(raw)||duration>3)error(line,'Camera duration must be 0–3 seconds');}
   if(!CAMERAS.includes(shot))error(line,'Unknown camera shot');
   const pair=['two','action'].includes(shot);
   if(pair?parts.length!==2:parts.length>1||shot==='listener'&&parts.length!==1)error(line,'Use two actors for two/action, and one for listener');
   if(parts.some(a=>!assets.characters?.[a])||pair&&parts[0]===parts[1])error(line,'Camera targets must be known distinct characters');
   add({type:'camera',shot,actor:parts[0],...(parts[1]?{otherActor:parts[1]}:{}),...(duration!==undefined?{duration}: {})},line);continue;
  }
  if(version===2&&(m=s.match(/^ambience (none|hall|wind|rain)$/))){add({type:'ambience',preset:m[1]},line);continue;}
  if(version===2&&(m=s.match(/^environment (none|dust|rain)$/))){add({type:'environment',preset:m[1]},line);continue;}
  if(version===2&&(m=s.match(/^sound (swish|straw|thud|clang|step|chime)$/))){add({type:'sound',preset:m[1]},line);continue;}

  if(version===2&&(m=s.match(new RegExp(`^(rest|react) (${id}) (${id})$`)))){if(!assets.characters?.[m[2]])error(line,'Unknown actor');if(!(m[1]==='rest'?RESTS:RESPONSES).includes(m[3]))error(line,'Unknown '+m[1]+' cue '+m[3]);add({type:m[1],actor:m[2],action:m[3]},line);continue;}
  if(version===2&&(m=s.match(new RegExp(String.raw`^(${id}) \[(${id})(?:, *(${id}))?\]: (.+)$`)))){if(!assets.characters?.[m[1]])error(line,'Unknown speaker');if(!EMOTIONS.includes(m[2]))error(line,'Unknown emotion '+m[2]);if(m[3]&&!TALKS.includes(m[3]))error(line,'Unknown talking animation '+m[3]);add({type:'say',actor:m[1],emotion:m[2],gesture:m[3],text:m[4]},line);continue;}
  if((m=s.match(new RegExp(`^show (${id})(?: (${id}))?(?: (left|center|right))?$`)))){if(!assets.characters?.[m[1]])error(line,'Unknown character '+m[1]);else if(m[2]&&(version===2?!EMOTIONS.includes(m[2]):!assets.characters[m[1]].expressions?.[m[2]]))error(line,'Unknown expression '+m[2]);add({type:'show',actor:m[1],expression:m[2]||'neutral',position:m[3]||'center'},line);continue;}
  if((m=s.match(new RegExp(`^move (${id}) (${MOVES.join('|')})$`)))){if(!assets.characters?.[m[1]])error(line,'Unknown character');add({type:'move',actor:m[1],action:m[2]},line);continue;}
  if((m=s.match(new RegExp(`^effect (${EFFECTS.join('|')})$`)))){add({type:'effect',action:m[1]},line);continue;}
  if((m=s.match(new RegExp(`^choice (${id})$`)))){choice=add({type:'choice',id:m[1],options:[]},line);continue;}
  if((m=s.match(new RegExp(`^goto (${id})$`)))){add({type:'goto',target:m[1]},line);continue;}
  if((m=s.match(new RegExp(`^if (${id}) (==|!=|>=|<=|>|<) (true|false|-?\\d+) -> (${id}) else (${id})$`)))){add({type:'if',variable:m[1],op:m[2],value:value(m[3]),target:m[4],otherwise:m[5]},line);continue;}
  if((m=s.match(new RegExp(`^chance (${id}) (\\d+) -> (${id}) else (${id})$`)))){if(+m[2]>100)error(line,'Chance must be 0–100');add({type:'chance',id:m[1],percent:+m[2],target:m[3],otherwise:m[4]},line);continue;}
  if(s==='end'){add({type:'end'},line);continue;}
  if((m=s.match(new RegExp(`^(I|${id}): (.+)$`)))){if(m[1]!=='I'&&!assets.characters?.[m[1]])error(line,'Unknown speaker');add({type:'say',actor:m[1],text:m[2]},line);continue;}
  error(line,'Unknown command');
 }
 if(Object.keys(variables).length>4)error(1,'Use at most four variables');
 const ids=new Set();for(const n of nodes){if(n.id&&n.type!=='label'){if(ids.has(n.id))error(n.line,'Choice/chance IDs must be unique');ids.add(n.id);}
  if(n.type==='choice'&&(n.options.length<2||n.options.length>6))error(n.line,'A choice needs 2–6 options');
  const options=n.options||[];if(new Set(options.map(o=>o.id)).size!==options.length)error(n.line,'Duplicate option ID');
  for(const target of [n.target,n.otherwise,...options.map(o=>o.target)].filter(Boolean))if(!own(labels,target))error(n.line,'Missing label '+target);
  for(const change of [...options.flatMap(o=>o.changes),...(n.type==='if'?[n]:[])]){const v=variables[change.variable];if(!v)error(n.line,'Unknown variable '+change.variable);else if(typeof v.initial!==typeof change.value||typeof v.initial==='boolean'&&!['=','==','!='].includes(change.op))error(n.line,'Variable type does not match operation');}
 }
 const edges=i=>{const n=nodes[i];return n.type==='end'?[]:n.type==='choice'?n.options.map(o=>labels[o.target]):['if','chance'].includes(n.type)?[labels[n.target],labels[n.otherwise]]:n.type==='goto'?[labels[n.target]]:[i+1];};
 if(!errors.length){const reached=new Set(),active=new Set();const visit=i=>{if(i>=nodes.length){error(lines.length,'A path falls off the script without end');return;}if(active.has(i)){error(nodes[i].line,'Loops are not supported; reconnect branches farther ahead');return;}if(reached.has(i))return;reached.add(i);active.add(i);edges(i).forEach(visit);active.delete(i);};if(nodes.length)visit(0);else error(1,'Add a story');nodes.forEach((n,i)=>{if(!reached.has(i))error(n.line,'Unreachable content');});}
 if(!errors.length&&nodes.some(n=>(['act','perform','prop','express','look','activity','scroll'].includes(n.type)||n.type==='camera'&&['two','action','listener'].includes(n.shot)))){
  const incoming=nodes.map(()=>[]);nodes.forEach((_,i)=>edges(i).forEach(j=>incoming[j].push(i)));
  const cache=new Map();
  const after=i=>{if(cache.has(i))return cache.get(i);const parents=incoming[i].map(after);let visible=parents.length?new Map([...parents[0]].filter(([a,pos])=>parents.every(p=>p.get(a)===pos))):new Map();const n=nodes[i];
   if((['act','perform','prop','express','look','activity','scroll'].includes(n.type)||n.type==='camera'&&['two','action','listener'].includes(n.shot))){for(const a of [n.actor,n.targetActor,n.otherActor,n.type==='look'&&!['auto','front','away','down'].includes(n.value)?n.value:null].filter(Boolean))if(!visible.has(a))error(n.line,'Show '+a+' in a distinct position on every path before this action');}
   if(n.type==='scroll'&&n.actor&&assets.backgrounds?.[visible.get('@background')]?.loop!=='mirror')error(n.line,'Scrolling requires the current background to declare loop: mirror');
   if(n.type==='ensemble')visible=new Map([...visible].filter(([a])=>a==='@background'||n.actors.includes(a)));
   if(n.type==='scene')visible=new Map([['@background',n.asset]]);
   if(n.type==='show'||n.type==='move'&&visible.has(n.actor)&&['left','center','right'].includes(n.action)){const position=n.position||n.action;for(const [a,p]of visible)if(a!=='@background'&&p===position)visible.delete(a);visible.set(n.actor,position);}
   if(n.type==='move'&&n.action==='exit')visible.delete(n.actor);
   cache.set(i,visible);return visible;};nodes.forEach((_,i)=>after(i));
 }
 return {errors,story:errors.length?undefined:{version,nodes,labels,variables}};
}
export function initialStoryState(story,seed=1){return {cursor:0,variables:Object.fromEntries(Object.entries(story.variables).map(([k,v])=>[k,v.initial])),stage:{background:null,actors:{},...(story.version===2?{camera:{shot:'auto'}}:{})},history:[],events:[],seed:seed>>>0,ended:false};}
export function settleStory(story,state){const s=structuredClone(state);s.cues=[];let steps=0;while(!s.ended&&steps++<10000){const n=story.nodes[s.cursor];if(!n)throw Error('Invalid story position');if(['say','choice','act'].includes(n.type)){if(n.type==='act'){const a=s.stage.actors[n.actor],b=s.stage.actors[n.targetActor];if(!a||n.targetActor&&!b)throw Error('Action characters must be on stage');if(ACTIONS[n.action]?.prop){a.prop=ACTIONS[n.action].prop;if(a.activity?.kind==='eat'||a.activity?.kind==='train'&&a.prop!=='sword')delete a.activity;}if(b){const order={left:0,center:1,right:2};a.facing=order[a.position]<order[b.position]?1:-1;b.facing=-a.facing;}}if(story.version===2&&n.type==='say'&&s.stage.actors[n.actor]&&n.emotion)s.stage.actors[n.actor].expression=n.emotion;return s;}
 if(n.type==='end'){s.ended=true;return s;}
 if(['scene','show','move','effect','react','camera','perform','sound'].includes(n.type))s.cues.push(n);
 if(n.type==='scene'){s.stage={background:n.asset,actors:{},...(story.version===2?{camera:{shot:'auto'}}:{})};}
 if(n.type==='show'||n.type==='move'&&n.action==='exit'||n.type==='rest'||n.type==='prop'){for(const [id,a] of Object.entries(s.stage.actors))if(id===n.actor||a.activity?.targetActor===n.actor)delete a.activity;}
 if(n.type==='show'){for(const [id,a] of Object.entries(s.stage.actors))if(id!==n.actor&&a.position===n.position){delete s.stage.actors[id];s.cues.push({type:'move',actor:id,action:'exit'});}s.stage.actors[n.actor]={expression:n.expression,position:n.position,facing:1};}
 if(n.type==='ensemble')s.stage.actors=Object.fromEntries(Object.entries(s.stage.actors).filter(([id])=>n.actors.includes(id)));
 if(n.type==='face'&&s.stage.actors[n.actor])s.stage.actors[n.actor].facing=n.direction;
 if(n.type==='camera')s.stage.camera={shot:n.shot,actor:n.actor,...(n.otherActor?{otherActor:n.otherActor}:{}),...(n.duration!==undefined?{duration:n.duration}:{})};
 if(n.type==='activity'){
  const a=s.stage.actors[n.actor];
  if(n.kind==='stop')delete a.activity;
  else if(n.kind==='pause'||n.kind==='resume'){if(a.activity)a.activity.paused=n.kind==='pause';}
  else{
   // One activity owns each body: starting a new one replaces conflicting work.
   const owners=[n.actor,n.targetActor].filter(Boolean);
   for(const [id,other] of Object.entries(s.stage.actors))if(owners.includes(id)||owners.includes(other.activity?.targetActor))delete other.activity;
   a.activity={kind:n.kind,pace:n.pace,...(n.targetActor?{targetActor:n.targetActor}:{}),...(n.direction?{direction:n.direction}:{}),paused:false};
   a.rest='relaxed';
   if(n.kind==='walk')a.facing=n.direction==='right'?1:-1;
   else if(n.kind==='eat')a.prop='none';
   else{a.prop='sword';const b=s.stage.actors[n.targetActor],order={left:0,center:1,right:2};a.facing=order[a.position]<order[b.position]?1:-1;b.facing=-a.facing;}
  }
 }
 if(n.type==='scroll'){if(n.actor)s.stage.scroll=n.actor;else delete s.stage.scroll;}
 if(n.type==='ambience'||n.type==='environment')s.stage[n.type]=n.preset;
 if(n.type==='express'&&s.stage.actors[n.actor])s.stage.actors[n.actor].expression=n.value;
 if(n.type==='look'&&s.stage.actors[n.actor])s.stage.actors[n.actor].gaze=n.value;
 if(n.type==='perform'){
  const a=s.stage.actors[n.actor],b=s.stage.actors[n.targetActor];
  if(ACTIONS[n.action]?.prop){a.prop=ACTIONS[n.action].prop;if(a.activity?.kind==='eat'||a.activity?.kind==='train'&&a.prop!=='sword')delete a.activity;}
  if(b){const order={left:0,center:1,right:2};a.facing=order[a.position]<order[b.position]?1:-1;b.facing=-a.facing;}
 }
 if(n.type==='prop'&&s.stage.actors[n.actor])s.stage.actors[n.actor].prop=n.prop;
 if(n.type==='rest'&&s.stage.actors[n.actor])s.stage.actors[n.actor].rest=n.action;
 if(n.type==='move'){const a=s.stage.actors[n.actor];if(n.action==='exit')delete s.stage.actors[n.actor];else if(a){if(['left','center','right'].includes(n.action))a.position=n.action;if(n.action==='turn')a.facing*=-1;}}
 for(const a of Object.values(s.stage.actors))if(a.activity?.targetActor&&!s.stage.actors[a.activity.targetActor])delete a.activity;
 if(n.type==='goto'){s.cursor=story.labels[n.target];continue;}
 if(n.type==='if'){const a=s.variables[n.variable],b=n.value;const yes=n.op==='=='?a===b:n.op==='!='?a!==b:n.op==='>'?a>b:n.op==='<'?a<b:n.op==='>='?a>=b:a<=b;s.cursor=story.labels[yes?n.target:n.otherwise];continue;}
 if(n.type==='chance'){let x=s.seed;for(const c of n.id)x=Math.imul(x^c.charCodeAt(0),16777619)>>>0;const yes=x%100<n.percent;s.events.push({id:n.id,yes});s.cursor=story.labels[yes?n.target:n.otherwise];continue;}
 s.cursor++;}if(steps>=10000)throw Error('Story exceeded step limit');return s;}
export function advanceStory(story,state,option){const s=structuredClone(state),n=story.nodes[s.cursor];if(s.ended)throw Error('Story already ended');if(n.type==='say'||n.type==='act'){if(option!==null)throw Error('Expected dialogue advance');s.history.push({actor:n.type==='act'?'I':n.actor,text:n.text});s.cursor++;}else if(n.type==='choice'){const o=n.options.find(o=>o.id===option);if(!o)throw Error('Invalid choice');for(const c of o.changes){const v=story.variables[c.variable];s.variables[c.variable]=c.op==='='?c.value:c.op==='+='?s.variables[c.variable]+c.value:s.variables[c.variable]-c.value;if(typeof c.value==='number')s.variables[c.variable]=Math.max(v.min,Math.min(v.max,s.variables[c.variable]));}s.history.push({actor:'I',text:o.text,choice:{id:n.id,prompt:s.history.at(-1)?.text||'What do I do?',options:n.options.map(({id,text})=>({id,text})),selected:o.id}});s.cursor=story.labels[o.target];}else throw Error('Settle the story before advancing');return settleStory(story,s);}
export function replayStory(story,steps,seed){if(!Array.isArray(steps)||steps.length>5000)throw Error('Invalid attempt');return steps.reduce((s,step)=>advanceStory(story,s,step),settleStory(story,initialStoryState(story,seed)));}
export function validatePackage(pack){const errors=[];if(![1,2].includes(pack?.format)||typeof pack.title!=='string'||!pack.title.trim())errors.push({line:1,message:'A title and package format 1 or 2 are required'});const result=compileStory(pack?.script,pack?.assets);errors.push(...result.errors);if(!Array.isArray(pack?.quiz)||pack.quiz.length!==4||pack.quiz.some(q=>!q.prompt||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=='string'||!o.trim())||!Number.isInteger(q.answer)||q.answer<0||q.answer>3||!q.explanation))errors.push({line:1,message:'Add four questions, each with four answers, a correct answer and explanation'});if(result.story&&result.story.version!==pack.format)errors.push({line:1,message:'Package format must match the story header'});for(const [name,c]of Object.entries(pack?.assets?.characters||{})){if(c.rig){const message=validateRig(c.rig);if(message)errors.push({line:1,message:name+': '+message});if(pack.format!==2)errors.push({line:1,message:'Rigged characters require story 2'});}}return {...result,errors};}
export function quizScore(quiz,answers){if(!Array.isArray(answers)||answers.length!==4||answers.some(a=>!Number.isInteger(a)||a<0||a>3))throw Error('Answer all four questions');return answers.reduce((n,a,i)=>n+(a===quiz[i].answer?25:0),0);}
