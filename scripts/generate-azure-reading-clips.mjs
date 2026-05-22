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
const decksDir = path.join(root, 'public', 'decks')
const storiesPath = path.join(root, 'public', 'stories', 'anne-stories.json')
const clipPackDir = path.join(root, 'public', 'clip-packs', 'chunky-reader-audio')
const azureConfigPath =
  process.env.AZURE_TTS_CONFIG_PATH ||
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', 'azure-tts-ssml', 'config.json')

const outputFormat = TTS_OUTPUT_FORMAT
const synthesize = !process.argv.includes('--ssml-only')
const force = process.argv.includes('--force')

async function main() {
  const decks = await loadSarahDecks()
  const stories = await loadStories()
  const credentials = synthesize ? await loadCredentials() : null
  const clips = []

  for (const deck of decks) {
    for (const card of deck.cards) {
      clips.push(...cardClips(deck, card))
    }
  }
  clips.push(...storyClips(stories))
  clips.push(...uiNarrationClips())

  const written = []
  for (const clip of clips) {
    const ssml = createSsml(clip)
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
      voice: clip.voice,
      voiceVersion: clip.voiceVersion,
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
        description: 'Azure TTS clips for kid-facing Chunky Reader text, including sound decks, story pages, prompts, and feedback.',
        provider: synthesize && credentials ? 'azure-tts' : 'ssml-only',
        version: '2026-05-kid-facing-audio-v2',
        voices: TTS_VOICES,
        voiceVersions: TTS_VOICE_VERSIONS,
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

async function loadStories() {
  try {
    return JSON.parse(await fs.readFile(storiesPath, 'utf8'))
  } catch {
    return []
  }
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
    clips.push(makeClip(deck, card, 'sound', card.audio, introText(deck, card), language, soundSsmlBody(deck, card)))
  }
  // Level 1 letter lessons are phonics-first. We intentionally do not generate
  // letter-name clips here, because Azure will read "M" as "em"; letter names can
  // be introduced later with a separate, explicit deck.
  if (card.exampleAudio && card.exampleWord) {
    clips.push(makeClip(deck, card, 'example-word', card.exampleAudio, card.exampleWord, language))
  }
  return clips
}

function makeClip(deck, card, type, relativeAudioPath, text, language, ssmlBody) {
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
    voice: deck.type === 'letters' || deck.type === 'phonemes' ? TTS_VOICES.phonicsTeacher : TTS_VOICES.childInstructions,
    voiceVersion: deck.type === 'letters' || deck.type === 'phonemes'
      ? TTS_VOICE_VERSIONS.phonicsTeacher
      : TTS_VOICE_VERSIONS.childInstructions,
    ssmlBody,
    audioPath,
    ssmlPath,
  }
}

function storyClips(stories) {
  const clips = []
  for (const story of stories) {
    for (const page of story.pages ?? []) {
      const slug = `${story.id}-page-${page.pageNumber}`
      clips.push(makeNarrationClip({
        id: `story:${story.id}:page:${page.pageNumber}`,
        type: 'story-page',
        text: page.text,
        language: 'en-US',
        relativeAudioPath: `audio/narration/stories/${TTS_VOICE_VERSIONS.anneNarrator}/${slug}.mp3`,
        voice: TTS_VOICES.anneNarrator,
        voiceVersion: TTS_VOICE_VERSIONS.anneNarrator,
        rate: '-8%',
        pitch: '+2%',
      }))
    }
  }
  return clips
}

function uiNarrationClips() {
  const entries = [
    ['ui:story:complete', 'story-ui', 'The End. You finished the story!'],
    ['older-reader:complete', 'older-reader-ui', 'You practiced five words. Great job!'],
    ['older-reader:prompt:pictureToWord', 'older-reader-prompt', 'What word matches the picture?'],
    ['older-reader:prompt:wordToPicture', 'older-reader-prompt', 'Which picture matches this word?'],
    ['older-reader:prompt:audioToWord', 'older-reader-prompt', 'Which word did you hear?'],
    ['older-reader:prompt:startsWithSound', 'older-reader-prompt', 'This word starts with which sound?'],
    ['older-reader:prompt:wordFamily', 'older-reader-prompt', 'Which word has this chunk?'],
    ['older-reader:prompt:review', 'older-reader-prompt', 'What word matches the picture?'],
    ['feedback:great', 'feedback', 'Great job!'],
    ['feedback:try-again', 'feedback', 'Try again.'],
    ['feedback:choose-one', 'feedback', 'Choose one.'],
    ['feedback:one-more', 'feedback', 'One more!'],
    ['ui:save-audio', 'ui', 'Save audio.'],
    ['ui:tap-to-hear', 'ui', 'Tap to hear.'],
    ['ui:read-to-me', 'ui', 'Read to me.'],
  ]
  return entries.map(([id, type, text]) => makeNarrationClip({
    id,
    type,
    text,
    language: 'en-US',
    relativeAudioPath: `audio/narration/ui/${safeFileName(id)}.mp3`,
    voice: TTS_VOICES.childInstructions,
    voiceVersion: TTS_VOICE_VERSIONS.childInstructions,
  }))
}

function makeNarrationClip({
  id,
  type,
  text,
  language,
  relativeAudioPath,
  voice = TTS_VOICES.childInstructions,
  voiceVersion = TTS_VOICE_VERSIONS.childInstructions,
  rate = '-10%',
  pitch = '+3%',
}) {
  const audioPath = path.join(clipPackDir, relativeAudioPath)
  const ssmlPath = path.join(clipPackDir, 'ssml', relativeAudioPath.replace(/\.mp3$/i, '.ssml'))
  return {
    id,
    type,
    text,
    language,
    voice,
    voiceVersion,
    rate,
    pitch,
    audioPath,
    ssmlPath,
  }
}

function introText(deck, card) {
  if (deck.type === 'letters') {
    return card.ttsText || `This is the ${card.sound || ''} sound, as in ${card.exampleWord}.`
  }
  if (deck.type === 'phonemes') {
    return `${card.displayText}. ${card.speechCue || card.exampleWord || card.grapheme || card.phoneme}.`
  }
  return card.speechCue || card.exampleWord || card.word || card.displayText
}

function soundSsmlBody(deck, card) {
  if (deck.type !== 'letters' || !card.ssmlSound) return undefined
  const example = escapeXml(card.exampleWord || '')
  const soundText = card.ssmlSound
  const cue = card.mouthCue ? ` <break time="250ms"/> ${escapeXml(card.mouthCue)}` : ''
  return `Listen. ${soundText}. <break time="250ms"/> ${example} starts with ${soundText}.${cue}`
}

function createSsml(clip) {
  const body = clip.ssmlBody || escapeXml(clip.text).replaceAll('\n', '<break time="350ms"/>')
  return createAzureSsml({
    language: clip.language,
    voice: clip.voice,
    rate: clip.rate || (clip.type === 'sound' ? '-12%' : '-8%'),
    pitch: clip.pitch || (clip.type === 'sound' ? '+4%' : '+2%'),
    body,
  })
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

function safeFileName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
