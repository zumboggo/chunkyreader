// Optional synthetic-audio QA; never sends recordings of a child.
// Run after generation while the ignored lossless WAV files are available.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Replicate from 'replicate'
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN || fs.readFileSync(path.join(process.env.HOME,'.claude/replicate-token'),'utf8').trim() })
const model = 'openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e'
const clips = Object.entries(JSON.parse(fs.readFileSync('src/content/guided-audio.json')))
  .filter(([key, clip]) => clip.provider === 'replicate' && key !== 'phoneme:schwa')
fs.mkdirSync('.migration', { recursive:true })
function pcm(file) {
  const wave=fs.readFileSync(file)
  for(let at=12;at+8<wave.length;){
    const size=wave.readUInt32LE(at+4),type=wave.toString('ascii',at,at+4)
    if(type==='fmt ' && (wave.readUInt16LE(at+8)!==1 || wave.readUInt16LE(at+10)!==1 || wave.readUInt32LE(at+12)!==24000 || wave.readUInt16LE(at+22)!==16)) throw new Error('Expected mono 24kHz PCM16 WAV')
    if(type==='data') return wave.subarray(at+8,at+8+size)
    at+=8+size+size%2
  }
  throw new Error('No PCM data')
}
const batches=[]
for(let at=0;at<clips.length;at+=25){
  const items=clips.slice(at,at+25).map(([key,clip])=>({key,clip,text:JSON.parse(fs.readFileSync(`public/${clip.sourcePath}`)).input.text}))
  const data=Buffer.concat(items.flatMap(({clip})=>[pcm(`public/${clip.path.replace(/\.m4a$/,'.wav')}`),Buffer.alloc(24000*2*.5)]))
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(data.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16)
  header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40)
  const bytes=Buffer.concat([header,data]),hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16)
  const base=`.migration/guided-qa-${hash}`
  fs.writeFileSync(`${base}.wav`,bytes)
  fs.writeFileSync(`${base}-expected.json`,JSON.stringify(items.map(({key,text})=>({key,text})),null,2)+'\n')
  batches.push(base)
}
let cursor=0
await Promise.all(Array.from({length:2},async()=>{
  while(cursor<batches.length){
    const base=batches[cursor++]
    if(fs.existsSync(`${base}-transcript.json`))continue
    const output=await replicate.run(model,{input:{audio:fs.readFileSync(`${base}.wav`),language:'en',condition_on_previous_text:false,transcription:'plain text',temperature:0}})
    fs.writeFileSync(`${base}-transcript.json`,JSON.stringify(output,null,2)+'\n')
    console.log(`Transcribed ${base}`)
  }
}))
console.log(`${clips.length} clips in ${batches.length} QA batches. Compare expected text and transcripts in .migration/guided-qa-*.json; ASR differences require review, not automatic rejection.`)
