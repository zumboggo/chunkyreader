import fs from 'node:fs'
import assert from 'node:assert/strict'
import {compileStory,replayStory,advanceStory} from '../../src/story2/engine/story-engine.js'
import {validateRig} from '../../src/story2/engine/acting-library.js'
const ids=['marians-bun-run-v1','marians-red-kite-v1','chengdu-boat-v1']
for(const id of ids){
 const p=JSON.parse(fs.readFileSync(`public/stories/adventures/v1/${id}.json`));const {story,errors}=compileStory(p.script,p.assets);assert.deepEqual(errors,[]);assert.equal(p.focusWords.length,5)
 assert.equal(p.assets.characters.Anna.rig.palette.shirt,'#efa8bd');assert.equal(p.assets.characters.Sarah.rig.palette.shirt,'#b69cdb')
 for(const c of Object.values(p.assets.characters))if(c.rig)assert.equal(validateRig(c.rig),null)
 const routes=[]
 function visit(steps=[],choices=[],words=0){assert(steps.length<30);const state=replayStory(story,steps,1);if(state.ended){assert.equal(choices.length,3);const prose=state.history.map(h=>h.text).join(' ');if(id==='marians-bun-run-v1'){assert(prose.includes(choices[0]==='leaf'?'A leaf lid and a shared bun!':'A bun hat and a shared bun!'));assert(prose.includes(choices[1]==='log'?'Slow steps work!':'But dry feet!'));assert(prose.includes(choices[2]==='two'?'Two big grins!':'Crumbs for the birds!'))}else if(id==='marians-red-kite-v1'){assert.equal(state.stage.background,choices[1]==='leaf'?'marian-kite-leaf':'marian-kite-bow');assert(prose.includes(choices[0]==='stick'?'Lift, do not tug.':'I hold this twig.'));assert(prose.includes(choices[2]==='run'?'Run, run!':'Wait... Now!'))}else{assert.equal(state.stage.background,choices[2]==='leaf'?'chengdu-ant-leaf':'chengdu-ant-stone');assert(prose.includes(choices[0]==='leaf'?'A leaf ship!':'A pink ship!'));assert(prose.includes(choices[1]==='stick'?'One soft push.':'More water!'))}routes.push(words);return}
  const n=story.nodes[state.cursor];assert(n.type==='say'||n.type==='choice');for(const actor of ['Anna','Sarah'])assert(state.stage.actors[actor],`Missing ${actor} on ${n.line}`)
  if(n.type==='say'){assert(p.audio[n.text]);if(n.actor!=='I'){assert(state.stage.actors[n.actor]);assert(p.dialogueAudio[n.actor]?.[n.text]);}assert.deepEqual(replayStory(story,[...steps,null],1),advanceStory(story,state,null));visit([...steps,null],choices,words+n.text.split(/\s+/).length)}
  else{assert.equal(n.options.length,2);assert(p.audio[n.options.map(o=>o.text).join(' ')]);for(const o of n.options){assert.deepEqual(replayStory(story,[...steps,o.id],1),advanceStory(story,state,o.id));visit([...steps,o.id],[...choices,o.id],words+o.text.split(/\s+/).length)}}
 }
 visit();assert.equal(routes.length,8);assert(Math.max(...routes)<170)
 for(const word of p.focusWords)assert(p.audio[word]);assert.equal(p.intro.kind,'still')
 const assets=new Set([p.cover,p.intro.src,...Object.values(p.audio),...Object.values(p.dialogueAudio).flatMap(a=>Object.values(a)),...Object.values(p.assets.backgrounds).map(a=>a.src),...Object.values(p.assets.characters).flatMap(c=>Object.values(c.expressions).map(a=>a.src))]);let bytes=Buffer.byteLength(JSON.stringify(p));for(const a of assets){assert(fs.existsSync('public/'+a),a);const size=fs.statSync('public/'+a).size;assert(size>0);bytes+=size}assert(bytes<5_000_000,`${bytes} bytes exceeds package budget`)
 console.log(`${id}: 8 routes, all resume states/callbacks/voices, ${Math.min(...routes)}–${Math.max(...routes)} words per route, ${(bytes/1e6).toFixed(2)} MB.`)
}
