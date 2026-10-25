// Offline narration fallback. Azure SSML is preserved for future voice regeneration.
import fs from 'node:fs'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {compileStory} from '../../src/story2/engine/story-engine.js'
import {createAzureSsml,escapeXml,TTS_VOICES} from '../tts-config.mjs'
const dir='public/stories/adventures/v1'
const ffmpeg=process.env.FFMPEG_PATH
if(!ffmpeg)throw Error('Set FFMPEG_PATH before generating clips')
fs.mkdirSync(`${dir}/audio`,{recursive:true});fs.mkdirSync(`${dir}/ssml`,{recursive:true})
let total=0
const ids=process.argv.slice(2)
if(!ids.length)throw Error('Pass explicit unreleased adventure IDs; published packages must remain unchanged')
for(const id of ids){
 const file=`${dir}/${id}.json`,pack=JSON.parse(fs.readFileSync(file));const {story}=compileStory(pack.script,pack.assets)
 const texts=new Set([...pack.focusWords,'What next?',...story.nodes.filter(n=>n.text).map(n=>n.text),...story.nodes.filter(n=>n.type==='choice').map(n=>n.options.map(o=>o.text).join(' '))])
 pack.audio={}
 for(const text of texts){const hash=crypto.createHash('sha256').update('samantha-145-v1:'+text).digest('hex').slice(0,16);const path=`stories/adventures/v1/audio/${hash}.mp3`;pack.audio[text]=path
 fs.writeFileSync(`${dir}/ssml/${hash}.ssml`,createAzureSsml({voice:TTS_VOICES.anneNarrator,body:escapeXml(text)}))
 if(!fs.existsSync(`public/${path}`)){execFileSync('/usr/bin/say',['-v','Samantha','-r','145','-o',`/tmp/${hash}.aiff`,text]);execFileSync(ffmpeg,['-v','error','-y','-i',`/tmp/${hash}.aiff`,'-ar','24000','-ac','1','-b:a','48k',`public/${path}`]);if(fs.statSync(`public/${path}`).size<1000)throw Error('Empty narration');total++}
 }
 fs.writeFileSync(file,JSON.stringify(pack,null,2)+'\n')
}
console.log(`Generated ${total} cached Samantha narration clips; retained Azure SSML.`)
