import fs from 'node:fs'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import Replicate from 'replicate'
import {compileStory} from '../../src/story2/engine/story-engine.js'
const ids=['marians-bun-run-v1','marians-red-kite-v1','chengdu-boat-v1'],root='public/stories/adventures/v1',model='google/gemini-3.1-flash-tts'
const dry=process.argv.includes('--dry-run'),replicate=dry?null:new Replicate({auth:process.env.REPLICATE_API_TOKEN||fs.readFileSync(process.env.HOME+'/.claude/replicate-token','utf8').trim()})
const jobs=new Map(),packs=[]
for(const id of ids){const pack=JSON.parse(fs.readFileSync(`${root}/${id}.json`));packs.push(pack);const {story}=compileStory(pack.script,pack.assets);const requests=[...pack.focusWords.map(text=>({text,actor:'I'})),{text:'What next?',actor:'I'},...story.nodes.filter(n=>n.type==='say'),...story.nodes.filter(n=>n.type==='choice').map(n=>({text:n.options.map(o=>o.text).join(' '),actor:'I'}))];pack.dialogueAudio||={}
 for(const n of requests){const voice=n.actor==='Anna'?'Leda':n.actor==='Sarah'?'Zephyr':n.actor==='Marian'?'Achernar':'Leda';const prompt=n.actor==='Anna'||n.actor==='Sarah'?`Perform ${n.actor}, a little girl in a gentle children's story. Use a light, youthful, higher-register voice with a smiling, playful quality and clear American English. ${n.actor==='Sarah'?'She is the younger sister: small, bright and bubbly.':'She is the older sister: sweet, curious and lively.'} Speak at an easy pace for a beginning reader. Natural expressive speech, never squeaky or shrill. Say only the supplied words. No introduction, music or sound effects.`:n.actor==='Marian'?"Read as Maid Marian, a kind, playful fox in a gentle storybook. Light, soft female voice, clear English, warm and expressive. Easy pace for a beginning reader. Say only the supplied text. No music, extra words, or sound effects.":'Read the supplied text only in a bright, gentle female voice, clear American English, at an easy pace for a beginning reader. No introduction, extra words, music or sound effects.';
 const input={text:n.text,voice,language_code:'en-US',prompt};const hash=crypto.createHash('sha256').update(JSON.stringify({model,input})).digest('hex').slice(0,20);const base=`stories/adventures/v1/audio/new-pals-v1/${hash}`;const audio=`${base}.mp3`;jobs.set(hash,{input,base,audio});pack.audio[n.text]=audio;if(n.actor!=='I'){pack.dialogueAudio[n.actor]||={};pack.dialogueAudio[n.actor][n.text]=audio}
 }
}
const pending=[...jobs.values()].filter(j=>!fs.existsSync(`public/${j.audio}`));console.log(`${pending.length} recordings pending (${jobs.size} distinct clips).`)
if(dry)process.exit(0)
if(pending.length&&!process.env.FFMPEG_PATH)throw Error('Set FFMPEG_PATH before any paid requests')
let cursor=0,failed=0,done=0
await Promise.all(Array.from({length:3},async()=>{while(cursor<pending.length){const job=pending[cursor++];try{const output=await replicate.run(model,{input:job.input});const bytes=Buffer.from(await new Response(output).arrayBuffer());if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.length<1000)throw Error('Invalid WAV');fs.mkdirSync(`${root}/audio/new-pals-v1`,{recursive:true});if(!process.env.FFMPEG_PATH)throw Error('Set FFMPEG_PATH');fs.mkdirSync('.migration/new-adventure-audio',{recursive:true});const source='.migration/new-adventure-audio/'+job.base.split('/').pop()+'.wav';fs.writeFileSync(source,bytes);execFileSync(process.env.FFMPEG_PATH,['-v','error','-y','-i',source,'-ac','1','-ar','24000','-b:a','64k',`public/${job.audio}`]);fs.writeFileSync(`public/${job.base}.json`,JSON.stringify({model,input:job.input},null,2)+'\n');done++;if(done%10===0)console.log(`Recorded ${done}/${pending.length}`)}catch{failed++;console.log(`Failed: ${job.input.text}`)}}}))
// Never publish dangling audio references.
if(!failed)for(const pack of packs)fs.writeFileSync(`${root}/${pack.id}.json`,JSON.stringify(pack,null,2)+'\n')
console.log(`${done} recorded; ${failed} failed.`);if(failed)process.exitCode=1
