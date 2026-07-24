import { parseCsv, parseList, parseNumber, readColumn, stableId } from './csv'
import type {
  ClipManifestEntry,
  ClipPackManifest,
  DeckIndexEntry,
  LearningCard,
  LearningDeck,
} from './types'

const appBase = import.meta.env.BASE_URL

export async function loadDeckLibrary(): Promise<LearningDeck[]> {
  const response = await fetch(withBase('decks/index.json'))
  if (!response.ok) throw new Error(`Could not load decks/index.json (${response.status})`)
  const entries = (await response.json()) as DeckIndexEntry[]
  const decks = await Promise.all(entries.map((entry) => loadDeck(entry)))

  const annaDeck = decks.find((d) => d.profile === 'anna' && d.type === 'reading-words')
  if (annaDeck) {
    try {
      const storiesResponse = await fetch(withBase('stories/anne-stories.json'))
      if (storiesResponse.ok) {
        const stories = (await storiesResponse.json()) as { pages: { text: string }[] }[]
        const names = ['anne', 'diana', 'matthew', 'marilla', 'robin', 'marian', 'john']
        const storyWords = new Set<string>()
        for (const story of stories) {
          for (const page of story.pages) {
            const words = page.text.toLowerCase().match(/[a-z]+/g) || []
            for (const w of words) {
              if (!names.includes(w)) storyWords.add(w)
            }
          }
        }
        const storyCards = annaDeck.cards.filter((c) => c.type === 'word' && storyWords.has(c.word?.toLowerCase() || ''))
        decks.push({
          ...annaDeck,
          id: 'story-vocab',
          title: 'Story Vocab',
          description: 'Words specifically from the 10 stories.',
          level: (annaDeck.level ?? 0) + 0.1,
          cards: storyCards.map((c) => ({ ...c, deckId: 'story-vocab' })),
        })
      }
    } catch (e) {
      console.error('Could not load story vocab', e)
    }
  }

  return decks.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.title.localeCompare(b.title))
}

export function resolveAssetUrl(deck: LearningDeck, path?: string): string | undefined {
  if (!path) return undefined
  if (/^(https?:|data:|blob:)/u.test(path)) return path
  if (path.startsWith('/')) return withBase(path.slice(1))
  const base = deck.assetBaseUrl || deck.baseUrl
  return withBase([base, path].filter(Boolean).join('/'))
}

function withBase(path: string): string {
  const joined = `${appBase}${path}`.replace(/([^:]\/)\/+/gu, '$1')
  return joined
}

async function loadDeck(entry: DeckIndexEntry): Promise<LearningDeck> {
  if (entry.format === 'chunky-clip-pack') return loadChunkyClipPack(entry)
  if (!entry.source) throw new Error(`${entry.id} is missing a source`)
  const response = await fetch(withBase(entry.source))
  if (!response.ok) throw new Error(`Could not load ${entry.source} (${response.status})`)
  const deck = (await response.json()) as Omit<LearningDeck, 'cards'> & {
    cards: Array<Omit<LearningCard, 'deckId'> & { deckId?: string }>
  }
  return {
    ...entry,
    ...deck,
    assetBaseUrl: deck.assetBaseUrl ?? entry.assetBaseUrl ?? parentPath(entry.source),
    cards: deck.cards.map((card) => ({
      ...card,
      // Chinese JSON decks use the more specific simpleMeaning field. Mirror
      // it into the shared meaning field so every flashcard surface shows the
      // English definition without duplicating data in the source deck.
      meaning: card.meaning ?? card.simpleMeaning,
      deckId: entry.id,
    })),
  }
}

