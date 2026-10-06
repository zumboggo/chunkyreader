// Incremental Azure clip generation. Keeps SSML; never logs credentials or response bodies.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { TTS_VOICES, TTS_VOICE_VERSIONS, TTS_OUTPUT_FORMAT, createAzureSsml, escapeXml } from './tts-config.mjs'
const content = JSON.parse(fs.readFileSync('src/content/guided-words.json'))
const sounds = JSON.parse(fs.readFileSync('src/content/guided-sounds.json'))
const media = JSON.parse(fs.readFileSync('public/media-manifest.json'))
const mainPath = 'public/clip-packs/chunky-reader-audio/clips_manifest.json'
const main = JSON.parse(fs.readFileSync(mainPath))
const requests = new Map()
const version = 'guided-v3'
const folder = `guided-words/${version}`
const phoneme = (ipa, text) => `<phoneme alphabet="ipa" ph="${escapeXml(ipa)}">${escapeXml(text)}</phoneme>`
const add = (key, body, type = 'word') => requests.set(key, { key, body, type })
for (const w of Object.values(content.lexicon)) {
  add(w.text, escapeXml(w.text))
  if (w.meaning) add(`model:${w.text}`, `${escapeXml(w.text)}.<break time="250ms"/>${escapeXml(w.meaning)}`)
}
for (const lesson of content.lessons) for (const sentence of [lesson.sentence, lesson.alternateSentence]) {
  // Pin reduced function-word pronunciations even in sentence recordings.
  const body = sentence.split(/\b/).map(t => content.helpers[t.toLowerCase()]
    ? phoneme(content.helpers[t.toLowerCase()].ipa, t) : escapeXml(t)).join('')
  add(sentence, body, 'sentence')
  const helpers = [...new Set(sentence.toLowerCase().match(/[a-z]+/g))].filter(w => w in content.helpers)
  add(`helpers:${helpers.join(',')}`, helpers.map(w => `${phoneme(content.helpers[w].ipa, w)}.<break time="200ms"/>${escapeXml(content.helpers[w].note)}`).join('<break time="300ms"/>'), 'helper')
}
// Existing IPA recordings are reused with measured timing windows.
const newSounds = { 'long-a': ['ai','eɪ'], 'long-e': ['ee','iː'], 'long-i': ['igh','aɪ'], 'long-o': ['oa','oʊ'], aw: ['aw','ɔ'], schwa: [null,'ə'] }
for (const [sound, [source, ipa]] of Object.entries(newSounds)) {
  if (sounds[sound] && (media.files[sounds[sound].path] || fs.existsSync(`public/${sounds[sound].path}`))) continue
  const clip = source && Object.keys(media.files).find(p => p.includes(`_${source}-phoneme-phonics-sounds-v2.mp3`))
  if (clip) sounds[sound] = { path: clip, ipa, start: 0, duration: .5 }
  else add(`phoneme:${sound}`, `${phoneme(ipa, sound)}<break time="600ms"/>${phoneme(ipa, sound)}`, 'phoneme')
}
let credentials
if (!process.argv.includes('--ssml-only')) {
  const key = process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION || process.env.SPEECH_REGION
  if (key && region) credentials = { key, region }
  else {
    const configPath = process.env.AZURE_TTS_CONFIG_PATH || path.join(process.env.HOME || '', 'Documents/azure-tts-ssml/config.json')
    if (fs.existsSync(configPath)) {
      const c = JSON.parse(fs.readFileSync(configPath))
      const key = c.SubscriptionKey || c.subscriptionKey || c.key || c.speechKey
      const region = c.ServiceRegion || c.serviceRegion || c.region || c.speechRegion
      if (key && region) credentials = { key, region }
    }
  }
}
const previousIndex = fs.existsSync('src/content/guided-audio.json') ? JSON.parse(fs.readFileSync('src/content/guided-audio.json')) : {}
const index = {}
const staged = {}
let generated = 0, reused = 0, missing = 0
const existingClips = [...main.clips]
const anna = JSON.parse(fs.readFileSync('public/clip-packs/annas-reading-deck/clips_manifest.json'))
existingClips.push(...(anna.clips ?? []).map(c => ({ ...c, audioPath: (c.audioPath ?? c.path)?.startsWith('clip-packs/') ? (c.audioPath ?? c.path) : `clip-packs/annas-reading-deck/${c.audioPath ?? c.path}` })))
for (const file of fs.readdirSync('public/100-lessons').filter(f => /^lesson-\d+\.json$/.test(f))) {
  const lesson = JSON.parse(fs.readFileSync(`public/100-lessons/${file}`))
  for (const chunk of lesson.chunks) {
    if (chunk.type === 'sound-discovery') continue
    chunk.items?.forEach((text, i) => {
      if (typeof text === 'string' && chunk.audioPaths?.[i]) existingClips.push({ text, audioPath: `100-lessons/${chunk.audioPaths[i]}` })
    })
  }
}
for (const request of requests.values()) {
  const hash = crypto.createHash('sha256').update(request.body).digest('hex').slice(0, 16)
  const slug = request.key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '').slice(0, 75)
  const audioPath = `${folder}/audio/${slug}-${hash}.mp3`
  const ssmlPath = `${folder}/ssml/${slug}-${hash}.ssml`
  const voice = request.type === 'phoneme' ? TTS_VOICES.phonicsTeacher : TTS_VOICES.anneNarrator
  fs.mkdirSync(path.dirname(`public/${ssmlPath}`), { recursive: true })
  fs.writeFileSync(`public/${ssmlPath}`, createAzureSsml({ voice, rate: '-12%', body: request.body }))
  const previous = previousIndex[request.key]
  if (previous?.ready && previous.ssmlPath === ssmlPath && (media.files[previous.path] || fs.existsSync(`public/${previous.path}`))) {
    index[request.key] = previous; reused++; continue
  }
  let selected = audioPath
  let ready = Boolean(media.files[audioPath]) || fs.existsSync(`public/${audioPath}`)
  const reusable = request.type === 'word' && !request.key.includes(':') && existingClips.find(c => c.text?.trim().toLowerCase() === request.key && media.files[c.audioPath])
  if (!ready && reusable) { selected = reusable.audioPath; ready = true; reused++ }
  if (!ready && credentials) {
    const response = await fetch(`https://${credentials.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'Ocp-Apim-Subscription-Key': credentials.key,
        'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': TTS_OUTPUT_FORMAT, 'User-Agent': 'ChunkyReader' },
      body: fs.readFileSync(`public/${ssmlPath}`, 'utf8'),
    })
    if (!response.ok) throw new Error(`Azure synthesis failed (${response.status}); no credentials logged.`)
    fs.mkdirSync(path.dirname(`public/${audioPath}`), { recursive: true })
    fs.writeFileSync(`public/${audioPath}`, Buffer.from(await response.arrayBuffer()))
    ready = true; generated++
  }
  if (!ready) missing++
  index[request.key] = { path: selected, ready, ssmlPath }
  if (ready && selected === audioPath && fs.existsSync(`public/${audioPath}`)) {
    const bytes = fs.readFileSync(`public/${audioPath}`), sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
    const object = `v1/${sha256}.mp3`
    staged[audioPath] = { object, sha256, bytes: bytes.length }
    fs.mkdirSync('.migration/guided-upload/v1', { recursive: true })
    fs.writeFileSync(`.migration/guided-upload/${object}`, bytes)
  }
  if (request.type === 'phoneme') sounds[request.key.slice(8)] = { path: selected, ipa: newSounds[request.key.slice(8)][1], start: 0, duration: .5 }
  const id = `guided:${request.key}`
  main.clips = main.clips.filter(c => c.id !== id)
  if (ready) main.clips.push({ id, text: request.key, language: 'en-US', voice, voiceVersion: TTS_VOICE_VERSIONS.anneNarrator,
    type: request.type, audioPath: selected, ssmlPath })
}
for (const [key, clip] of Object.entries(previousIndex)) if (key.startsWith('phoneme:') && clip.ready && !index[key]) index[key] = clip
fs.writeFileSync('src/content/guided-audio.json', JSON.stringify(index, null, 2) + '\n')
fs.writeFileSync('src/content/guided-sounds.json', JSON.stringify(sounds, null, 2) + '\n')
fs.writeFileSync(mainPath, JSON.stringify(main, null, 2) + '\n')
fs.mkdirSync('.migration', { recursive: true })
fs.writeFileSync('.migration/guided-media-additions.json', JSON.stringify(staged, null, 2) + '\n')
console.log(`Guided audio: ${generated} generated, ${reused} reused, ${missing} awaiting Azure credentials. SSML saved for every request.`)
console.log('After generating: measure sound windows, upload .migration/guided-upload/v1, verify hashes, then merge guided-media-additions into media-manifest.')
