export type ProfileId = 'anna' | 'sarah' | 'library' | '100-lessons'
export type SectionId = 'letters' | 'sounds' | 'words' | 'stories' | 'math' | 'chinese'

export type DeckType = 'reading-words' | 'letters' | 'phonemes' | 'chinese-vocab' | 'math' | 'stories'

// These ids preserve the original Chunky Chinese learning-mode wiring:
// listeningMode, activeRecall, and the reader-style third flow.
export type LearningMode = 'listeningMode' | 'activeRecall' | 'readerMode' | 'flashcardMode'

export interface HundredLessonChunk {
  type: 'sounds-words' | 'story' | 'sound-discovery' | 'blending-bridge' | 'rhyme-puzzle' | 'story-gauntlet'
  items: string[]
  audioPaths?: string[]
  wordAudioPaths?: string[][]
  imagePath?: string
  imagePrompt?: string
}

export interface HundredLesson {
  id: string
  lessonNumber: number
  chunks: HundredLessonChunk[]
}

export interface LetterIllustrationCard {
  id: string
  letter: string
  lowercase?: string
  keyword: string
  phrase?: string
  imagePrompt: string
  negativePrompt?: string
  backgroundImage: string
  finalCompositeImage?: string
  altText?: string
  overlay?: {
    enabled: boolean
    text: string
    secondaryText?: string
    fontFamily?: string
    fontWeight?: number | string
    color?: string
    opacity?: number
    position?: 'center' | 'left' | 'right' | 'top-left'
    x?: number
    y?: number
    fontSizeRatio?: number
    secondaryFontSizeRatio?: number
  }
}

export interface DeckIndexEntry {
  id: string
  title: string
  description?: string
  type: DeckType
  profile: ProfileId
  format: 'json' | 'chunky-clip-pack'
  source?: string
  baseUrl?: string
  assetBaseUrl?: string
  language?: string
  level?: number
  accentModel?: string
}

export interface LearningDeck {
  id: string
  title: string
  description?: string
  type: DeckType
  profile: ProfileId
  level?: number
  language?: string
  accentModel?: string
  baseUrl?: string
  assetBaseUrl?: string
  cards: LearningCard[]
}

export interface LearningCard {
  id: string
  deckId: string
  type: 'word' | 'letter' | 'phoneme' | 'sentence' | 'math' | 'chinese'
  displayText: string
  word?: string
  sentence?: string
  meaning?: string
  uppercase?: string
  lowercase?: string
  sound?: string
  primarySoundLabel?: string
  ipa?: string
  phoneme?: string
  grapheme?: string
  exampleWord?: string
  exampleSentence?: string
  category?: string
  difficulty?: number
  lessonGroup?: number
  tags?: string[]

  // Asset paths are deck-relative by default. For example:
  // public/decks/sarah-levels/images/apple.png
  // public/clip-packs/annas-reading-deck/audio/words/cat.mp3
  image?: string
  audio?: string
  exampleAudio?: string
  letterNameAudio?: string

  // Optional browser-TTS fallback for sound-only cards when MP3 files are not ready yet.
  speechCue?: string
  ttsText?: string
  ssmlSound?: string
  mouthCue?: string
  avoidTtsLetterName?: boolean

  // Older Reader Phoneme fields
  spellings?: string[]
  exampleWords?: string[]
  primarySpelling?: string
  adultIpa?: string
  childSoundName?: string
  frequencyRank?: number
  decodableExamples?: string[]
  trickyExamples?: string[]
  phonemeKey?: string

  // Math fields
  equation?: string
  mathOperation?: 'add' | 'subtract' | 'count' | 'compare'
  mathAnswer?: number
  mathAnswerOptions?: number[]
  mathVisualCount?: number
  mathVisualGroups?: number[]
  mathRemovedCount?: number
  mathQuestionKind?: 'equation' | 'picture-add' | 'picture-subtract' | 'story-add' | 'story-subtract'
  mathPrompt?: string
  mathObject?: string
  mathStoryText?: string

  // Chinese fields
  pinyin?: string
  simpleMeaning?: string
}

export interface LearningSection {
  id: SectionId
  title: string
  subtitle: string
  image: string
  imagePrompt?: string
  color: string
}

export type RewardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type RewardSlot = 'head' | 'face' | 'neck' | 'body' | 'back' | 'hand' | 'sticker' | 'background'

export interface RewardItem {
  id: string
  name: string
  rarity: RewardRarity
  slot: RewardSlot
  description: string
  badgeText: string
  colorTheme: string
  duplicateSparkles: number
  lessonsRequired?: number
  emoji?: string
  image?: string
  animation?: string
}

export interface RewardDrop {
  id: string
  itemId: string
  openedAt: string
  rarity: RewardRarity
  duplicate: boolean
  sparklePointsGained: number
}

export interface LearnerProgress {
  totalLessonsCompleted: number
  completedLessonsBySection: Record<SectionId, number>
  completedLessonsByDeck: Record<string, number>
  unlockedRewards: string[]
  selectedRewardId?: string
  storyCompletions: Record<string, number>
  rewardSystemVersion?: number
  unopenedBoxes?: number
  rewardedCompletionCount?: number
  sparklePoints?: number
  rewardInventory?: Record<string, number>
  equippedRewards?: Partial<Record<RewardSlot, string>>
  rewardHistory?: RewardDrop[]
  rarePityCount?: number
  epicPityCount?: number
  currentStreak?: number
  longestStreak?: number
  lastActiveDate?: string
  wordsReadToday?: number
  wordsReadTodayDate?: string
  studyDates?: Record<string, number>
}

export interface StoryPage {
  pageNumber: number
  text: string
  image: string
  imagePrompt?: string
  negativePrompt?: string
  altText?: string
  audio?: string
  sourcePdfPage?: number
  sourceImagePage?: number
  extractionMethod?: 'pdf-text' | 'ocr' | 'manual-review'
  ocrConfidence?: number
}

export interface Story {
  id: string
  title: string
  series?: string
  readingLevel?: string
  description?: string
  coverImage?: string
  coverPrompt?: string
  sourceType?: 'manual' | 'pdf-import'
  sourceManifest?: string
  pages: StoryPage[]
}

export interface ClipPackManifest {
  packName: string
  createdAt?: string
  vocabCsvPath?: string
  sentencesCsvPath?: string
  clips?: ClipManifestEntry[]
}

export interface ClipManifestEntry {
  id: string
  type: 'word' | 'meaning' | 'sentence' | 'sentenceMeaning' | 'prompt' | 'fullLesson' | 'combined'
  text: string
  language: string
  path: string
  label?: string
  linkedWordIds?: string[]
  linkedSentenceId?: string | null
  provider?: string
  voice?: string
}