async function loadChunkyClipPack(entry: DeckIndexEntry): Promise<LearningDeck> {
  if (!entry.baseUrl) throw new Error(`${entry.id} is missing a baseUrl`)
  const baseUrl = entry.baseUrl.replace(/\/+$/u, '')
  const manifestResponse = await fetch(withBase(`${baseUrl}/clips_manifest.json`))
  if (!manifestResponse.ok) {
    throw new Error(`Could not load ${baseUrl}/clips_manifest.json (${manifestResponse.status})`)
  }
  const manifest = (await manifestResponse.json()) as ClipPackManifest
  const vocabPath = manifest.vocabCsvPath ?? 'vocab.csv'
  const vocabResponse = await fetch(withBase(`${baseUrl}/${vocabPath}`))
  if (!vocabResponse.ok) throw new Error(`Could not load ${baseUrl}/${vocabPath}`)
  const rows = parseCsv(await vocabResponse.text())
  const clips = manifest.clips ?? []
  const audioByWord = audioLookup(clips)

  const wordCards = rows
    .map((row, index): LearningCard | undefined => {
      const word = readColumn(row, ['word', 'Hanzi', 'Front'])
      if (!word) return undefined
      const tags = parseList(readColumn(row, ['tags', 'Bucket']))
      const meaning = readColumn(row, ['meaning', 'English', 'Back']) || word
      const rowImage = readColumn(row, ['image', 'picture', 'imageFilename'])
      const audio = readColumn(row, ['audio', 'audioWordFilename']) || audioByWord.get(`word:${word}`)?.path
      const category = readColumn(row, ['category']) || tags.find((tag) => !/anna|reading|clip-pack/iu.test(tag))
      const slug = stableId(word)

      return {
        id: `word:${word}`,
        deckId: entry.id,
        type: 'word',
        displayText: word,
        word,
        meaning,
        image: rowImage || (entry.type === 'reading-words' ? `images/${slug}.png` : undefined),
        audio,
        exampleSentence: readColumn(row, ['exampleSentence', 'sentence']),
        exampleAudio: readColumn(row, ['exampleSentenceAudioFilename', 'sentenceAudio']),
        category,
        difficulty: parseNumber(readColumn(row, ['difficulty', 'lessonNumber'])) ?? Math.ceil((index + 1) / 5),
        tags,
        speechCue: word,
      }
    })
    .filter((card): card is LearningCard => Boolean(card))
  const sentenceCards = await loadSentenceCards(entry, baseUrl, manifest, clips)

  return {
    id: entry.id,
    title: entry.title || manifest.packName,
    description: entry.description,
    type: entry.type,
    profile: entry.profile,
    level: entry.level,
    language: entry.language,
    accentModel: entry.accentModel,
    baseUrl,
    assetBaseUrl: entry.assetBaseUrl ?? baseUrl,
    cards: [...wordCards, ...sentenceCards],
  }
}

async function loadSentenceCards(
  entry: DeckIndexEntry,
  baseUrl: string,
  manifest: ClipPackManifest,
  clips: ClipManifestEntry[],
): Promise<LearningCard[]> {
  if (!manifest.sentencesCsvPath) return []
  const response = await fetch(withBase(`${baseUrl}/${manifest.sentencesCsvPath}`))
  if (!response.ok) return []
  const rows = parseCsv(await response.text())
  const audioByText = sentenceAudioLookup(clips)

  return rows
    .map((row, index): LearningCard | undefined => {
      const sentence = readColumn(row, ['sentence', 'chinese', 'text', 'front'])
      if (!sentence) return undefined
      const meaning = readColumn(row, ['meaning', 'english', 'translation', 'back'])
      const sentenceAudio = readColumn(row, ['audio', 'audioSentenceFilename']) || audioByText.get(`sentence:${sentence}`)?.path
      const meaningAudio = readColumn(row, ['audioMeaning', 'audioEnglishFilename']) || audioByText.get(`sentenceMeaning:${sentence}`)?.path
      const id = `sentence:${stableId(sentence)}`

      return {
        id,
        deckId: entry.id,
        type: 'sentence',
        displayText: sentence,
        sentence,
        meaning,
        audio: sentenceAudio,
        exampleAudio: meaningAudio,
        category: 'sentences',
        difficulty: parseNumber(readColumn(row, ['difficulty', 'lessonNumber'])) ?? Math.ceil((index + 1) / 5),
        tags: parseList(readColumn(row, ['tags'])),
        speechCue: sentence,
      }
    })
    .filter((card): card is LearningCard => Boolean(card))
}

function audioLookup(clips: ClipManifestEntry[]): Map<string, ClipManifestEntry> {
  const byWord = new Map<string, ClipManifestEntry>()
  for (const clip of clips) {
    if (clip.type !== 'word') continue
    for (const id of clip.linkedWordIds ?? []) byWord.set(id, clip)
  }
  return byWord
}

function sentenceAudioLookup(clips: ClipManifestEntry[]): Map<string, ClipManifestEntry> {
  const byText = new Map<string, ClipManifestEntry>()
  for (const clip of clips) {
    if (clip.type !== 'sentence' && clip.type !== 'sentenceMeaning') continue
    byText.set(`${clip.type}:${clip.text}`, clip)
  }
  return byText
}

function parentPath(path: string): string {
  return path.split('/').slice(0, -1).join('/')
}
