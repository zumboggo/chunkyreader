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

const STARTER_SENTENCES = {
  a: 'I see a cat.',
  am: 'I am here.',
  and: 'You and I can read.',
  anywhere: 'We can read anywhere.',
  are: 'We are ready.',
  be: 'Be kind.',
  boat: 'The boat can go.',
  box: 'The box is here.',
  car: 'The car can go.',
  could: 'I could try.',
  dark: 'It is dark.',
  do: 'I can do it.',
  eat: 'We can eat.',
  eggs: 'The eggs are green.',
  fox: 'I see a fox.',
  goat: 'The goat can hop.',
  good: 'This is good.',
  green: 'The tree is green.',
  ham: 'I see the ham.',
  here: 'I am here.',
  house: 'This is my house.',
  i: 'I can read.',
  if: 'Try it if you like.',
  in: 'The cat is in.',
  let: 'Let me try.',
  like: 'I like this.',
  may: 'May I go?',
  me: 'Come with me.',
  mouse: 'The mouse can run.',
  not: 'I am not sad.',
  on: 'The hat is on.',
  or: 'Red or green?',
  rain: 'I see the rain.',
  sam: 'Sam can read.',
  say: 'Say the word.',
  see: 'I can see.',
  so: 'It is so good.',
  thank: 'Thank you.',
  that: 'I see that.',
  the: 'The cat can run.',
  them: 'I can see them.',
  there: 'The box is there.',
  they: 'They can play.',
  train: 'The train can go.',
  tree: 'I see a tree.',
  try: 'I will try.',
  will: 'I will read.',
  with: 'Come with me.',
  would: 'I would like that.',
  you: 'You can read.',
}

async function main() {
  const parsedCsv = parseCsv(await fs.readFile(vocabPath, 'utf8'))
  const headers = [...parsedCsv.headers]
  const rows = parsedCsv.rows
  ensureHeader(headers, 'exampleSentence')
  ensureHeader(headers, 'exampleSentenceAudioFilename')
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
    if (!row.exampleSentence && STARTER_SENTENCES[word.toLowerCase()]) {
      row.exampleSentence = STARTER_SENTENCES[word.toLowerCase()]
    }

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

    if (row.exampleSentence) {
      const sentenceSlug = `${fileSlug}-sentence`
      const relativeSentenceAudioPath = `audio/sentences/${voiceVersion}/${sentenceSlug}.mp3`
      const relativeSentenceSsmlPath = `ssml/sentences/${voiceVersion}/${sentenceSlug}.ssml`
      const sentenceAudioPath = path.join(packDir, relativeSentenceAudioPath)
      const sentenceSsmlPath = path.join(packDir, relativeSentenceSsmlPath)
      const sentenceSsml = createSentenceSsml(row.exampleSentence)
      row.exampleSentenceAudioFilename = relativeSentenceAudioPath

      await fs.mkdir(path.dirname(sentenceSsmlPath), { recursive: true })
      await fs.writeFile(sentenceSsmlPath, sentenceSsml)
      if (credentials) {
        await fs.mkdir(path.dirname(sentenceAudioPath), { recursive: true })
        if (force || !(await exists(sentenceAudioPath))) {
          await synthesizeClip(credentials, sentenceSsml, sentenceAudioPath)
        }
      }
      generatedClips.push(makeSentenceManifestClip(word, row.exampleSentence, relativeSentenceAudioPath, relativeSentenceSsmlPath))
    }
  }

  await createIntroClip(credentials, generatedClips)

  await fs.writeFile(vocabPath, stringifyCsv(headers, rows))
  await updateManifest(generatedClips)

  console.log(
    `${credentials ? 'Generated' : 'Prepared'} ${generatedClips.filter((clip) => clip.type === 'word').length} word clips, ${generatedClips.filter((clip) => clip.type === 'sentence').length} sentence clips, and the lesson intro with ${voice} (${voiceVersion}).`,
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

function createSentenceSsml(sentence) {
  return createAzureSsml({
    language: 'en-US',
    voice,
    rate: '-10%',
    pitch: '+2%',
    body: escapeXml(sentence),
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

function makeSentenceManifestClip(word, sentence, audioPath, ssmlPath) {
  return {
    id: `word-sentence:word:${word}`,
    type: 'sentence',
    text: sentence,
    language: 'en-US',
    path: audioPath,
    audioPath,
    ssmlPath,
    label: sentence,
    linkedWordIds: [`word:${word}`],
    provider: 'azure-tts',
    voice,
    voiceVersion,
  }
}

async function createIntroClip(credentials, generatedClips) {
  const text = 'Today we are going to learn.'
  const relativeAudioPath = `audio/narration/${voiceVersion}/today-we-are-going-to-learn.mp3`
  const relativeSsmlPath = `ssml/narration/${voiceVersion}/today-we-are-going-to-learn.ssml`
  const audioPath = path.join(packDir, relativeAudioPath)
  const ssmlPath = path.join(packDir, relativeSsmlPath)
  const ssml = createSentenceSsml(text)
  await fs.mkdir(path.dirname(ssmlPath), { recursive: true })
  await fs.writeFile(ssmlPath, ssml)
  if (credentials) {
    await fs.mkdir(path.dirname(audioPath), { recursive: true })
    if (force || !(await exists(audioPath))) await synthesizeClip(credentials, ssml, audioPath)
  }
  generatedClips.push({
    id: 'older-reader:intro:today-words',
    type: 'ui',
    text,
    language: 'en-US',
    path: relativeAudioPath,
    audioPath: relativeAudioPath,
    ssmlPath: relativeSsmlPath,
    label: text,
    provider: 'azure-tts',
    voice,
    voiceVersion,
  })
}

async function updateManifest(wordClips) {
  let existing = {}
  try {
    existing = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  } catch {
    existing = {}
  }

  const generatedIds = new Set(wordClips.map((clip) => clip.id))
  const preservedClips = (existing.clips ?? []).filter((clip) => !generatedIds.has(clip.id))
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

function ensureHeader(headers, header) {
  if (!headers.includes(header)) headers.push(header)
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
