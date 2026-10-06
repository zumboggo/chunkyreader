// Bundle only new speech in compact AAC. Existing catalog assets remain on shared storage.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
const indexPath = 'src/content/guided-audio.json', soundsPath = 'src/content/guided-sounds.json'
const mainPath = 'public/clip-packs/chunky-reader-audio/clips_manifest.json'
const index = JSON.parse(fs.readFileSync(indexPath)), sounds = JSON.parse(fs.readFileSync(soundsPath))
const main = JSON.parse(fs.readFileSync(mainPath)), files = {}
for (const [key, clip] of Object.entries(index)) {
  if (clip.provider !== 'replicate') continue
  const source = clip.path.replace(/\.m4a$/, '.wav'), target = source.replace(/\.wav$/, '.m4a')
  if (!fs.existsSync(`public/${target}`)) execFileSync('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', `public/${source}`, `public/${target}`])
  const bytes = fs.readFileSync(`public/${target}`)
  files[target] = { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }
  clip.path = target
  const entry = main.clips.find(c => c.id === `guided:${key}`)
  if (entry) entry.audioPath = target
  if (key === 'phoneme:schwa') sounds.schwa.path = target
}
fs.writeFileSync(indexPath, JSON.stringify(index,null,2)+'\n')
fs.writeFileSync(soundsPath, JSON.stringify(sounds,null,2)+'\n')
fs.writeFileSync(mainPath, JSON.stringify(main,null,2)+'\n')
fs.writeFileSync('public/guided-words/media-manifest.json', JSON.stringify({ version:1, files },null,2)+'\n')
console.log(`Packaged ${Object.keys(files).length} recordings, ${(Object.values(files).reduce((s,f)=>s+f.bytes,0)/1024/1024).toFixed(2)} MiB.`)
