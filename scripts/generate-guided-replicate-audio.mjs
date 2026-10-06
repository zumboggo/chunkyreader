// User-selected alternative to Azure. Only public lesson text is sent to Replicate.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Replicate from 'replicate'
const model = 'google/gemini-3.1-flash-tts'
const voice = 'Sulafat'
const version = 'gemini-3.1-sulafat-guided-v1'
const tokenPath = process.env.REPLICATE_TOKEN_PATH || path.join(process.env.HOME, '.claude/replicate-token')
const auth = process.env.REPLICATE_API_TOKEN || fs.readFileSync(tokenPath, 'utf8').trim()
const replicate = new Replicate({ auth })
const indexPath = 'src/content/guided-audio.json'
const index = JSON.parse(fs.readFileSync(indexPath))
const content = JSON.parse(fs.readFileSync('src/content/guided-words.json'))
const soundPath = 'src/content/guided-sounds.json'
const sounds = JSON.parse(fs.readFileSync(soundPath))
const mainPath = 'public/clip-packs/chunky-reader-audio/clips_manifest.json'
const main = JSON.parse(fs.readFileSync(mainPath))
const staged = fs.existsSync('.migration/guided-media-additions.json') ? JSON.parse(fs.readFileSync('.migration/guided-media-additions.json')) : {}
const jobs = Object.entries(index).filter(([, clip]) => !clip.ready)
let cursor = 0, done = 0
const errors = []
function inputFor(key) {
  let text = key
  let prompt = 'Say only the supplied text in a warm, clear female voice with a standard American English accent. Read naturally, a little slower than conversation, as a kind reading teacher.'
  if (/^[a-z]+$/.test(key)) text = key + '.'
  if (key.startsWith('helpers:') || key.includes(' ')) prompt += ' Use natural reduced vowels in function words: the article a sounds like unstressed uh, an like un, can like kun. Is and has end with a buzzing z sound.'
  if (key.startsWith('model:')) { const w = content.lexicon[key.slice(6)]; text = `${w.text}. [short pause] ${w.meaning}` }
  if (key.startsWith('helpers:')) text = key.slice(8).split(',').map(w => {
    const notes = { a: 'A. A means one. In a sentence it often sounds like uh.', an: 'An. An means one, before a vowel sound.',
      is: 'Is. Listen to the buzzing sound at the end: is.', has: 'Has. Has means owns or holds. Listen to the buzzing sound at the end: has.',
      can: 'Can. Can means able to. Its vowel is often relaxed in a sentence.' }
    return notes[w]
  }).join(' [medium pause] ')
  if (key === 'phoneme:schwa') {
    text = 'uh [long pause] uh'
    prompt = 'Make only the relaxed short neutral vowel schwa, IPA /ə/, twice with a one-second silent pause between. This is the unstressed vowel at the start of about, NOT a stressed /ʌ/ or /ɑ/ or a letter name. Short, gentle, mid-central vowel; no consonants, no explanation, no introduction. Standard American English, clear female voice.'
  }
  return { text, prompt, voice, language_code: 'en-US' }
}
function save() {
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2)+'\n')
  fs.writeFileSync(soundPath, JSON.stringify(sounds, null, 2)+'\n')
  fs.writeFileSync(mainPath, JSON.stringify(main, null, 2)+'\n')
  fs.writeFileSync('.migration/guided-media-additions.json', JSON.stringify(staged, null, 2)+'\n')
}
await Promise.all(Array.from({ length: 2 }, async () => {
  while (cursor < jobs.length) {
    const [key, entry] = jobs[cursor++]
    try {
      const input = inputFor(key)
      const id = crypto.createHash('sha256').update(JSON.stringify({ model, input })).digest('hex').slice(0,16)
      const slug = key.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'').slice(0,70)
      const base = `guided-words/${version}/${slug}-${id}`
      const audioPath = `${base}.wav`, sourcePath = `${base}.json`
      fs.mkdirSync(path.dirname(`public/${sourcePath}`), { recursive: true })
      fs.writeFileSync(`public/${sourcePath}`, JSON.stringify({ model, input }, null, 2)+'\n')
      if (!fs.existsSync(`public/${audioPath}`)) {
        const output = await replicate.run(model, { input })
        // FileOutput is a readable stream; no token or prediction response is logged.
        const bytes = Buffer.from(await new Response(output).arrayBuffer())
        if (bytes.subarray(0,4).toString() !== 'RIFF') throw new Error('Expected WAV audio')
        fs.writeFileSync(`public/${audioPath}`, bytes)
      }
      const bytes = fs.readFileSync(`public/${audioPath}`)
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
      const object = `v1/${sha256}.wav`
      fs.mkdirSync('.migration/guided-upload/v1', {recursive:true})
      fs.writeFileSync(`.migration/guided-upload/${object}`, bytes)
      staged[audioPath] = { object, sha256, bytes: bytes.length }
      index[key] = { ...entry, path: audioPath, ready: true, sourcePath, provider: 'replicate', model, voice }
      if (key === 'phoneme:schwa') sounds.schwa = { path: audioPath, ipa: 'ə', start: 0, duration: .5 }
      main.clips = main.clips.filter(c=>c.id !== `guided:${key}`)
      main.clips.push({ id: `guided:${key}`, text: key, language: 'en-US', voice, voiceVersion: version,
        type: key.startsWith('phoneme:') ? 'sound' : 'narration', audioPath, ssmlPath: entry.ssmlPath, sourcePath, provider:'replicate' })
      done++; save()
      if (done % 10 === 0 || done === jobs.length) console.log(`Recorded ${done}/${jobs.length} clips`)
    } catch (error) { errors.push(key); console.log(`Recording failed for lesson text: ${key}; status ${error.response?.status ?? error.status ?? 'unknown'}; ${error.message?.includes('Expected WAV') ? 'not a WAV stream' : error.name}`) }
  }
}))
save()
console.log(`Finished ${done} recordings; ${errors.length} failed. Input prompts and original SSML retained.`)
if (errors.length) process.exitCode = 1
