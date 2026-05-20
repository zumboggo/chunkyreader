import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const decksDir = path.join(root, 'public', 'decks')
const clipPackDir = path.join(root, 'public', 'clip-packs', 'chunky-reader-audio')
const azureConfigPath =
  process.env.AZURE_TTS_CONFIG_PATH ||
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', 'azure-tts-ssml', 'config.json')

const voice = process.env.AZURE_SPEECH_VOICE || 'en-US-JennyNeural'
const outputFormat = 'audio-24khz-48kbitrate-mono-mp3'
const synthesize = !process.argv.includes('--ssml-only')
const force = process.argv.includes('--force')

async function main() {
  const decks = await loadSarahDecks()
  const credentials = synthesize ? await loadCredentials() : null
  const clips = []

  for (const deck of decks) {
    for (const card of deck.cards) {
      clips.push(...cardClips(deck, card))
    }
  }

  const written = []
  for (const clip of clips) {
    const ssml = createSsml(clip.text, clip.language)
    await fs.mkdir(path.dirname(clip.ssmlPath), { recursive: true })
    await fs.writeFile(clip.ssmlPath, ssml)

    if (synthesize && credentials) {
      await fs.mkdir(path.dirname(clip.audioPath), { recursive: true })
      if (force || !(await exists(clip.audioPath))) {
        await synthesizeClip(credentials, ssml, clip.audioPath)
      }
    }
    written.push({
      id: clip.id,
      deckId: clip.deckId,
      cardId: clip.cardId,
      type: clip.type,
      text: clip.text,
      language: clip.language,
      voice,
      audioPath: toPublicPath(clip.audioPath),
      ssmlPath: toPublicPath(clip.ssmlPath),
    })
  }

  await fs.mkdir(clipPackDir, { recursive: true })
  await fs.writeFile(
    path.join(clipPackDir, 'clips_manifest.json'),
    JSON.stringify(
      {
        id: 'chunky-reader-audio',
        title: 'Chunky Reader Audio Pack',
        description: 'Azure TTS clips for Sarah letter and reading-sound decks. Anna audio lives in annas-reading-deck.',
        provider: synthesize && credentials ? 'azure-tts' : 'ssml-only',
        voice,
        outputFormat,
        createdAt: new Date().toISOString(),
        clips: written,
      },
      null,
      2,
    ) + '\n',
  )

  console.log(
    `${synthesize && credentials ? 'Generated' : 'Prepared'} ${written.length} Chunky Reader audio clips with SSML.`,
  )
}

async function loadSarahDecks() {
  const files = ['sarah-letters-level-1.json', 'sarah-phonemes-level-2.json']
  return Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(path.join(decksDir, file), 'utf8'))))
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
    // SSML files are still useful when Azure credentials are not present.
  }

  console.warn('Azure TTS credentials were not found. Wrote SSML only.')
  return null
}

function cardClips(deck, card) {
  const language = deck.language || 'en-US'
  const clips = []
  if (card.audio) {
    clips.push(makeClip(deck, card, 'sound', card.audio, introText(deck, card), language))
  }
  if (card.letterNameAudio && card.uppercase) {
    clips.push(makeClip(deck, card, 'letter-name', card.letterNameAudio, `This is ${card.uppercase}.`, language))
  }
  if (card.exampleAudio && card.exampleWord) {
    clips.push(makeClip(deck, card, 'example-word', card.exampleAudio, card.exampleWord, language))
  }
  return clips
}

function makeClip(deck, card, type, relativeAudioPath, text, language) {
  const assetBase = deck.assetBaseUrl || `decks/${deck.id}`
  const audioPath = path.join(root, 'public', assetBase, relativeAudioPath)
  const ssmlPath = path.join(
    root,
    'public',
    assetBase,
    'ssml',
    relativeAudioPath.replace(/\.mp3$/i, '.ssml'),
  )
  return {
    id: `${card.id}:${type}`,
    deckId: deck.id,
    cardId: card.id,
    type,
    text,
    language,
    audioPath,
    ssmlPath,
  }
}

function introText(deck, card) {
  if (deck.type === 'letters') {
    const letter = card.uppercase || card.displayText
    return `${letter}. ${card.speechCue || card.exampleWord || card.sound || card.displayText}.`
  }
  if (deck.type === 'phonemes') {
    return `${card.displayText}. ${card.speechCue || card.exampleWord || card.grapheme || card.phoneme}.`
  }
  return card.speechCue || card.exampleWord || card.word || card.displayText
}

function createSsml(text, language) {
  return `<?xml version="1.0" encoding="utf-8"?>
<speak version="1.0" xml:lang="${escapeXml(language)}" xmlns="http://www.w3.org/2001/10/synthesis">
  <voice name="${escapeXml(voice)}">
    <prosody rate="-12%" pitch="+6%">
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>
`
}

async function synthesizeClip(credentials, ssml, outputPath) {
  const response = await fetch(`https://${credentials.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': credentials.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': outputFormat,
      'User-Agent': 'chunky-reader-audio-generator',
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

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function toPublicPath(filePath) {
  return path.relative(path.join(root, 'public'), filePath).replaceAll(path.sep, '/')
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
