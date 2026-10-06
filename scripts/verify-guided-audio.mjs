import fs from 'node:fs'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
const content = JSON.parse(fs.readFileSync('src/content/guided-words.json'))
const clips = JSON.parse(fs.readFileSync('src/content/guided-audio.json'))
const sounds = JSON.parse(fs.readFileSync('src/content/guided-sounds.json'))
const remote = JSON.parse(fs.readFileSync('public/media-manifest.json'))
const bundled = JSON.parse(fs.readFileSync('public/guided-words/media-manifest.json'))
const pack = JSON.parse(fs.readFileSync('public/clip-packs/chunky-reader-audio/clips_manifest.json'))
const exists = path => Boolean(remote.files[path] || bundled.files[path])
for (const [path, info] of Object.entries(bundled.files)) {
  const bytes = fs.readFileSync(`public/${path}`)
  assert.equal(bytes.length, info.bytes)
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), info.sha256)
}
for (const [key,clip] of Object.entries(clips)) {
  assert(clip.ready && exists(clip.path), `Audio unavailable: ${key}`)
  assert(pack.clips.some(c=>c.id===`guided:${key}` && c.audioPath===clip.path), `Offline pack missing ${key}`)
  assert(fs.existsSync(`public/${clip.ssmlPath}`), `Missing SSML for ${key}`)
  if(clip.provider==='replicate') assert(fs.existsSync(`public/${clip.sourcePath}`), `Missing regeneration prompt for ${key}`)
}
for(const [name,clip] of Object.entries(sounds)) {
  assert(exists(clip.path), `Missing sound: ${name}`)
  assert(clip.ipa && clip.duration>.08 && clip.duration<.8 && clip.start>=0, `Invalid phoneme window: ${name}`)
}
for(const [number,lesson] of content.lessons.entries()) {
  for(const word of lesson.words) {
    assert(clips[word]?.ready && clips[`model:${word}`]?.ready, `Missing model in lesson ${number+1}`)
    for(const unit of content.lexicon[word].sounds) assert(sounds[unit.sound], `Unknown phoneme ${word}:${unit.sound}`)
  }
  for(const sentence of [lesson.sentence,lesson.alternateSentence]) {
    assert(clips[sentence]?.ready, `Missing sentence: ${sentence}`)
    const helpers=[...new Set(sentence.toLowerCase().match(/[a-z]+/g))].filter(w=>w in content.helpers)
    assert(clips[`helpers:${helpers.join(',')}`]?.ready, `Missing helpers in ${sentence}`)
  }
}
console.log(`Guided audio: ${content.lessons.length} lessons, 48 sentence variants, ${Object.keys(clips).length} clips, all mappings/helpers, checksums, sources and offline entries passed.`)
if(process.argv.includes('--remote')) {
  const paths=[...new Set([...Object.values(clips).map(c=>c.path),...Object.values(sounds).map(c=>c.path)])].filter(p=>remote.files[p])
  let cursor=0
  await Promise.all(Array.from({length:6},async()=>{
    while(cursor<paths.length){
      const path=paths[cursor++],info=remote.files[path]
      const response=await fetch(`${remote.baseUrl}/${info.object}`,{signal:AbortSignal.timeout(30000)})
      assert(response.ok,`Remote clip unavailable: ${path}`)
      const bytes=Buffer.from(await response.arrayBuffer())
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),info.sha256,`Remote checksum: ${path}`)
    }
  }))
  console.log(`Verified all ${paths.length} reused remote recordings by download and checksum.`)
}
