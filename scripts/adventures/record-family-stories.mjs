// Remaster only these five released stories. Preserve scripts, IDs and progress.
// Usage: node scripts/adventures/record-family-stories.mjs [--dry-run]
// Edge: EDGE_TTS_PYTHON=/path/to/python node scripts/adventures/record-family-stories.mjs --edge
// Install edge-tts==7.3.1 in an isolated Python environment first. No paid fallback.
// Azure credentials: AZURE_SPEECH_KEY + AZURE_SPEECH_REGION, or AZURE_TTS_CONFIG_PATH.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {compileStory} from '../../src/story2/engine/story-engine.js'
import {createAzureSsml, escapeXml, TTS_OUTPUT_FORMAT} from '../tts-config.mjs'
const ids=['leahs-big-day-v1','the-toy-pup-v1','the-box-boat-v1','the-red-hen-v1','a-tent-for-us-v1']
const root='public/stories/adventures/v1'
const edge=process.argv.includes('--edge')
const folder=`stories/adventures/v1/audio/family-${edge?'edge':'azure'}-v1`
const ledgerPath='.migration/family-azure-spend.json'
const cap=0.15
const dry=process.argv.includes('--dry-run')
const jobs=new Map(), packs=[]
for(const id of ids){
  const pack=JSON.parse(fs.readFileSync(`${root}/${id}.json`,'utf8'))
  const {story,errors}=compileStory(pack.script,pack.assets)
  if(errors.length)throw Error(`Invalid story ${id}`)
  const requests=[...pack.focusWords.map(text=>({text,actor:'I'})),{text:'What next?',actor:'I'},...story.nodes.filter(n=>n.type==='say'),...story.nodes.filter(n=>n.type==='choice').map(n=>({text:n.options.map(o=>o.text).join(' '),actor:'I'}))]
  pack.audio={};pack.dialogueAudio={}
  for(const n of requests){
    const voice=['Anna','Sarah','Leah'].includes(n.actor)?'en-US-AnaNeural':'en-US-JennyNeural'
    const ssml=createAzureSsml({voice,rate:'-8%',pitch:edge?'+0Hz':'+2%',body:escapeXml(n.text)})
    const hash=crypto.createHash('sha256').update(JSON.stringify({ssml,format:TTS_OUTPUT_FORMAT})).digest('hex').slice(0,20)
    const audio=`${folder}/${hash}.mp3`
    // Reserve text plus a generous allowance for optional prosody values.
    const characters=Array.from(n.text).length+20
    jobs.set(hash,{hash,text:n.text,voice,ssml,audio,characters})
    pack.audio[n.text]=audio
    if(n.actor!=='I'){
      pack.dialogueAudio[n.actor]||={}
      pack.dialogueAudio[n.actor][n.text]=audio
    }
  }
  packs.push(pack)
}
const valid=j=>fs.existsSync(`public/${j.audio}`)&&fs.statSync(`public/${j.audio}`).size>500&&fs.existsSync(`public/${folder}/${j.hash}.ssml`)
const pending=[...jobs.values()].filter(j=>!valid(j))
console.log(JSON.stringify({clips:jobs.size,pending:pending.length,textCharacters:[...jobs.values()].reduce((s,j)=>s+j.text.length,0),reservedCharacters:pending.reduce((s,j)=>s+j.characters,0),capUSD:cap}))
if(dry)process.exit(0)
if(edge){
  fs.mkdirSync('.migration',{recursive:true})
  const manifest='.migration/family-edge-jobs.json'
  fs.writeFileSync(manifest,JSON.stringify(pending))
  execFileSync(process.env.EDGE_TTS_PYTHON||'python3',['scripts/adventures/record-family-edge.py',manifest],{stdio:'inherit'})
  if(![...jobs.values()].every(valid))throw Error('Missing Edge audio; packages left unchanged')
  for(const pack of packs)fs.writeFileSync(`${root}/${pack.id}.json`,JSON.stringify(pack,null,2)+'\n')
  console.log('Updated all five stories with Edge Jenny/Ana. API cost: $0.00.')
  process.exit(0)
}
let key=process.env.AZURE_SPEECH_KEY||process.env.SPEECH_KEY
let region=process.env.AZURE_SPEECH_REGION||process.env.SPEECH_REGION
if(!key||!region){
  const configPath=process.env.AZURE_TTS_CONFIG_PATH||path.join(os.homedir(),'Documents/azure-tts-ssml/config.json')
  if(!fs.existsSync(configPath))throw Error('Azure credentials missing; set AZURE_TTS_CONFIG_PATH or Azure Speech environment variables.')
  const c=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/u,''))
  key=c.SubscriptionKey||c.subscriptionKey||c.key||c.speechKey
  region=c.ServiceRegion||c.serviceRegion||c.region||c.speechRegion
}
if(!key||!/^[a-z0-9]+$/.test(region))throw Error('Invalid Azure credential configuration')
// Verify the exact region's current USD retail meter before any paid call.
const filter=`meterName eq 'S1 Neural Text To Speech Characters' and armRegionName eq '${region}'`
const response=await fetch('https://prices.azure.com/api/retail/prices?'+new URLSearchParams({'$filter':filter}),{signal:AbortSignal.timeout(30000)})
if(!response.ok)throw Error('Cannot verify Azure price')
const prices=await response.json()
const meters=prices.Items.filter(i=>i.currencyCode==='USD'&&i.unitOfMeasure==='1M'&&i.type==='Consumption'&&i.retailPrice>0)
if(!meters.length||prices.NextPageLink)throw Error('No unambiguous USD regional price found')
const rate=Math.max(...meters.map(i=>i.retailPrice))/1e6
const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):{reservedUSD:0,attempts:[]}
const projected=ledger.reservedUSD+pending.reduce((s,j)=>s+j.characters*rate,0)
if(projected>=cap)throw Error(`Budget guard: projected reservation $${projected.toFixed(5)} exceeds cap`)
console.log(`Verified ${region}: $${rate*1e6}/million; cumulative reservation $${projected.toFixed(5)} (cap $${cap}).`)
fs.mkdirSync(path.dirname(ledgerPath),{recursive:true})
fs.mkdirSync(`public/${folder}`,{recursive:true})
let done=0
for(const j of pending){
  // Persist before sending: interrupted/failed requests count too. No automatic retries.
  ledger.reservedUSD+=j.characters*rate
  ledger.attempts.push({hash:j.hash,characters:j.characters,reservedUSD:j.characters*rate,date:new Date().toISOString()})
  fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n')
  const r=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{
    method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':TTS_OUTPUT_FORMAT,'User-Agent':'chunky-reader-audio-generator'},body:j.ssml,signal:AbortSignal.timeout(30000)
  })
  if(!r.ok)throw Error(`Azure request failed: HTTP ${r.status}; stopped without retry`)
  const bytes=Buffer.from(await r.arrayBuffer())
  if(bytes.length<500||!(bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224)))throw Error('Invalid MP3 response')
  fs.writeFileSync(`public/${j.audio}`,bytes)
  fs.writeFileSync(`public/${folder}/${j.hash}.ssml`,j.ssml)
  if(++done%10===0)console.log(`Recorded ${done}/${pending.length}`)
}
if(![...jobs.values()].every(valid))throw Error('Missing audio; packages left unchanged')
for(const pack of packs)fs.writeFileSync(`${root}/${pack.id}.json`,JSON.stringify(pack,null,2)+'\n')
console.log(`Updated all five stories. Total reserved cost: $${ledger.reservedUSD.toFixed(5)}.`)
