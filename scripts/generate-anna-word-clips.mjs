import fs from 'node:fs/promises'
import path from 'node:path'
import {
  TTS_OUTPUT_FORMAT,
  TTS_VOICE_VERSIONS,
  TTS_VOICES,
  createAzureSsml,
  escapeXml,
} from './tts-config.mjs'

const root = process.cwd()
const packDir = path.join(root, 'public', 'clip-packs', 'annas-reading-deck')
const vocabPath = path.join(packDir, 'vocab.csv')
const manifestPath = path.join(packDir, 'clips_manifest.json')
const voice = TTS_VOICES.anneNarrator
const voiceVersion = TTS_VOICE_VERSIONS.anneNarrator
const outputFormat = TTS_OUTPUT_FORMAT
const force = process.argv.includes('--force')
const ssmlOnly = process.argv.includes('--ssml-only')
const azureConfigPath =
  process.env.AZURE_TTS_CONFIG_PATH ||
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', 'azure-tts-ssml', 'config.json')

async function main() {
  const { headers, rows } = parseCsv(await fs.readFile(vocabPath, 'utf8'))
  const credentials = ssmlOnly ? null : await loadCredentials()
  const generatedClips = []

  for (const row of rows) {
    const word = row.word?.trim()
    if (!word) continue

    const fileSlug = safeFileName(word)
    const relativeAudioPath = `audio/words/${voiceVersion}/${fileSlug}.mp3`
    const relativeSsmlPath = `ssml/words/${voiceVersion}/${fileSlug}.ssml`
    const audioPath = path.join(packDir, relativeAudioPath)
    const ssmlPath = path.join(packDir, relativeSsmlPath)
    const ssml = createWordSsml(word)

    row.audioWordFilename = relativeAudioPath
    row.audioMeaningFilename = relativeAudioPath

    await fs.mkdir(path.dirname(ssmlPath), { recursive: true })
    await fs.writeFile(ssmlPath, ssml)

    if (credentials) {
      await fs.mkdir(path.dirname(audioPath), { recursive: true })
      if (force || !(await exists(audioPath))) {
        await synthesizeClip(credentials, ssml, audioPath)
      }
    }

    generatedClips.push(makeManifestClip('word', word, relativeAudioPath, relativeSsmlPath))
    generatedClips.push(makeManifestClip('meaning', word, relativeAudioPath, relativeSsmlPath))
  }

  await fs.writeFile(vocabPath, stringifyCsv(headers, rows))
  await updateManifest(generatedClips)

  console.log(
    `${credentials ? 'Generated' : 'Prepared'} ${generatedClips.length / 2} Growing Reader word clips with ${voice} (${voiceVersion}).`,
  )
}

function createWordSsml(word) {
  return createAzureSsml({
    language: 'en-US',
    voice,
    rate: '-8%',
    pitch: '+2%',
    body: escapeXml(word),
  })
}

function makeManifestClip(type, word, audioPath, ssmlPath) {
  return {
    id: `${type}:${word}`,
    type,
    text: word,
    language: 'en-US',
    path: audioPath,
    audioPath,
    ssmlPath,
    label: word,
    linkedWordIds: [`word:${word}`],
    provider: 'azure-tts',
    voice,
    voiceVersion,
  }
}

async function updateManifest(wordClips) {
  let existing = {}
  try {
    existing = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  } catch {
    existing = {}
  }

  const preservedClips = (existing.clips ?? []).filter((clip) => clip.type !== 'word' && clip.type !== 'meaning')
  const manifest = {
    ...existing,
    id: existing.id || 'annas-reading-deck',
    packName: existing.packName || "Anna's Reading Deck Audio",
    provider: 'azure-tts',
    voice,
    voiceVersion,
    outputFormat,
    version: `words-${voiceVersion}`,
    createdAt: new Date().toISOString(),
    vocabCsvPath: 'vocab.csv',
    clips: [...preservedClips, ...wordClips],
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

async function loadCredentials() {
  const fromEnv = {
    key: process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY,
    region: process.env.AZURE_SPEECH_REGION || process.env.SPEECH_REGION,
  }
  if (fromEnv.key && fromEnv.region) return fromEnv

  try {
    const configText = (await fs.readFile(azureConfigPath, 'utf8')).replace(/^\uFEFF/u, '')
    const config = JSON.parse(configText)
    const key = config.SubscriptionKey || config.subscriptionKey || config.key || config.speechKey
    const region = config.ServiceRegion || config.serviceRegion || config.region || config.speechRegion
    if (key && region) return { key, region }
  } catch {
    // SSML-only output is still useful for reviewing the clips.
  }

  console.warn('Azure TTS credentials were not found. Wrote SSML only.')
  return null
}

async function synthesizeClip(credentials, ssml, outputPath) {
  const response = await fetch(`https://${credentials.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': credentials.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': outputFormat,
      'User-Agent': 'chunky-reader-anna-word-generator',
    },
    body: ssml,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Azure TTS failed with ${response.status}: ${detail.slice(0, 160)}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer))
}

function parseCsv(text) {
  const normalized = text.replace(/^\uFEFF/u, '').replace(/\r\n/g, '\n')
  const records = []
  let record = []
  let value = ''
  let inQuotes = false

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]
    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        value += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      record.push(value)
      value = ''
    } else if (char === '\n') {
      record.push(value)
      if (record.some((field) => field.length > 0)) records.push(record)
      record = []
      value = ''
    } else {
      value += char
    }
  }

  if (value.length || record.length) {
    record.push(value)
    if (record.some((field) => field.length > 0)) records.push(record)
  }

  const headers = records.shift() ?? []
  return {
    headers,
    rows: records.map((fields) => Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? '']))),
  }
}

function stringifyCsv(headers, rows) {
  return `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(',')).join('\n')}\n`
}

function csvCell(value) {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function safeFileName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
