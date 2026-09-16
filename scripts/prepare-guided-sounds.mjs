// Reuse the first pronunciation from existing Azure IPA clips (which repeat twice).
// Requires macOS afconvert and the existing local migration backup; no credentials.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { PHONICS_LEVEL_1 } from './phonics-level-1.mjs'
const manifest = JSON.parse(fs.readFileSync('public/media-manifest.json', 'utf8'))
const sounds = Object.fromEntries(PHONICS_LEVEL_1.map(s => [s.lowercase, s.ipa]))
delete sounds.x // Not used in Guided Words; the source pack has no isolated x clip.
Object.assign(sounds, { sh: 'ʃ', ch: 'tʃ', th: 'θ', ng: 'ŋ', ing: 'ɪŋ' })
const output = {}
fs.mkdirSync('.migration/guided-sounds', { recursive: true })
for (const [sound, ipa] of Object.entries(sounds)) {
  const source = Object.keys(manifest.files).find(p => p.includes(`_${sound}-phoneme-phonics-sounds-v2.mp3`))
  if (!source) throw new Error(`Missing phoneme clip: ${sound}`)
  const wavPath = `.migration/guided-sounds/${sound}.wav`
  execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16', `.migration/upload/${manifest.files[source].object}`, wavPath])
  const wav = fs.readFileSync(wavPath)
  let rate, channels, data
  for (let at = 12; at + 8 <= wav.length;) {
    const id = wav.toString('ascii', at, at + 4), size = wav.readUInt32LE(at + 4)
    if (id === 'fmt ') { channels = wav.readUInt16LE(at + 10); rate = wav.readUInt32LE(at + 12) }
    if (id === 'data') data = wav.subarray(at + 8, at + 8 + size)
    at += 8 + size + size % 2
  }
  if (!data || channels !== 1 || !rate) throw new Error('Expected mono PCM audio')
  const frame = Math.round(rate * .01), rms = []
  for (let at = 0; at + frame * 2 <= data.length; at += frame * 2) {
    let sum = 0
    for (let j = 0; j < frame; j++) sum += (data.readInt16LE(at + j * 2) / 32768) ** 2
    rms.push(Math.sqrt(sum / frame))
  }
  const threshold = Math.max(.0005, Math.max(...rms) * .035)
  const voiced = rms.map((v, i) => v >= threshold ? i : -1).filter(i => i >= 0)
  const gaps = voiced.slice(1).map((v, i) => ({ left: voiced[i], right: v, gap: v - voiced[i] }))
    .filter(g => g.gap >= 10)
  // Split at the pause between the two repetitions, not a tiny stop closure.
  const middle = (voiced[0] + voiced.at(-1)) / 2
  const split = gaps.sort((a, b) => Math.abs((a.left + a.right) / 2 - middle) - Math.abs((b.left + b.right) / 2 - middle))[0]
  if (!split) throw new Error(`Cannot safely isolate first pronunciation: ${sound}`)
  const start = Math.max(0, (voiced[0] - 3) / 100)
  const end = (split.left + 5) / 100
  output[sound] = { path: source, ipa, start, duration: Number((end - start).toFixed(3)) }
  console.log(`${sound}: first pronunciation ${start.toFixed(2)}–${end.toFixed(2)}s; pause ${split.gap * 10}ms`)
}
fs.writeFileSync('src/content/guided-sounds.json', JSON.stringify(output, null, 2) + '\n')
