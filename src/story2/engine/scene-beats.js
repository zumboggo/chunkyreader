/** Deterministic scene direction; never changes story variables or outcomes. */
export const SCENE_BEATS = {
 'private-confession': {name:'Private confession',description:'A hesitant admission with a quiet, attentive listener.',emotions:['embarrassed','worried'],rests:['downcast','attentive'],responses:['sigh','nod'],shot:'wide'},
 disagreement: {name:'Disagreement',description:'A firm challenge meets a guarded response.',emotions:['determined','skeptical'],rests:['attentive','guarded'],responses:['point','shake-head'],shot:'wide'},
 'awkward-arrival': {name:'Awkward arrival',description:'An uncertain arrival and a small welcoming gesture.',emotions:['embarrassed','curious'],rests:['guarded','attentive'],responses:['shrug','wave'],shot:'wide'},
 reassurance: {name:'Reassurance',description:'A worried character receives a calm, affirmative response.',emotions:['worried','relieved'],rests:['downcast','attentive'],responses:['sigh','nod'],shot:'wide'},
 revelation: {name:'Revelation',description:'A discovery lands; hold on the listener’s surprise.',emotions:['determined','shocked'],rests:['attentive','attentive'],responses:['nod','shock'],shot:'wide'},
 reconciliation: {name:'Reconciliation',description:'Both soften and acknowledge one another.',emotions:['relieved','happy'],rests:['relaxed','attentive'],responses:['nod','nod'],shot:'wide'},
 'shared-laughter': {name:'Shared laughter',description:'Release tension with a shared belly laugh.',emotions:['laughing','laughing'],rests:['relaxed','relaxed'],responses:['laugh','laugh'],shot:'wide'},
 'quiet-aftermath': {name:'Quiet aftermath',description:'Let a consequence settle without another large gesture.',emotions:['sad','worried'],rests:['downcast','attentive'],responses:[null,null],shot:'wide'},
};
export function sceneBeatCommand(preset,actor,listener,caption){
 if(!Object.hasOwn(SCENE_BEATS,preset))throw Error('Choose a known scene beat');
 if(![actor,listener].every(s=>/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s))||actor===listener)throw Error('Choose two different characters');
 if(typeof caption!=='string'||!caption.trim()||/["\r\n]/.test(caption))throw Error('Use a one-line caption without double quotes');
 return `beat ${preset} ${actor} ${listener} "${caption.trim()}"`;
}
export function expandSceneBeat(preset,actor,listener,text){
 const b=SCENE_BEATS[preset];
 return [{type:'ensemble',actors:[actor,listener]},
 ...[actor,listener].flatMap((id,i)=>[{type:'show',actor:id,expression:b.emotions[i],position:i?'right':'left'},{type:'rest',actor:id,action:b.rests[i]},{type:'face',actor:id,direction:i?-1:1}]),
 {type:'camera',shot:b.shot},
 {type:'say',actor:'I',text,beat:preset,beatResponses:Object.fromEntries([actor,listener].map((id,i)=>[id,b.responses[i]]).filter(([,r])=>r))}];
}
