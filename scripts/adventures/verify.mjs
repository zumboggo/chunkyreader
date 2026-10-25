import fs from 'node:fs'
import assert from 'node:assert/strict'
import {compileStory,replayStory,advanceStory} from '../../src/story2/engine/story-engine.js'
import {validateRig} from '../../src/story2/engine/acting-library.js'
for(const id of ['pigs-hat-v1','elsas-pet-v1','annas-new-pals-v1','hat-on-the-run-v1']){
 const p=JSON.parse(fs.readFileSync(`public/stories/adventures/v1/${id}.json`));const {errors,story}=compileStory(p.script,p.assets);assert.deepEqual(errors,[])
 for(const c of Object.values(p.assets.characters))if(c.rig)assert.equal(validateRig(c.rig),null)
 let endings=0
 function visit(steps=[],choices=[]){assert(steps.length<30);const s=replayStory(story,steps,1),n=story.nodes[s.cursor];
  if(s.ended){endings++;assert.equal(choices.length,3);const prose=s.history.map(h=>h.text).join(' ');if(id==='pigs-hat-v1'){assert(prose.includes(choices[0]==='pot'?'A pot for a hat.':'A hat for a pig.'));assert.equal(s.stage.background,choices[0]==='pot'?'pig-pot':'pig-hat')}else if(id==='elsas-pet-v1'){assert.equal(s.variables.hen,choices[0]==='hen');assert.equal(s.variables.tub,choices[1]==='tub');assert(prose.includes(choices[1]==='tub'?'A tub is a bed.':'A box is a bed.'));assert.equal(s.stage.background,`${choices[0]}-${choices[1]}`)}else if(id==='annas-new-pals-v1'){assert.equal(s.variables.leaf,choices[1]==='leaf');assert.equal(s.stage.background,choices[1]==='leaf'?'anne-leaf-tea':'anne-shell-tea');assert(prose.includes('Yes! You, Diana, and me!'));assert(prose.includes(choices[2]==='sip'?'A sip for Sir Bug!':'Off you go, bug!'))}else{assert.equal(s.variables.net,choices[1]==='net');assert(prose.includes(choices[1]==='net'?'A net, a hat, and my pals.':'A stick, a hat, and my pals.'));assert(prose.includes(choices[2]==='duck'?'Quack! A club of ducks!':'Hats off to our club!'));assert.equal(s.stage.background,'anne-hat-safe')}return}
  assert.equal(typeof n.text==='string'||n.type==='choice',true)
  if(id==='annas-new-pals-v1'||id==='hat-on-the-run-v1')assert.deepEqual(Object.keys(s.stage.actors).sort(),['Anna','Anne','Diana'])
  if(n.type==='say'&&n.actor!=='I')assert(s.stage.actors[n.actor],`Absent speaker ${n.actor}`)
  if(n.text)assert(p.audio[n.text],`Missing audio ${n.text}`)
  if(n.type==='choice'){assert.equal(n.options.length,2);assert(p.audio[n.options.map(o=>o.text).join(' ')]);for(const o of n.options){const next=advanceStory(story,s,o.id);assert.deepEqual(replayStory(story,[...steps,o.id],1),next);visit([...steps,o.id],[...choices,o.id])}}
  else {assert.deepEqual(replayStory(story,[...steps,null],1),advanceStory(story,s,null));visit([...steps,null],choices)}
 }
 visit();assert.equal(endings,8);for(const word of p.focusWords)assert(p.audio[word]);assert.equal(p.focusWords.length,5)
 let bytes=Buffer.byteLength(JSON.stringify(p));for(const path of new Set([...Object.values(p.audio),...Object.values(p.assets.backgrounds).map(a=>a.src),...Object.values(p.assets.characters).flatMap(c=>Object.values(c.expressions).map(a=>a.src))])){assert(fs.existsSync(`public/${path}`),path);bytes+=fs.statSync(`public/${path}`).size}assert(bytes<5_000_000)
 assert(fs.existsSync(`public/stories/adventures/v1/${id}-intro.poster.jpg`))
 const check=JSON.parse(fs.readFileSync(`public/stories/adventures/v1/${id}-intro.checks.json`));assert.equal(check.hold_seconds,3);assert.equal(check.total_seconds,9);assert(check.audio_starts_after_hold);assert(check.audio_non_silent)
 console.log(`${id}: 8 routes, three binary choices each, every beat replay/resume, callbacks, audio and ${bytes} byte media budget verified.`)
}
