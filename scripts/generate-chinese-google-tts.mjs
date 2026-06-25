/**
 * Generates Chinese character audio using Google Cloud Text-to-Speech (Chirp 3 HD).
 * Sends ONLY the Chinese character — no pinyin, no English — so the native
 * Mandarin voice pronounces each character with correct tones.
 *
 * Usage:
 *   node scripts/generate-chinese-google-tts.mjs
 *   node scripts/generate-chinese-google-tts.mjs --force     # overwrite existing
 *   node scripts/generate-chinese-google-tts.mjs --dry-run   # no API calls
 *   node scripts/generate-chinese-google-tts.mjs --voice cmn-CN-Chirp3-HD-Kore
 *
 * Reads:  public/decks/chinese-level-1.json
 * Writes: public/decks/chinese-level-1/audio/chinese-level-1/chinese-teacher-google-chirp-v1/*.mp3
 *         Updates audio paths in public/decks/chinese-level-1.json
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const deckPath = path.join(root, 'public', 'decks', 'chinese-level-1.json')
const args = process.argv.slice(2)
const force = args.includes('--force')
const dryRun = args.includes('--dry-run')

const VOICE_VERSION = 'chinese-teacher-google-chirp-v1'
const LANGUAGE_CODE = 'cmn-CN'

// Voices ranked by quality. The script tries them in order and uses the first
// one that the API accepts. Chirp 3 HD is the clearest for young learners.
const VOICE_CANDIDATES = [
  readStringArg('voice') ?? 'cmn-CN-Chirp3-HD-Aoede',
  'cmn-CN-Chirp3-HD-Kore',
  'cmn-CN-Chirp3-HD-Charon',
  'cmn-CN-Wavenet-A',
  'cmn-CN-Standard-A',
].filter(Boolean)

const apiKey =
  process.env.GOOGLE_CLOUD_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY

if (!apiKey && !dryRun) {
  console.error('Set GOOGLE_CLOUD_API_KEY in .env before running this script.')
  process.exit(1)
}

const deck = JSON.parse(await fs.readFile(deckPath, 'utf8'))
const audioBaseDir = path.join(
  root,
  'public',
  'decks',
  'chinese-level-1',
  'audio',
  'chinese-level-1',
  VOICE_VERSION,
)

if (!dryRun) {
  await fs.mkdir(audioBaseDir, { recursive: true })
}

let activeVoice = VOICE_CANDIDATES[0]
let generated = 0
let skipped = 0
let failed = 0

console.log(`Google Chirp Chinese TTS — ${VOICE_VERSION}`)
console.log(`Voice: ${activeVoice}`)
console.log(`Cards: ${deck.cards.length}`)
if (dryRun) console.log('Dry run: no API calls, no files written.\n')

for (const card of deck.cards) {
  const char = card.displayText
  if (!char) continue

  const filename = `char-${char}.mp3`
  const outputPath = path.join(audioBaseDir, filename)
  const newRelativePath = `audio/chinese-level-1/${VOICE_VERSION}/${filename}`

  if (dryRun) {
    console.log(`  ${char} → ${newRelativePath}`)
    card.audio = newRelativePath
    continue
  }

  if (!force && await exists(outputPath)) {
    card.audio = newRelativePath
    skipped += 1
    continue
  }

  try {
    const mp3 = await synthesizeWithFallback(char)
    await fs.writeFile(outputPath, mp3)
    card.audio = newRelativePath
    generated += 1
    console.log(`  ${char} ✓`)
  } catch (err) {
    console.error(`  ${char} ✗  ${err instanceof Error ? err.message : err}`)
    failed += 1
  }
}

if (!dryRun) {
  await fs.writeFile(deckPath, `${JSON.stringify(deck, null, 2)}\n`)
  console.log(`\nUpdated audio paths in public/decks/chinese-level-1.json`)
}

console.log(`\nDone. Generated ${generated}, skipped ${skipped}, failed ${failed}.`)
if (failed > 0) process.exitCode = 1

// --- helpers ----------------------------------------------------------------

async function synthesizeWithFallback(text) {
  for (let i = 0; i < VOICE_CANDIDATES.length; i += 1) {
    const voice = VOICE_CANDIDATES[i]
    try {
      const mp3 = await synthesize(text, voice)
      if (voice !== activeVoice) {
        console.log(`Switched to voice: ${voice}`)
        activeVoice = voice
      }
      return mp3
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isVoiceError =
        /voice.*not.*supported|invalid.*voice|voice.*not.*found|400/i.test(message)
      if (isVoiceError && i < VOICE_CANDIDATES.length - 1) {
        console.warn(`Voice ${voice} unavailable, trying next...`)
        continue
      }
      throw err
    }
  }
  throw new Error('No supported Chinese voice found.')
}

async function synthesize(text, voiceName) {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`
  const body = {
    input: { text },
    voice: {
      languageCode: LANGUAGE_CODE,
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.85,
      pitch: 0,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(
      `Google TTS error ${response.status}: ${data.error?.message ?? JSON.stringify(data)}`,
    )
  }
  if (!data.audioContent) {
    throw new Error('Google TTS response missing audioContent.')
  }
  return Buffer.from(data.audioContent, 'base64')
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function readStringArg(name) {
  const equalsArg = args.find((a) => a.startsWith(`--${name}=`))
  if (equalsArg) return equalsArg.split('=').slice(1).join('=')
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}
