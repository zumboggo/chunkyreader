import fs from 'node:fs'
import assert from 'node:assert/strict'
import {compileStory,replayStory,advanceStory} from '../../src/story2/engine/story-engine.js'
for(const id of ['the-box-boat-v1','the-red-hen-v1','a-tent-for-us-v1']){
 const p=JSON.parse(fs.readFileSync(`public/stories/adventures/v1/${id}.json`));const {story,errors}=compileStory(p.script,p.assets);assert.deepEqual(errors,[]);assert.equal(p.focusWords.length,5)
 let routes=0;const lengths=[]
 function visit(steps=[],choices=[]){assert(steps.length<35);const state=replayStory(story,steps,1)
  if(state.ended){routes++;assert.equal(choices.length,3);const prose=state.history.map(h=>h.text).join(' ');const words=prose.match(/[A-Za-z]+/g);lengths.push(words.length);assert(words.length<170);const nonNames=words.filter(w=>!['Anna','Sarah','Leah','Mum'].includes(w));assert(nonNames.filter(w=>w.length<=4).length/nonNames.length>.85,'Keep overwhelmingly short words');const callbacks={
 'the-box-boat-v1':[['bear','Our bear had a big day.','Our pup had a big day.'],['rug','The rug is our boat, too!','The toy can sit by the box.'],['sea','A big fish!','Time for a cup of tea!']],
 'the-red-hen-v1':[['sit','I sit. I can wait.','More room for you, hen.'],['seed','A meal and a new pal!','A tune and a new pal!'],['wave','Bye, hen!','A little nod.']],
 'a-tent-for-us-v1':[['book','A book for us all.','A hug for our bear, too!'],['flap','A wide way in.','A warm light.'],['peek','Peek-a-boo!','One big hug!']]
 };callbacks[id].forEach(([option,yes,no],i)=>assert(prose.includes(choices[i]===option?yes:no)));
 return}
  assert.deepEqual(Object.keys(state.stage.actors).sort(),['Anna','Leah','Sarah']);const n=story.nodes[state.cursor];if(n.type==='say'){assert(p.audio[n.text]);assert.deepEqual(advanceStory(story,state,null),replayStory(story,[...steps,null],1));visit([...steps,null],choices)}else{assert.equal(n.type,'choice');assert.equal(n.options.length,2);assert(p.audio[n.options.map(o=>o.text).join(' ')]);for(const o of n.options){assert.deepEqual(advanceStory(story,state,o.id),replayStory(story,[...steps,o.id],1));visit([...steps,o.id],[...choices,o.id])}}
 }
 visit();assert.equal(routes,8);for(const word of p.focusWords)assert(p.audio[word]);let bytes=Buffer.byteLength(JSON.stringify(p));for(const file of new Set([p.cover,p.intro.src,...Object.values(p.audio),...Object.values(p.assets.backgrounds).map(a=>a.src),...Object.values(p.assets.characters).flatMap(c=>Object.values(c.expressions).map(a=>a.src))])){assert(fs.existsSync('public/'+file),file);bytes+=fs.statSync('public/'+file).size}assert(bytes<5_000_000);console.log(`${id}: eight routes, resume, callbacks, audio, short-word check; ${Math.min(...lengths)}–${Math.max(...lengths)} words; ${(bytes/1e6).toFixed(2)} MB`)
}
