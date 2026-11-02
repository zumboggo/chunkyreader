// Regenerate only Anna/Sarah dialogue. Cache by full input; never expose credentials.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Replicate from 'replicate'
import {compileStory} from '../../src/story2/engine/story-engine.js'
const model='google/gemini-3.1-flash-tts'
const dir='public/stories/adventures/v1'
const dry=process.argv.includes('--dry-run')
const replicate=dry?null:new Replicate({auth:process.env.REPLICATE_API_TOKEN||fs.readFileSync(process.env.REPLICATE_TOKEN_PATH||path.join(process.env.HOME,'.claude/replicate-token'),'utf8').trim()})
let count=0, failed=0
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){
 const pack=JSON.parse(fs.readFileSync(`${dir}/${file}`));if(!pack.script||!pack.assets)continue
 const {story,errors}=compileStory(pack.script,pack.assets);if(!story)throw Error(`Invalid story ${file}: ${errors?.length}`)
 const clips={...pack.dialogueAudio}
 for(const node of story.nodes.filter(n=>n.type==='say'&&['Anna','Sarah'].includes(n.actor))){
  const input={text:node.text,voice:node.actor==='Anna'?'Leda':'Zephyr',language_code:'en-US',prompt:`Perform ${node.actor}, a little girl in a gentle children's story. Use a light, youthful, higher-register voice with a smiling, playful quality and clear American English. ${node.actor==='Sarah'?'She is the younger sister: small, bright and bubbly.':'She is the older sister: sweet, curious and lively.'} Speak at an easy pace for a beginning reader. Natural expressive speech, never squeaky or shrill. Say only the supplied words. No introduction, music or sound effects.`}
  const hash=crypto.createHash('sha256').update(JSON.stringify({model,input})).digest('hex').slice(0,20)
  const base=`stories/adventures/v1/audio/family-v2/${hash}`
  if(!fs.existsSync(`public/${base}.wav`)){
   if(dry){count++;continue}
   let output
   try { output=await replicate.run(model,{input}) } catch { failed++; console.log(`Could not record ${node.actor}: ${node.text}`); continue }
   const bytes=Buffer.from(await new Response(output).arrayBuffer())
   if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.length<1000)throw Error('Invalid WAV response')
   fs.mkdirSync(path.dirname(`public/${base}.wav`),{recursive:true})
   fs.writeFileSync(`public/${base}.wav`,bytes)
   fs.writeFileSync(`public/${base}.json`,JSON.stringify({model,input},null,2)+'\n')
   console.log(`Recorded ${node.actor}: ${node.text}`);count++
  }
  clips[node.actor]={...clips[node.actor],[node.text]:`${base}.wav`}
 }
 if(!dry){pack.dialogueAudio=clips;fs.writeFileSync(`${dir}/${file}`,JSON.stringify(pack,null,2)+'\n')}
}
console.log(`${dry?'Pending':'Generated'} ${count} dialogue clips.`)

if(failed){console.log(`${failed} clips need review; original narration remains available.`);process.exitCode=1}
