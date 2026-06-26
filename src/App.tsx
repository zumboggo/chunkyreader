import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
  getInstalledAudioPackSummary,
  installAudioClipPack,
  loadAudioClipPackManifest,
  playAudioUrl,
  stopAudioPlayback,
  useNarration,
  type AudioPackInstallProgress,
} from './audioClipPack'
import { loadDeckLibrary, resolveAssetUrl } from './decks'
import { loadAnneStories, resolveStoryAssetUrl } from './stories'
import type { LearningCard, LearningDeck, LearningMode, ProfileId, Story, StoryPage } from './types'
import confetti from 'canvas-confetti'
import { playSfx } from './audioEffects'
import { playNarrationClip } from './audioClipPack'

import { SectionPicker, PandaCloset, type ContinueLearningState } from './SectionPicker'
import type { SectionId } from './types'
import { LEARNING_SECTIONS } from './content/sections'
import { markLessonComplete, markStoryComplete, resetProgress, updateStreakOnLesson, type CompletionRewardResult } from './progress'
import { applyAppSettings, controllerChoices, loadAppSettings, saveAppSettings, type AppSettings, type ControllerChoice } from './appSettings'
import {
  filterMathCards,
  loadMathIndex,
  loadMathProgress,
  MATH_DIFFICULTIES,
  MATH_DIFFICULTY_DETAILS,
  saveMathIndex,
  saveMathSelection,
  type MathDifficulty,
  type MathOperation,
} from './mathProgress'
import {
  isWordMastered,
  markWordLessonIntroduced,
  readWordRecognitionProgress,
  recordWordLessonResults,
  selectWordLessonCards,
} from './wordLessonProgress'
import {
  getCloudAuthState,
  isSupabaseConfigured,
  onCloudAuthChange,
  PROGRESS_CHANGED_EVENT,
  recordLocalProgressChange,
  signInWithGoogle,
  signInWithMagicLink,
  signOutOfCloud,
  syncNow,
  type CloudSyncResult,
  type CloudSyncStatus,
} from './cloudProgressSync'
import { scheduleCard, sortCardsByDue, type FlashcardState, type Rating } from './fsrs'
import { loadFlashcardStates, saveFlashcardStates, getCardState } from './flashcardStorage'
type MascotMood = 'happy' | 'reading' | 'sad' | 'curious'
type LessonPhase = 'learn' | 'question'
type GrowingReaderView = 'home' | 'words' | 'stories' | 'phonemes' | 'collection'
type FlashcardChoice = 'again' | 'good'
type SarahQuestionKind =
  | 'soundToLetter'
  | 'letterToSound'
  | 'upperLowerMatch'
  | 'beginningSound'
  | 'wordToBeginningSound'
  | 'soundToWord'
type SarahActivityKind = 'intro' | SarahQuestionKind | 'review'
type SarahActivityStatus = 'idle' | 'try-again' | 'correct' | 'revealed'
type StoryDifficultyFilter = 'easy' | 'growing' | 'longer'
type OlderReaderQuestionKind =
  | 'peek'
  | 'pictureToWord'
  | 'wordToPicture'
  | 'audioToWord'
  | 'startsWithSound'
  | 'wordFamily'
  | 'review'
  | 'sentenceBridge'
  | 'readTogether'

type OlderReaderPhonemeActivityKind =
  | 'intro'
  | 'soundToSpelling'
  | 'spellingToSound'
  | 'exampleWord'
  | 'sameSound'
  | 'spellingPatternRecall'
  | 'mixedReview'

interface SarahActivity {
  kind: SarahActivityKind
  card: LearningCard
  options?: LearningCard[]
  textOptions?: string[]
  correctText?: string
  promptCase?: 'upper' | 'lower'
  reviewVariant?: SarahQuestionKind
}

interface OlderReaderActivity {
  kind: OlderReaderQuestionKind
  card: LearningCard
  options: LearningCard[]
  challenge?: boolean
}

interface OlderReaderPhonemeActivity {
  kind: OlderReaderPhonemeActivityKind
  card: LearningCard
  options?: LearningCard[]
  textOptions?: string[]
  correctText?: string
  reviewVariant?: OlderReaderPhonemeActivityKind
}

const LESSON_SIZE = 5
const OLDER_READER_WORD_LESSON_SIZE = 4
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SARAH_FINAL_REVIEW_SIZE = 6
const SARAH_LESSON_ADVANCE = 2
const OLDER_READER_RECOGNITION_COUNT = 12
const OLDER_READER_ACTIVITY_COUNT = OLDER_READER_WORD_LESSON_SIZE + OLDER_READER_RECOGNITION_COUNT + 1
const OLDER_READER_PEEK_COUNT = OLDER_READER_WORD_LESSON_SIZE
const GREEN_EGGS_STARTER_WORDS = new Set([
  'a',
  'am',
  'and',
  'anywhere',
  'are',
  'be',
  'boat',
  'box',
  'car',
  'could',
  'dark',
  'do',
  'eat',
  'eggs',
  'fox',
  'goat',
  'good',
  'green',
  'ham',
  'here',
  'house',
  'i',
  'if',
  'in',
  'let',
  'like',
  'may',
  'me',
  'mouse',
  'not',
  'on',
  'or',
  'rain',
  'sam',
  'say',
  'see',
  'so',
  'thank',
  'that',
  'the',
  'them',
  'there',
  'they',
  'train',
  'tree',
  'try',
  'will',
  'with',
  'would',
  'you',
])
const SARAH_REVIEW_VARIANTS: SarahQuestionKind[] = [
  'wordToBeginningSound',
  'soundToWord',
  'beginningSound',
  'upperLowerMatch',
  'wordToBeginningSound',
]
const CONFUSABLES: Record<string, string[]> = {
  b: ['d', 'p', 'q'],
  d: ['b', 'p', 'q'],
  p: ['b', 'd', 'q'],
  q: ['b', 'd', 'p'],
  m: ['n'],
  n: ['m', 'u', 'h'],
  u: ['n'],
  i: ['l'],
  l: ['i'],
  c: ['o'],
  o: ['c'],
  f: ['t'],
  t: ['f'],
  h: ['n'],
}

const encouragement = [
  'Great job!',
  'You found it!',
  'Nice reading!',
  'You did it!',
  'One more!',
]

const storyDifficultyFilters: { id: StoryDifficultyFilter; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'growing', label: 'Growing' },
  { id: 'longer', label: 'Longer' },
]
const CONTINUE_KEY = 'chunkyLearnerContinue.v1'

interface StoryStartRequest {
  storyId: string
  pageIndex: number
}

interface CloudSyncUiState {
  status: CloudSyncStatus
  email: string
  message: string
  lastSyncedAt?: string
}

function shouldIgnoreControllerKey(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat) return true
  const target = event.target
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function choiceKeyLabel(index: number) {
  return controllerChoices[index] ?? String(index + 1)
}

function isChoiceKey(event: KeyboardEvent, choice: ControllerChoice): boolean {
  const key = loadAppSettings().controllerKeys[choice]
  return Boolean(key) && event.key.toLowerCase() === key.toLowerCase()
}

function syncStatusLabel(status: CloudSyncStatus): string {
  if (status === 'unconfigured') return 'Setup needed'
  if (status === 'signed-out') return 'Signed out'
  if (status === 'idle') return 'Ready'
  if (status === 'syncing') return 'Syncing'
  if (status === 'synced') return 'Synced'
  if (status === 'offline') return 'Offline'
  return 'Needs attention'
}

function formatCloudSyncResult(result: CloudSyncResult): string {
  if (result.mergedSnapshot) return 'Merged local and cloud progress.'
  if (result.pushedSnapshot && result.pulledSnapshot) return 'Synced local and cloud progress.'
  if (result.pushedSnapshot) return 'Uploaded progress to the cloud.'
  if (result.pulledSnapshot) return 'Downloaded progress from the cloud.'
  return 'Progress is already up to date.'
}

function formatRelativeTime(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return 'Recently'
  const seconds = Math.max(0, Math.round((Date.now() - parsed) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function getMasteredWordCount(decks: LearningDeck[]): number {
  let count = 0
  for (const deck of decks) {
    if (deck.type !== 'reading-words') continue
    for (const card of deck.cards) {
      const progress = readCardProgress(deck.id, card.id)
      if (progress.recalledAt) count++
    }
  }
  return count
}

function getWordCollectionData(decks: LearningDeck[]): {
  mastered: Array<{ deck: LearningDeck; card: LearningCard; firstTry: boolean }>
  growing: Array<{ deck: LearningDeck; card: LearningCard }>
} {
  const mastered: Array<{ deck: LearningDeck; card: LearningCard; firstTry: boolean }> = []
  const growing: Array<{ deck: LearningDeck; card: LearningCard }> = []
  for (const deck of decks) {
    if (deck.type !== 'reading-words') continue
    for (const card of deck.cards) {
      const progress = readCardProgress(deck.id, card.id)
      if (progress.recalledAt) {
        mastered.push({ deck, card, firstTry: progress.firstTryRecalled !== false })
      } else if (progress.listenedAt) {
        growing.push({ deck, card })
      }
    }
  }
  return { mastered, growing }
}

function getBookWordReadiness(decks: LearningDeck[]): {
  ready: Array<{ deck: LearningDeck; card: LearningCard }>
  growing: Array<{ deck: LearningDeck; card: LearningCard }>
  fresh: Array<{ deck: LearningDeck; card: LearningCard }>
} {
  const ready: Array<{ deck: LearningDeck; card: LearningCard }> = []
  const growing: Array<{ deck: LearningDeck; card: LearningCard }> = []
  const fresh: Array<{ deck: LearningDeck; card: LearningCard }> = []
  for (const deck of decks) {
    if (deck.type !== 'reading-words') continue
    for (const card of deck.cards) {
      if (!isBookWord(card)) continue
      const progress = readWordRecognitionProgress(deck.id, card.id)
      if (isWordMastered(deck.id, card.id)) ready.push({ deck, card })
      else if (progress.introducedAt || progress.successfulLessons > 0 || readCardProgress(deck.id, card.id).recalledAt) {
        growing.push({ deck, card })
      } else {
        fresh.push({ deck, card })
      }
    }
  }
  return { ready, growing, fresh }
}

function WordCollection({
  decks,
  onBack,
}: {
  decks: LearningDeck[]
  onBack: () => void
}) {
  const { mastered, growing } = getWordCollectionData(decks)
  const bookWords = getBookWordReadiness(decks)
  const [tappedId, setTappedId] = useState('')
  const allWords = [...mastered.map(m => ({ ...m, status: 'mastered' as const })), ...growing.map(g => ({ ...g, firstTry: false, status: 'growing' as const }))]
  const bookWordTotal = bookWords.ready.length + bookWords.growing.length + bookWords.fresh.length

  function handleTap(deck: LearningDeck, card: LearningCard) {
    setTappedId(card.id)
    void playCardAudio(deck, card)
    window.setTimeout(() => setTappedId(''), 600)
  }

  function hearAll() {
    const allCards = allWords.map(m => ({ deck: m.deck, card: m.card }))
    let index = 0
    function playNext() {
      if (index >= allCards.length) return
      const { deck, card } = allCards[index]
      setTappedId(card.id)
      void playCardAudio(deck, card).then(() => {
        index++
        window.setTimeout(playNext, 300)
      })
    }
    playNext()
  }

  return (
    <section className="word-collection">
      <div className="word-collection-header">
        <button type="button" className="back-button squish" onClick={onBack}>Back</button>
        <div>
          <h1>My Words</h1>
          <p className="word-collection-count">{allWords.length} words!</p>
        </div>
        {allWords.length > 0 && (
          <button type="button" className="hear-all-button squish" onClick={hearAll}>
            <PlayIcon /> Hear All
          </button>
        )}
      </div>
      {bookWordTotal > 0 && (
        <div className="book-words-panel">
          <div className="book-words-heading">
            <div>
              <span className="stage-label">Book Words</span>
              <h2>Ready for the book</h2>
            </div>
            <strong>{bookWords.ready.length}/{bookWordTotal}</strong>
          </div>
          <div className="book-word-lanes">
            <BookWordLane
              title="Ready Words"
              words={bookWords.ready}
              tappedId={tappedId}
              onTap={handleTap}
              status="ready"
            />
            <BookWordLane
              title="Growing Words"
              words={bookWords.growing}
              tappedId={tappedId}
              onTap={handleTap}
              status="growing"
            />
            <BookWordLane
              title="New Words"
              words={bookWords.fresh}
              tappedId={tappedId}
              onTap={handleTap}
              status="new"
            />
          </div>
        </div>
      )}
      {allWords.length === 0 ? (
        <div className="word-collection-empty">
          <Mascot mood="curious" size="small" />
          <p>Complete some lessons and your words will appear here!</p>
        </div>
      ) : (
        <div className="word-collection-section">
          <div className="word-collection-grid">
            {allWords.map(({ deck, card }) => (
              <button
                key={card.id}
                type="button"
                className={`word-card-mini squish ${tappedId === card.id ? 'tapped' : ''}`}
                onClick={() => handleTap(deck, card)}
              >
                <div className="word-card-mini-picture">
                  <Picture deck={deck} card={card} />
                </div>
                <span className="word-card-mini-text">{card.word || card.displayText}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function BookWordLane({
  title,
  words,
  tappedId,
  status,
  onTap,
}: {
  title: string
  words: Array<{ deck: LearningDeck; card: LearningCard }>
  tappedId: string
  status: 'ready' | 'growing' | 'new'
  onTap: (deck: LearningDeck, card: LearningCard) => void
}) {
  return (
    <section className={`book-word-lane ${status}`}>
      <h3>{title}</h3>
      {words.length === 0 ? (
        <p>None yet</p>
      ) : (
        <div className="book-word-chips">
          {words.map(({ deck, card }) => (
            <button
              key={`${status}:${card.id}`}
              type="button"
              className={`book-word-chip squish ${tappedId === card.id ? 'tapped' : ''}`}
              onClick={() => onTap(deck, card)}
            >
              {optionLabel(card)}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function App() {
  const [decks, setDecks] = useState<LearningDeck[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [activeSection, setActiveSection] = useState<SectionId | null>(null)
  const [profile, setProfile] = useState<ProfileId | null>(null)
  const [growingView, setGrowingView] = useState<GrowingReaderView>('home')
  const [showCloset, setShowCloset] = useState(false)
  const [activeDeckId, setActiveDeckId] = useState('')
  const [mode, setMode] = useState<LearningMode>('listeningMode')
  const [cardIndex, setCardIndex] = useState(0)
  const [phase, setPhase] = useState<LessonPhase>('learn')
  const [sarahActivityIndex, setSarahActivityIndex] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAdultDetails, setShowAdultDetails] = useState(false)
  const [mathStarted, setMathStarted] = useState(false)
  const [mathOperation, setMathOperation] = useState<MathOperation>(() => loadMathProgress().operation)
  const [mathDifficulty, setMathDifficulty] = useState<MathDifficulty>(() => loadMathProgress().difficulty)
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings())
  const [showSettings, setShowSettings] = useState(false)
  const [progressVersion, setProgressVersion] = useState(0)
  const [continueState, setContinueState] = useState<ContinueLearningState | undefined>(() => readContinueState())
  const [storyStartRequest, setStoryStartRequest] = useState<StoryStartRequest | null>(null)
  const [rewardNoticeBoxes, setRewardNoticeBoxes] = useState(0)
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null)
  const [cloudSync, setCloudSync] = useState<CloudSyncUiState>({
    status: isSupabaseConfigured ? 'signed-out' : 'unconfigured',
    email: '',
    message: isSupabaseConfigured
      ? 'Sign in to sync progress across devices.'
      : 'Supabase sync is not configured yet.',
  })
  const syncTimerRef = useRef<number | null>(null)

  useEffect(() => {
    applyAppSettings(settings)
  }, [settings])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const nextDecks = await loadDeckLibrary()
        const nextStories = await loadAnneStories().catch(() => [])
        if (cancelled) return
        const params = new URLSearchParams(window.location.search)
        const initialSection = params.get('section') as SectionId | null
        const initialProfile = params.get('profile') as ProfileId | null
        const initialMode = params.get('mode') as LearningMode | null
        const wantsStories = params.get('stories') === 'true'
        
        setDecks(nextDecks)
        setStories(nextStories)
        
        if (initialSection) {
          chooseSection(initialSection, nextDecks)
        } else if (initialProfile === 'sarah') {
          chooseSection('letters', nextDecks)
        } else if (initialProfile === 'anna') {
          chooseSection(wantsStories ? 'stories' : 'words', nextDecks)
        } else {
          setActiveDeckId(nextDecks[0]?.id ?? '')
        }
        if (initialMode && ['listeningMode', 'activeRecall', 'readerMode'].includes(initialMode)) {
          setMode(initialMode)
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load decks.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleDecks = useMemo(
    () => decks.filter((deck) => !profile || deck.profile === profile || profile === 'library'),
    [decks, profile],
  )
  const sourceActiveDeck = useMemo(
    () => visibleDecks.find((deck) => deck.id === activeDeckId) ?? visibleDecks[0],
    [activeDeckId, visibleDecks],
  )
  const activeDeck = useMemo(() => {
    if (!sourceActiveDeck || sourceActiveDeck.type !== 'math') return sourceActiveDeck
    return {
      ...sourceActiveDeck,
      cards: filterMathCards(sourceActiveDeck.cards, mathOperation, mathDifficulty),
    }
  }, [mathDifficulty, mathOperation, sourceActiveDeck])
  const currentCard = activeDeck?.cards[cardIndex % Math.max(1, activeDeck.cards.length)]
  const isLessonActive = Boolean(profile && activeDeck && currentCard)
  const isSectionDashboard = !loading && !loadError && !activeSection && !profile

  const refreshProgressState = useCallback(() => {
    const nextSettings = loadAppSettings()
    setSettings(nextSettings)
    applyAppSettings(nextSettings)
    setContinueState(readContinueState())
    setProgressVersion((version) => version + 1)
  }, [])

  const handleCloudSyncNow = useCallback(async (silent = false) => {
    if (!isSupabaseConfigured) {
      setCloudSync((current) => ({
        ...current,
        status: 'unconfigured',
        message: 'Supabase sync is not configured yet.',
      }))
      return
    }
    if (!cloudUserEmail) {
      setCloudSync((current) => ({
        ...current,
        status: 'signed-out',
        message: 'Sign in to sync progress across devices.',
      }))
      return
    }
    if (!navigator.onLine) {
      setCloudSync((current) => ({
        ...current,
        status: 'offline',
        message: 'Offline. Changes will sync when this device reconnects.',
      }))
      return
    }

    setCloudSync((current) => ({
      ...current,
      status: 'syncing',
      message: silent ? current.message : 'Syncing progress...',
    }))
    try {
      const result = await syncNow()
      if (result.pulledSnapshot || result.mergedSnapshot) refreshProgressState()
      setCloudSync((current) => ({
        ...current,
        status: 'synced',
        lastSyncedAt: result.syncedAt,
        message: formatCloudSyncResult(result),
      }))
    } catch (error) {
      setCloudSync((current) => ({
        ...current,
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not sync progress.',
      }))
    }
  }, [cloudUserEmail, refreshProgressState])

  const queueCloudSync = useCallback(() => {
    if (!isSupabaseConfigured || !cloudUserEmail) return
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null
      void handleCloudSyncNow(true)
    }, 1200)
  }, [cloudUserEmail, handleCloudSyncNow])

  useEffect(() => {
    function handleProgressChange() {
      queueCloudSync()
    }

    window.addEventListener(PROGRESS_CHANGED_EVENT, handleProgressChange)
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, handleProgressChange)
  }, [queueCloudSync])

  useEffect(() => {
    let cancelled = false

    async function loadAuth() {
      try {
        const state = await getCloudAuthState()
        if (cancelled) return
        const email = state.user?.email ?? null
        setCloudUserEmail(email)
        setCloudSync((current) => ({
          ...current,
          status: !state.configured ? 'unconfigured' : email ? 'idle' : 'signed-out',
          message: !state.configured
            ? 'Supabase sync is not configured yet.'
            : email
              ? 'Signed in. Sync is ready.'
              : 'Sign in to sync progress across devices.',
        }))
      } catch (error) {
        if (cancelled) return
        setCloudSync((current) => ({
          ...current,
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load sync sign-in.',
        }))
      }
    }

    void loadAuth()
    const unsubscribe = onCloudAuthChange((state) => {
      const email = state.user?.email ?? null
      setCloudUserEmail(email)
      setCloudSync((current) => ({
        ...current,
        status: !state.configured ? 'unconfigured' : email ? 'idle' : 'signed-out',
        message: !state.configured
          ? 'Supabase sync is not configured yet.'
          : email
            ? 'Signed in. Sync is ready.'
            : 'Sign in to sync progress across devices.',
      }))
    })
    return () => {
      cancelled = true
      unsubscribe()
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!cloudUserEmail || loading) return
    void handleCloudSyncNow(true)
  }, [cloudUserEmail, handleCloudSyncNow, loading])

  useEffect(() => {
    if (!activeSection || activeSection === 'stories' || !activeDeckId) return
    rememberContinue({
      section: activeSection,
      deckId: activeDeckId,
      cardIndex,
      mode,
      label: activeDeck?.title,
    })
  }, [activeDeck?.title, activeDeckId, activeSection, cardIndex, mode])

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((current) => {
      const next = { ...current, ...patch }
      saveAppSettings(next)
      return next
    })
  }

  async function handleGoogleSignIn() {
    try {
      setCloudSync((current) => ({ ...current, status: 'syncing', message: 'Opening Google sign-in...' }))
      await signInWithGoogle()
    } catch (error) {
      setCloudSync((current) => ({
        ...current,
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not start Google sign-in.',
      }))
    }
  }

  async function handleMagicLinkSignIn() {
    try {
      await signInWithMagicLink(cloudSync.email)
      setCloudSync((current) => ({
        ...current,
        status: 'signed-out',
        message: 'Check your email for the sign-in link.',
      }))
    } catch (error) {
      setCloudSync((current) => ({
        ...current,
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not send sign-in link.',
      }))
    }
  }

  async function handleCloudSignOut() {
    try {
      await signOutOfCloud()
      setCloudUserEmail(null)
      setCloudSync((current) => ({
        ...current,
        status: 'signed-out',
        message: 'Signed out. Local progress is still saved on this device.',
      }))
    } catch (error) {
      setCloudSync((current) => ({
        ...current,
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not sign out.',
      }))
    }
  }

  function resetLocalProgress() {
    resetProgress()
    setContinueState(undefined)
    setRewardNoticeBoxes(0)
    setProgressVersion((version) => version + 1)
    setStoryStartRequest(null)
    setActiveSection(null)
    setProfile(null)
    setCardIndex(0)
    setSarahActivityIndex(0)
  }

  function handleCompletionReward(result: CompletionRewardResult) {
    setProgressVersion((version) => version + 1)
    if (result.boxesAwarded > 0) {
      setRewardNoticeBoxes((count) => count + result.boxesAwarded)
    }
  }

  function completeActiveLesson() {
    if (!activeSection || !activeDeckId) return
    handleCompletionReward(markLessonComplete(activeSection, activeDeckId))
    updateStreakOnLesson(5)
  }

  function rememberContinue(next: ContinueLearningState) {
    const state = { ...next }
    setContinueState(state)
    try {
      localStorage.setItem(CONTINUE_KEY, JSON.stringify(state))
      recordLocalProgressChange()
    } catch {
      // Continue is a convenience; lessons still work without storage.
    }
  }

  function openContinue() {
    const state = continueState || readContinueState()
    if (!state) return
    if (state.section === 'stories') {
      setStoryStartRequest(state.storyId ? { storyId: state.storyId, pageIndex: state.pageIndex ?? 0 } : null)
      setActiveSection('stories')
      setProfile(null)
      setMenuOpen(false)
      return
    }
    chooseSection(state.section)
    if (state.deckId) setActiveDeckId(state.deckId)
    if (state.mode && ['listeningMode', 'activeRecall', 'readerMode'].includes(state.mode)) {
      setMode(state.mode as LearningMode)
    }
    if (typeof state.cardIndex === 'number') setCardIndex(state.cardIndex)
  }

  function chooseSection(section: SectionId, currentDecks = decks) {
    setActiveSection(section)
    setPhase('learn')
    setSarahActivityIndex(0)
    setMenuOpen(false)
    
    let targetDeckId = ''
    let targetMode: LearningMode = 'activeRecall'
    let resumeIndex = 0
    
    if (section === 'letters') {
      targetDeckId = currentDecks.find(d => d.type === 'letters' && d.profile === 'sarah')?.id ?? ''
      targetMode = 'listeningMode'
      if (targetDeckId) {
        const saved = localStorage.getItem(`sarah-progress-${targetDeckId}`)
        resumeIndex = saved ? parseInt(saved, 10) : 0
      }
    } else if (section === 'sounds') {
      targetDeckId = currentDecks.find(d => d.type === 'phonemes' && d.profile === 'sarah')?.id ?? ''
      targetMode = 'listeningMode'
    } else if (section === 'words') {
      targetDeckId = currentDecks.find(d => d.type === 'reading-words' && d.profile === 'anna')?.id ?? ''
      targetMode = 'activeRecall'
      setGrowingView('words')
    } else if (section === 'math') {
      const savedMath = loadMathProgress()
      setMathOperation(savedMath.operation)
      setMathDifficulty(savedMath.difficulty)
      const mathDeck = currentDecks.find(d => d.type === 'math' && d.id.includes(savedMath.operation === 'add' ? 'addition' : 'subtraction'))?.id
        ?? currentDecks.find(d => d.type === 'math')?.id
        ?? ''
      const mathPool = filterMathCards(
        currentDecks.find((d) => d.id === mathDeck)?.cards ?? [],
        savedMath.operation,
        savedMath.difficulty,
      )
      const mathIdx = mathPool.length
        ? loadMathIndex(savedMath.operation, savedMath.difficulty, mathPool.length)
        : 0
      resumeIndex = mathIdx
      setMathStarted(mathIdx > 0)
      targetDeckId = mathDeck
      targetMode = 'activeRecall'
    } else if (section === 'chinese') {
      targetDeckId = currentDecks.find(d => d.type === 'chinese-vocab')?.id ?? ''
      targetMode = 'flashcardMode'
    }
    
    setCardIndex(resumeIndex)
    setActiveDeckId(targetDeckId)
    setMode(targetMode)
  }

  useEffect(() => {
    if (!activeSection && settings.lockedSection) {
      chooseSection(settings.lockedSection)
    }
  // chooseSection reads `decks` via closure; re-run when decks load or lock changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, settings.lockedSection, decks.length])

  function chooseFlashcards() {
    setActiveSection('words')
    setPhase('learn')
    setSarahActivityIndex(0)
    setMenuOpen(false)
    setCardIndex(0)
    const targetDeckId = decks.find(d => d.type === 'reading-words' && d.profile === 'anna')?.id ?? ''
    setActiveDeckId(targetDeckId)
    setMode('flashcardMode')
  }

  function startMath(operation: MathOperation, difficulty: MathDifficulty) {
    const deck = decks.find((candidate) => candidate.type === 'math' && candidate.id.includes(operation === 'add' ? 'addition' : 'subtraction'))
    if (!deck) return
    const pool = filterMathCards(deck.cards, operation, difficulty)
    setMathOperation(operation)
    setMathDifficulty(difficulty)
    setActiveDeckId(deck.id)
    setCardIndex(loadMathIndex(operation, difficulty, pool.length))
    setPhase('question')
    setSarahActivityIndex(0)
    setMathStarted(true)
    saveMathSelection(operation, difficulty)
  }

  function chooseProfile(nextProfile: ProfileId) {
    const firstDeck = decks.find((deck) => deck.profile === nextProfile) ?? decks[0]
    setProfile(nextProfile)
    /* setGrowingView('home') */
    setActiveDeckId(firstDeck?.id ?? '')
    setMode(nextProfile === 'anna' ? 'activeRecall' : 'listeningMode')
    if (nextProfile === 'sarah' && firstDeck) {
      const saved = localStorage.getItem(`sarah-progress-${firstDeck.id}`)
      setCardIndex(saved ? parseInt(saved, 10) : 0)
    } else {
      setCardIndex(0)
    }
    setPhase('learn')
    setSarahActivityIndex(0)
    setMenuOpen(false)
    /* setHundredLessonId('') */
  }

  function openGrowingWords() {
    const firstDeck = decks.find((deck) => deck.profile === 'anna' && deck.type === 'reading-words') ?? decks.find(d => d.profile === 'anna')
    setGrowingView('words')
    setActiveDeckId(firstDeck?.id ?? '')
    setMode('activeRecall')
    setCardIndex(0)
    setPhase('question')
    setSarahActivityIndex(0)
    setMenuOpen(false)
  }

  function openGrowingPhonemes() {
    const firstDeck = decks.find((deck) => deck.profile === 'anna' && deck.type === 'phonemes') ?? decks.find(d => d.profile === 'anna')
    setGrowingView('phonemes')
    setActiveDeckId(firstDeck?.id ?? '')
    setMode('activeRecall')
    setCardIndex(firstDeck?.type === 'phonemes' ? readOlderReaderPhonemeNextIndex(firstDeck.id, firstDeck.cards.length) : 0)
    setPhase('question')
    setSarahActivityIndex(0)
    setMenuOpen(false)
  }

  function openGrowingCollection() {
    setGrowingView('collection')
    setMenuOpen(false)
  }

  function moveCard(delta = 1) {
    if (!activeDeck?.cards.length) return
    setCardIndex((index) => (index + delta + activeDeck.cards.length) % activeDeck.cards.length)
    setPhase('learn')
    setSarahActivityIndex(0)
  }

  function moveWithinLesson() {
    if (!activeDeck?.cards.length) return
    if (activeDeck.type === 'math') {
      setCardIndex((index) => {
        const next = (index + 1) % activeDeck.cards.length
        saveMathIndex(mathOperation, mathDifficulty, next)
        return next
      })
      return
    }
    moveCard(1)
  }

  function changeMode(nextMode: LearningMode) {
    setMode(nextMode)
    setPhase(nextMode === 'listeningMode' ? 'learn' : 'question')
    setCardIndex(0)
    setSarahActivityIndex(0)
    setMenuOpen(false)
  }

  function moveNextLessonFromCurrent() {
    if (!activeDeck?.cards.length) return
    if (activeDeck.profile === 'sarah' && activeDeck.type === 'letters') {
      moveSarahLesson(1)
      return
    }
    if (activeDeck.profile === 'anna' && activeDeck.type === 'phonemes') {
      const lessonStart = fixedLessonStartForIndex(cardIndex, activeDeck.cards.length)
      const lessonCards = activeDeck.cards.slice(lessonStart, lessonStart + LESSON_SIZE)
      setCardIndex(completeOlderReaderPhonemeLesson(activeDeck, lessonCards))
      setPhase('question')
      setSarahActivityIndex(0)
      setMenuOpen(false)
      return
    }
    const orderedCards = orderCardsForMode(activeDeck, mode)
    const lessonSize = activeDeck.profile === 'anna' && activeDeck.type === 'reading-words'
      ? OLDER_READER_WORD_LESSON_SIZE
      : LESSON_SIZE
    const lessonStart = lessonStartForIndex(cardIndex, orderedCards.length, lessonSize)
    const lessonCards = orderedCards.slice(lessonStart, lessonStart + lessonSize)
    if (mode === 'listeningMode') markCardsListened(activeDeck.id, lessonCards)
    setCardIndex((lessonStart + lessonSize) % orderedCards.length)
    setPhase(mode === 'listeningMode' ? 'learn' : 'question')
    setSarahActivityIndex(0)
    setMenuOpen(false)
  }

  function finishCurrentPath() {
    if (profile === 'anna') {
      /* setGrowingView('home') */
    } else {
      setProfile(null)
    }
    setMenuOpen(false)
  }

  function moveSarahLesson(deltaLessons: number) {
    if (!activeDeck?.cards.length) return
    const totalLessons = sarahLetterLessonCount(activeDeck.cards.length)
    const currentLesson = sarahLetterLessonNumberForIndex(cardIndex, activeDeck.cards.length) - 1
    const nextLesson = (currentLesson + deltaLessons + totalLessons) % totalLessons
    const nextIndex = sarahLetterLessonStartForNumber(nextLesson, activeDeck.cards.length)
    setCardIndex(nextIndex)
    if (activeDeck.profile === 'sarah') {
      localStorage.setItem(`sarah-progress-${activeDeck.id}`, String(nextIndex))
      recordLocalProgressChange()
    }
    setPhase('learn')
    setSarahActivityIndex(0)
  }

  function restartLesson() {
    setCardIndex((index) => {
      const lessonStart = activeDeck?.profile === 'sarah' && activeDeck?.type === 'letters'
        ? sarahLetterLessonStartForIndex(index, activeDeck.cards.length)
        : lessonStartForIndex(
            index,
            activeDeck?.cards.length ?? 0,
            activeDeck?.profile === 'anna' && activeDeck?.type === 'reading-words'
              ? OLDER_READER_WORD_LESSON_SIZE
              : LESSON_SIZE,
          )
      return lessonStart
    })
    setPhase('learn')
    setSarahActivityIndex(0)
    setMenuOpen(false)
  }

  return (
    <main className={`app-shell ${isLessonActive ? 'lesson-active' : ''} ${isSectionDashboard ? 'section-dashboard-active' : ''}`}>
      <RotateOverlay />
      <header className="topbar">
        <button
          className="brand-button squish"
          type="button"
          onClick={() => {
            setActiveSection(null)
            setProfile(null)
            /* setGrowingView('home') */
            setMenuOpen(false)
            /* setHundredLessonId('') */
          }}
        >
          <Mascot size="small" mood="reading" />
          <span>
            <strong>Home</strong>
          </span>
        </button>
      </header>

      {showCloset && <PandaCloset onClose={() => setShowCloset(false)} />}
      {rewardNoticeBoxes > 0 && (
        <RewardBoxNotice
          boxes={rewardNoticeBoxes}
          onOpen={() => {
            setRewardNoticeBoxes(0)
            setShowCloset(true)
          }}
          onLater={() => setRewardNoticeBoxes(0)}
        />
      )}
      {showSettings && (
        <ParentSettingsModal
          settings={settings}
          onChange={updateSettings}
          onResetProgress={resetLocalProgress}
          cloudSync={cloudSync}
          cloudUserEmail={cloudUserEmail}
          onCloudEmailChange={(email) => setCloudSync((current) => ({ ...current, email }))}
          onGoogleSignIn={() => void handleGoogleSignIn()}
          onMagicLinkSignIn={() => void handleMagicLinkSignIn()}
          onCloudSignOut={() => void handleCloudSignOut()}
          onCloudSyncNow={() => void handleCloudSyncNow(false)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {loading ? (
        <section className="loading-screen">
          <Mascot mood="curious" />
          <h1>Getting the cards ready</h1>
        </section>
      ) : loadError ? (
        <section className="error-screen">
          <Mascot mood="sad" />
          <h1>Decks need a little help</h1>
          <p>{loadError}</p>
        </section>
      ) : !activeSection && !profile ? (
        <SectionPicker
          key={progressVersion}
          onChooseSection={(s) => chooseSection(s)}
          onChooseFlashcards={() => chooseFlashcards()}
          onShowCloset={() => setShowCloset(true)}
          onShowSettings={() => setShowSettings(true)}
          onContinue={openContinue}
          continueState={continueState}
          settings={settings}
        />
      ) : activeSection === 'stories' ? (
        <StorySection
          stories={stories}
          onBack={() => setActiveSection(null)}
          startRequest={storyStartRequest}
          onStartConsumed={() => setStoryStartRequest(null)}
          onRememberContinue={rememberContinue}
          onReward={handleCompletionReward}
        />
      ) : activeSection === 'math' && !mathStarted ? (
        <MathLevelPicker
          operation={mathOperation}
          difficulty={mathDifficulty}
          onOperationChange={setMathOperation}
          onDifficultyChange={setMathDifficulty}
          onStart={startMath}
          onBack={() => setActiveSection(null)}
        />
      ) : activeSection === 'words' && growingView === 'collection' ? (
        <WordCollection
          decks={decks}
          onBack={() => setGrowingView('home')}
        />
      ) : activeSection === 'words' && growingView === 'home' ? (
        <GrowingReaderHome
          decks={decks}
          stories={stories}
          onWords={openGrowingWords}
          onStories={() => {
            setActiveSection('stories')
            setGrowingView('home')
          }}
          onPhonemes={openGrowingPhonemes}
          onCollection={openGrowingCollection}
        />
      ) : activeDeck && currentCard ? (
        <LearningScreen
          decks={decks.filter(d => activeSection ? d.type === activeDeck.type : true)}
          activeDeck={activeDeck}
          activeDeckId={activeDeckId}
          card={currentCard}
          cardIndex={cardIndex}
          mode={mode}
          phase={phase}
          sarahActivityIndex={sarahActivityIndex}
          showAdultDetails={showAdultDetails}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onDeckChange={(deckId) => {
            setActiveDeckId(deckId)
            setCardIndex(0)
            setPhase('learn')
            setSarahActivityIndex(0)
            setMenuOpen(false)
          }}
          onNext={moveWithinLesson}
          onSarahActivityChange={setSarahActivityIndex}
          onSarahLessonChange={moveSarahLesson}
          onBackToPath={settings.lockedSection ? undefined : () => {
            if (activeSection === 'words') {
              setGrowingView('home')
            } else if (activeSection === 'math') {
              setMathStarted(false)
            } else {
              setActiveSection(null)
            }
          }}
          onRestartLesson={restartLesson}
          onModeChange={changeMode}
          onModeToggle={(nextMode) => {
            setMode(nextMode)
            setPhase(nextMode === 'listeningMode' ? 'learn' : 'question')
            setMenuOpen(false)
          }}
          onNextLesson={() => {
            completeActiveLesson()
            moveNextLessonFromCurrent()
          }}
          onAdvanceLesson={moveNextLessonFromCurrent}
          onLessonComplete={completeActiveLesson}
          onDone={() => {
            if (activeSection === 'words') {
              setGrowingView('home')
            } else if (activeSection === 'math') {
              setMathStarted(false)
            } else {
              setActiveSection(null)
            }
          }}
          onGoHome={settings.lockedSection ? undefined : () => {
            if (activeSection === 'words') {
              setGrowingView('home')
            } else {
              setActiveSection(null)
            }
          }}
          onToggleAdultDetails={() => setShowAdultDetails((v) => !v)}
          mathDifficulty={mathDifficulty}
          onChangeMathDifficulty={(diff) => startMath(mathOperation, diff)}
        />
      ) : (
        <section className="empty-screen">
          <Mascot mood="curious" />
          <h1>No cards yet</h1>
          <p>Add cards to this deck and Chunky Learner will pick them up.</p>
        </section>
      )}
    </main>
  )
}

function ParentSettingsModal({
  settings,
  onChange,
  onResetProgress,
  cloudSync,
  cloudUserEmail,
  onCloudEmailChange,
  onGoogleSignIn,
  onMagicLinkSignIn,
  onCloudSignOut,
  onCloudSyncNow,
  onClose,
}: {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
  onResetProgress: () => void
  cloudSync: CloudSyncUiState
  cloudUserEmail: string | null
  onCloudEmailChange: (email: string) => void
  onGoogleSignIn: () => void
  onMagicLinkSignIn: () => void
  onCloudSignOut: () => void
  onCloudSyncNow: () => void
  onClose: () => void
}) {
  const [confirmReset, setConfirmReset] = useState(false)

  function reset() {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    onResetProgress()
    onClose()
  }

  function updateControllerKey(choice: ControllerChoice, value: string) {
    const key = value.trim()
    onChange({
      controllerKeys: {
        ...settings.controllerKeys,
        [choice]: key,
      },
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content parent-settings">
        <button className="close-button" onClick={onClose}>Close</button>
        <span className="prompt-topline">Parent</span>
        <h2>Settings</h2>
        <div className="settings-list">
          <label className="settings-toggle">
            <span>
              <strong>Autoplay audio</strong>
              <small>Play words and story pages when they open.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.autoplayAudio}
              onChange={(event) => onChange({ autoplayAudio: event.currentTarget.checked })}
            />
          </label>
          <label className="settings-toggle">
            <span>
              <strong>Dark mode</strong>
              <small>Use a softer low-light palette.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.darkMode}
              onChange={(event) => onChange({ darkMode: event.currentTarget.checked })}
            />
          </label>
          <label className="settings-toggle">
            <span>
              <strong>Show progress</strong>
              <small>Show lesson counts and progress dots.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.showProgress}
              onChange={(event) => onChange({ showProgress: event.currentTarget.checked })}
            />
          </label>
          <section className="controller-key-settings" aria-label="Controller choice keys">
            <div>
              <strong>Controller keys</strong>
              <small>Use five buttons for choices, flashcards, and simple navigation.</small>
            </div>
            <div className="controller-key-grid">
              {controllerChoices.map((choice) => (
                <label key={choice}>
                  <span>Choice {choice}</span>
                  <input
                    type="text"
                    value={settings.controllerKeys[choice]}
                    maxLength={12}
                    onChange={(event) => updateControllerKey(choice, event.currentTarget.value)}
                  />
                </label>
              ))}
            </div>
          </section>
          <section className="toddler-lock-settings" aria-label="Toddler lock">
            <div className="toddler-lock-heading">
              <strong>Toddler lock</strong>
              <small>Locks the app to one section — hides back navigation so little fingers can't wander away.</small>
            </div>
            <div className="toddler-lock-grid">
              <button
                type="button"
                className={`toddler-lock-option ${!settings.lockedSection ? 'active' : ''}`}
                onClick={() => onChange({ lockedSection: null })}
              >
                Off
              </button>
              {LEARNING_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`toddler-lock-option ${settings.lockedSection === section.id ? 'active' : ''}`}
                  style={{ backgroundColor: settings.lockedSection === section.id ? section.color : undefined }}
                  onClick={() => onChange({ lockedSection: section.id })}
                >
                  {section.title}
                </button>
              ))}
            </div>
          </section>
        </div>
        <section className="cloud-sync-panel">
          <div className="cloud-sync-title-row">
            <div>
              <strong>Cloud sync</strong>
              <small>Save progress across signed-in devices.</small>
            </div>
            <span className={`sync-pill sync-${cloudSync.status}`}>
              {syncStatusLabel(cloudSync.status)}
            </span>
          </div>
          {cloudUserEmail ? (
            <>
              <dl className="cloud-sync-stats">
                <div>
                  <dt>Account</dt>
                  <dd>{cloudUserEmail}</dd>
                </div>
                <div>
                  <dt>Last sync</dt>
                  <dd>{cloudSync.lastSyncedAt ? formatRelativeTime(cloudSync.lastSyncedAt) : 'Not yet'}</dd>
                </div>
              </dl>
              <div className="settings-button-row">
                <button
                  type="button"
                  className="primary"
                  disabled={cloudSync.status === 'syncing'}
                  onClick={onCloudSyncNow}
                >
                  {cloudSync.status === 'syncing' ? 'Syncing...' : 'Sync now'}
                </button>
                <button type="button" onClick={onCloudSignOut}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="settings-button-row">
                <button
                  type="button"
                  className="primary"
                  disabled={!isSupabaseConfigured || cloudSync.status === 'syncing'}
                  onClick={onGoogleSignIn}
                >
                  Continue with Google
                </button>
              </div>
              <div className="magic-link-row">
                <input
                  type="email"
                  placeholder="Email for magic link"
                  value={cloudSync.email}
                  disabled={!isSupabaseConfigured}
                  onChange={(event) => onCloudEmailChange(event.currentTarget.value)}
                />
                <button
                  type="button"
                  disabled={!isSupabaseConfigured || cloudSync.status === 'syncing'}
                  onClick={onMagicLinkSignIn}
                >
                  Send link
                </button>
              </div>
            </>
          )}
          <small className="cloud-sync-message">{cloudSync.message}</small>
        </section>
        <button type="button" className="danger-button" onClick={reset}>
          {confirmReset ? 'Tap again to reset progress' : 'Reset local progress'}
        </button>
      </div>
    </div>
  )
}

function RewardBoxNotice({
  boxes,
  onOpen,
  onLater,
}: {
  boxes: number
  onOpen: () => void
  onLater: () => void
}) {
  return (
    <section className="reward-box-notice" aria-live="polite" onClick={onOpen} style={{cursor: 'pointer'}}>
      <div className="reward-box-mini" aria-hidden="true">Box</div>
      <div>
        <strong>You found a Panda Box!</strong>
        <span>{boxes > 1 ? `${boxes} boxes are waiting.` : 'A surprise is waiting.'}</span>
      </div>
      <button type="button" className="primary" onClick={onOpen}>Open</button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onLater(); }}>Later</button>
    </section>
  )
}

function MathLevelPicker({
  operation,
  difficulty,
  onOperationChange,
  onDifficultyChange,
  onStart,
  onBack,
}: {
  operation: MathOperation
  difficulty: MathDifficulty
  onOperationChange: (operation: MathOperation) => void
  onDifficultyChange: (difficulty: MathDifficulty) => void
  onStart: (operation: MathOperation, difficulty: MathDifficulty) => void
  onBack: () => void
}) {
  const detail = MATH_DIFFICULTY_DETAILS[difficulty]

  const cycleDifficulty = useCallback(() => {
    const index = MATH_DIFFICULTIES.indexOf(difficulty)
    const nextDifficulty = MATH_DIFFICULTIES[(index + 1) % MATH_DIFFICULTIES.length]
    onDifficultyChange(nextDifficulty)
    saveMathSelection(operation, nextDifficulty)
  }, [difficulty, onDifficultyChange, operation])

  const selectOperation = useCallback((nextOperation: MathOperation) => {
    onOperationChange(nextOperation)
    saveMathSelection(nextOperation, difficulty)
  }, [difficulty, onOperationChange])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreControllerKey(event)) return
      if (isChoiceKey(event, 'A')) {
        event.preventDefault()
        onStart(operation, difficulty)
      } else if (isChoiceKey(event, 'B')) {
        event.preventDefault()
        cycleDifficulty()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleDifficulty, difficulty, onStart, operation])

  return (
    <section className="math-level-picker">
      <button type="button" className="soft-back" onClick={onBack}>Back</button>
      <div className="math-picker-heading">
        <span className="prompt-topline">Math</span>
        <h1>What shall we practice?</h1>
      </div>
      <div className="math-operation-toggle" aria-label="Choose math operation">
        <button
          type="button"
          className={operation === 'add' ? 'active' : ''}
          onClick={() => selectOperation('add')}
        >
          Addition
        </button>
        <button
          type="button"
          className={operation === 'subtract' ? 'active' : ''}
          onClick={() => selectOperation('subtract')}
        >
          Subtraction
        </button>
      </div>
      <div className="math-difficulty-track" aria-label={`Four math levels. ${detail.title} is selected.`}>
        {MATH_DIFFICULTIES.map((level) => {
          const lvl = MATH_DIFFICULTY_DETAILS[level]
          return (
            <button
              key={level}
              type="button"
              className={`math-slope-btn slope-${level} ${level === difficulty ? 'active' : ''}`}
              aria-current={level === difficulty ? 'step' : undefined}
              onClick={() => {
                onDifficultyChange(level)
                saveMathSelection(operation, level)
              }}
            >
              <span className="slope-icon" aria-hidden="true">{lvl.icon}</span>
              <span className="slope-name">{lvl.shortName}</span>
            </button>
          )
        })}
      </div>
      <article className={`math-difficulty-card difficulty-${difficulty}`}>
        <span className="math-difficulty-icon" aria-hidden="true">{detail.icon}</span>
        <h2>{detail.title}</h2>
        <p>{detail.descriptions[operation]}</p>
      </article>
      <div className="math-picker-actions">
        <button type="button" className="primary choice-action" onClick={() => onStart(operation, difficulty)}>
          <span>A</span>
          Start
        </button>
        <button type="button" className="choice-action" onClick={cycleDifficulty}>
          <span>B</span>
          Next Level
        </button>
      </div>
    </section>
  )
}

function HomeScreen({
  onChoose,
  decks,
  onShowStickers,
}: {
  onChoose: (profile: ProfileId) => void
  decks: LearningDeck[]
  onShowStickers: () => void
}) {
  const annaCount = decks.filter((deck) => deck.profile === 'anna').reduce((sum, deck) => sum + deck.cards.length, 0)
  const sarahCount = decks.filter((deck) => deck.profile === 'sarah').reduce((sum, deck) => sum + deck.cards.length, 0)

  return (
    <section className="home-screen">
      <div className="mobile-logo-block" aria-hidden="true">
        <ChunkyLogo />
        <span>Let's read together!</span>
      </div>
      <div className="home-copy">
        <Mascot mood="happy" />
        <div>
          <h1>Who is learning today?</h1>
          <p>Fast, happy reading practice with words, sounds, pictures, and big friendly buttons.</p>
        </div>
      </div>
      <div className="path-grid" aria-label="Choose a learning path">
        <button type="button" className="path-card anna-path" onClick={() => onChoose('anna')}>
          <img className="profile-image" src={`${import.meta.env.BASE_URL}assets/profiles/anna-red-shirt.png`} alt="" />
          <span className="path-badge">Words + Stories</span>
          <strong>Older Reader</strong>
          <small>{annaCount} reading cards</small>
        </button>
        <button type="button" className="path-card sarah-path" onClick={() => onChoose('sarah')}>
          <img className="profile-image" src={`${import.meta.env.BASE_URL}assets/profiles/sarah-reading.png`} alt="" />
          <span className="path-badge">Sounds</span>
          <strong>Earliest Reader</strong>
          <small>{sarahCount} letter and sound cards</small>
        </button>
        <button type="button" className="path-card" onClick={() => onChoose('100-lessons')} style={{ background: 'var(--c-background-glass)', borderColor: 'var(--c-brand)' }}>
          <span className="choice-sticker" aria-hidden="true">100</span>
          <span className="path-badge">Classic</span>
          <strong>100 Lessons</strong>
          <small>Teach Your Child to Read</small>
        </button>
      </div>
      <div style={{display: 'flex', justifyContent: 'center', marginTop: '1rem'}}>
        <button className="sticker-nav-button squish" style={{fontSize: '1.2rem', padding: '0.75rem 1.5rem'}} onClick={onShowStickers}>Sticker Book</button>
      </div>
    </section>
  )
}

function GrowingReaderHome({
  decks,
  stories,
  onWords,
  onStories,
  onPhonemes,
  onCollection,
}: {
  decks: LearningDeck[]
  stories: Story[]
  onWords: () => void
  onStories: () => void
  onPhonemes: () => void
  onCollection: () => void
}) {
  const wordCount = decks.filter(d => d.type === 'reading-words').reduce((sum, deck) => sum + deck.cards.length, 0)
  const pageCount = stories.reduce((sum, story) => sum + story.pages.length, 0)
  const phonemeCount = decks.filter(d => d.type === 'phonemes').reduce((sum, deck) => sum + deck.cards.length, 0)
  const masteredCount = getMasteredWordCount(decks)
  const totalWordCount = decks.filter(d => d.type === 'reading-words').reduce((sum, deck) => sum + deck.cards.length, 0)

  return (
    <section className="growing-reader-home">
      <div className="reader-hero">
        <img className="reader-hero-child" src={`${import.meta.env.BASE_URL}assets/profiles/anna-red-shirt.png`} alt="" />
        <div>
          <ChunkyLogo compact />
          <h1>Words and Stories</h1>
          <p>Choose one happy reading pocket.</p>
        </div>
        <Mascot mood="reading" />
      </div>
      <div className="reader-choice-grid" aria-label="Choose a reading activity">
        <button type="button" className="reader-choice collection-choice" onClick={onCollection}>
          <span className="choice-sticker" aria-hidden="true">Star</span>
          <strong>My Words</strong>
          <small>{totalWordCount} words to explore!</small>
        </button>
        <button type="button" className="reader-choice phoneme-choice" onClick={onPhonemes}>
          <span className="choice-sticker" aria-hidden="true">Sound</span>
          <strong>Phonemes</strong>
          <small>{phonemeCount} sounds & spellings</small>
        </button>
        <button type="button" className="reader-choice word-choice" onClick={onWords}>
          <span className="choice-sticker" aria-hidden="true">ABC</span>
          <strong>Read Words</strong>
          <small>{wordCount} words to read</small>
        </button>
        <button type="button" className="reader-choice story-choice" onClick={onStories}>
          <span className="choice-sticker book-sticker" aria-hidden="true" />
          <strong>Read a Story</strong>
          <small>{stories.length} stories, {pageCount} pages</small>
        </button>
      </div>
    </section>
  )
}

function StorySection({
  stories,
  onBack,
  startRequest,
  onStartConsumed,
  onRememberContinue,
  onReward,
}: {
  stories: Story[]
  onBack: () => void
  startRequest: StoryStartRequest | null
  onStartConsumed: () => void
  onRememberContinue: (state: ContinueLearningState) => void
  onReward: (result: CompletionRewardResult) => void
}) {
  const [selectedStoryId, setSelectedStoryId] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [complete, setComplete] = useState(false)
  const [difficultyFilter, setDifficultyFilter] = useState<StoryDifficultyFilter>('easy')
  const selectedStory = stories.find((story) => story.id === selectedStoryId)
  const resumeStory = stories.find(s => readStoryProgress(s.id, s.pages.length) > 0)
  const filteredStories = stories.filter((story) => storyDifficulty(story) === difficultyFilter)

  function openStory(story: Story) {
    setSelectedStoryId(story.id)
    setPageIndex(0)
    setComplete(false)
    onRememberContinue({
      section: 'stories',
      storyId: story.id,
      pageIndex: 0,
      label: story.title,
    })
  }

  function resume(story: Story) {
    const nextPage = readStoryProgress(story.id, story.pages.length)
    setSelectedStoryId(story.id)
    setPageIndex(nextPage)
    setComplete(false)
    onRememberContinue({
      section: 'stories',
      storyId: story.id,
      pageIndex: nextPage,
      label: story.title,
    })
  }

  function restartStory(story: Story) {
    saveStoryProgress(story.id, 0)
    setPageIndex(0)
    setComplete(false)
  }

  useEffect(() => {
    if (!startRequest) return
    const story = stories.find((candidate) => candidate.id === startRequest.storyId)
    if (!story) {
      onStartConsumed()
      return
    }
    const nextPage = Math.max(0, Math.min(story.pages.length - 1, startRequest.pageIndex))
    setSelectedStoryId(story.id)
    setPageIndex(nextPage)
    setComplete(false)
    onStartConsumed()
  }, [onStartConsumed, startRequest, stories])

  if (selectedStory) {
    return (
      <StoryReader
        story={selectedStory}
        pageIndex={pageIndex}
        complete={complete}
        onBack={() => {
          setSelectedStoryId('')
          setComplete(false)
        }}
        onRestart={() => restartStory(selectedStory)}
        onPageIndexChange={(index) => {
          setPageIndex(index)
          saveStoryProgress(selectedStory.id, index)
          onRememberContinue({
            section: 'stories',
            storyId: selectedStory.id,
            pageIndex: index,
            label: selectedStory.title,
          })
        }}
        onComplete={() => {
          setComplete(true)
          saveStoryProgress(selectedStory.id, selectedStory.pages.length - 1)
          onReward(markStoryComplete(selectedStory.id))
          updateStreakOnLesson(1)
          onRememberContinue({
            section: 'stories',
            storyId: selectedStory.id,
            pageIndex: selectedStory.pages.length - 1,
            label: selectedStory.title,
          })
        }}
      />
    )
  }

  return (
    <section className="story-library">
      <div className="story-library-header">
        <button type="button" className="soft-back" onClick={onBack}>Back</button>
        <div>
          <span className="prompt-topline">Stories</span>
          <h1>Read a Story</h1>
          <p>Pick a story pocket.</p>
        </div>
        <AudioPackButton />
        <Mascot mood="happy" />
      </div>

      <div className="story-level-tabs" aria-label="Choose story level">
        {storyDifficultyFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={filter.id === difficultyFilter ? 'active' : ''}
            onClick={() => setDifficultyFilter(filter.id)}
          >
            {filter.label}
            <span>{stories.filter((story) => storyDifficulty(story) === filter.id).length}</span>
          </button>
        ))}
      </div>

      {stories.length === 0 ? (
        <section className="empty-screen story-empty">
          <Mascot mood="curious" />
          <h2>Stories are coming soon</h2>
          <p>Add stories to <strong>public/stories/anne-stories.json</strong>.</p>
        </section>
      ) : (
        <div className="story-bookshelf" aria-label="Story library">
          {resumeStory && !selectedStoryId && (
            <button type="button" className="story-resume-book" onClick={() => resume(resumeStory)}>
              <span>Continue reading</span>
              <strong>{resumeStory.title}</strong>
            </button>
          )}
          {filteredStories.length === 0 && (
            <section className="empty-screen story-empty">
              <Mascot mood="curious" />
              <h2>No stories here yet</h2>
              <p>Try another level.</p>
            </section>
          )}
          {filteredStories.map((story, index) => {
            const cover = story.coverImage || story.pages[0]?.image
            const savedPage = readStoryProgress(story.id, story.pages.length)
            return (
              <button key={story.id} type="button" className="story-card" onClick={() => openStory(story)}>
                <span className="story-book-cover">
                  <AssetImage
                    src={resolveStoryAssetUrl(cover)}
                    label={`${story.title} cover`}
                    className="story-cover"
                    fallback={<StoryImageFallback title={story.title} pageNumber={1} />}
                  />
                  <span className="story-cover-shade" aria-hidden="true" />
                  <span className="story-cover-copy">
                    <small>Story {index + 1}</small>
                    <strong>{story.title}</strong>
                  </span>
                  {savedPage > 0 && <span className="story-resume-pill">Page {savedPage + 1}</span>}
                </span>
                <span className="story-book-meta">
                  <span>{story.pages.length} pages</span>
                  <span>Read</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function storyDifficulty(story: Story): StoryDifficultyFilter {
  if (story.readingLevel === 'older reader') return story.pages.length > 10 ? 'longer' : 'growing'
  if (story.pages.length > 6) return 'longer'
  if (story.pages.length > 3) return 'growing'
  return 'easy'
}

function StoryReader({
  story,
  pageIndex,
  complete,
  onBack,
  onRestart,
  onPageIndexChange,
  onComplete,
}: {
  story: Story
  pageIndex: number
  complete: boolean
  onBack: () => void
  onRestart: () => void
  onPageIndexChange: (index: number) => void
  onComplete: () => void
}) {
  const page = story.pages[Math.min(pageIndex, story.pages.length - 1)]
  const narration = useNarration(
    complete ? 'ui:story:complete' : `story:${story.id}:page:${page.pageNumber}`,
    complete ? 'The End. You finished the story!' : page.text,
    `${story.id}:${complete ? 'complete' : page.pageNumber}`,
    complete ? undefined : page.audio,
  )

  const nextPage = useCallback(() => {
    if (pageIndex >= story.pages.length - 1) {
      onComplete()
      return
    }
    onPageIndexChange(pageIndex + 1)
  }, [onComplete, onPageIndexChange, pageIndex, story.pages.length])

  const previousPage = useCallback(() => {
    if (pageIndex > 0) {
      onPageIndexChange(pageIndex - 1)
    }
  }, [onPageIndexChange, pageIndex])

  useEffect(() => {
    if (complete) return undefined

    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreControllerKey(event)) return
      if (isChoiceKey(event, 'A')) {
        event.preventDefault()
        nextPage()
      }
      if (isChoiceKey(event, 'B')) {
        event.preventDefault()
        previousPage()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [complete, nextPage, previousPage])

  if (complete) {
    return (
      <section className="story-complete">
        <div className="celebration-burst" aria-hidden="true" />
        <Mascot mood="happy" />
        <span className="prompt-topline">{story.title}</span>
        <h1>The End</h1>
        <p>You finished the story!</p>
        <div className="completion-actions story-actions">
          <button type="button" className="sound-button read-to-me" onClick={narration.replay}>
            <PlayIcon /> Play Again
          </button>
          <button type="button" onClick={onRestart}>Read Again</button>
          <button type="button" className="primary" onClick={onBack}>Back to Stories</button>
        </div>
      </section>
    )
  }

  return (
    <section className="story-reader">
      <div className="story-reader-top">
        <button type="button" className="soft-back" onClick={onBack}>Back to Stories</button>
        <div>
          <span>{story.title}</span>
          <strong>Page {page.pageNumber} of {story.pages.length}</strong>
        </div>
      </div>
      <div className="story-page-progress" aria-label="Story page progress">
        {story.pages.map((storyPage, index) => (
          <span key={storyPage.pageNumber} className={index <= pageIndex ? 'active' : ''} />
        ))}
      </div>
      <article key={`${story.id}:${page.pageNumber}`} className="story-page-card">
        <StoryPageImage page={page} story={story} />
        <div className="story-text-panel">
          <div className="story-page-label">Page {page.pageNumber}</div>
          <div className="story-lines">
            {page.text.split('\n').map((line, index) => <p key={`${page.pageNumber}:${index}`}>{line}</p>)}
          </div>
          <button type="button" className="sound-button read-to-me" onClick={narration.replay}>
            <PlayIcon /> {narration.shouldShowPlayButton ? 'Tap to Hear' : 'Read to Me'}
          </button>
        </div>
      </article>
      <div className="story-nav" style={{flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center'}}>
        <button type="button" onClick={onRestart}>Start Over</button>
        <button type="button" disabled={pageIndex === 0} onClick={previousPage}>
          Back Page
        </button>
        <button type="button" className="primary" onClick={nextPage}>
          {pageIndex >= story.pages.length - 1 ? 'Finish' : 'Next Page'}
        </button>
        <button type="button" onClick={onBack}>Done</button>
      </div>
    </section>
  )
}

function StoryPageImage({ page, story }: { page: StoryPage; story: Story }) {
  const src = resolveStoryAssetUrl(page.image)
  const label = page.altText || `${story.title} page ${page.pageNumber}`
  const [failedSrc, setFailedSrc] = useState<string | undefined>()

  if (!src || failedSrc === src) {
    return (
      <div className="story-page-image">
        <StoryImageFallback title={story.title} pageNumber={page.pageNumber} />
      </div>
    )
  }

  return (
    <div className="story-page-image">
      <div className="story-image-scroll" tabIndex={0} aria-label="Scrollable story picture">
        <img src={src} alt={label} onError={() => setFailedSrc(src)} />
      </div>
    </div>
  )
}

function StoryImageFallback({ title, pageNumber }: { title: string; pageNumber: number }) {
  return (
    <div className="story-image-fallback" aria-label={`${title} page ${pageNumber} illustration placeholder`}>
      <span aria-hidden="true" />
      <strong>{title}</strong>
      <small>Page {pageNumber} picture soon</small>
    </div>
  )
}

function LearningScreen({
  decks,
  activeDeck,
  activeDeckId,
  card,
  cardIndex,
  mode,
  phase,
  sarahActivityIndex,
  showAdultDetails,
  menuOpen,
  onMenuToggle,
  onDeckChange,
  onNext,
  onSarahActivityChange,
  onSarahLessonChange,
  onBackToPath,
  onRestartLesson,
  onModeChange,
  onModeToggle,
  onNextLesson,
  onAdvanceLesson,
  onLessonComplete,
  onDone,
  onGoHome,
  onToggleAdultDetails,
  mathDifficulty,
  onChangeMathDifficulty,
}: {
  decks: LearningDeck[]
  activeDeck: LearningDeck
  activeDeckId: string
  card: LearningCard
  cardIndex: number
  mode: LearningMode
  phase: LessonPhase
  sarahActivityIndex: number
  showAdultDetails: boolean
  menuOpen: boolean
  onMenuToggle: () => void
  onDeckChange: (deckId: string) => void
  onNext: () => void
  onSarahActivityChange: (index: number) => void
  onSarahLessonChange: (deltaLessons: number) => void
  onBackToPath?: () => void
  onRestartLesson: () => void
  onModeChange: (mode: LearningMode) => void
  onModeToggle: (mode: LearningMode) => void
  onNextLesson: () => void
  onAdvanceLesson: () => void
  onLessonComplete: () => void
  onDone: () => void
  onGoHome?: () => void
  onToggleAdultDetails: () => void
  mathDifficulty: MathDifficulty
  onChangeMathDifficulty: (d: MathDifficulty) => void
}) {
  const [fsrsActive, setFsrsActive] = useState(false)
  const isSarahLetters = activeDeck.profile === 'sarah' && activeDeck.type === 'letters'
  const isOlderReaderWords = activeDeck.profile === 'anna' && activeDeck.type === 'reading-words'
  const isOlderReaderPhonemes = activeDeck.profile === 'anna' && activeDeck.type === 'phonemes'
  const lessonDeckCards = isSarahLetters || isOlderReaderPhonemes ? activeDeck.cards : orderCardsForMode(activeDeck, mode)
  const wordLessonId = `${activeDeck.id}:lesson:${Math.floor(cardIndex / OLDER_READER_WORD_LESSON_SIZE) + 1}`
  const selectedWordLessonCards = useMemo(
    () => isOlderReaderWords
      ? selectWordLessonCards(activeDeck.id, activeDeck.cards, wordLessonId)
      : [],
    [activeDeck.cards, activeDeck.id, isOlderReaderWords, wordLessonId],
  )
  const activeCard = isOlderReaderWords
    ? selectedWordLessonCards[0] ?? card
    : lessonDeckCards[cardIndex % Math.max(1, lessonDeckCards.length)] ?? card
  const lessonStart = isSarahLetters
    ? sarahLetterLessonStartForIndex(cardIndex, lessonDeckCards.length)
    : isOlderReaderPhonemes
    ? fixedLessonStartForIndex(cardIndex, lessonDeckCards.length)
    : lessonStartForIndex(
        cardIndex,
        lessonDeckCards.length,
        isOlderReaderWords ? OLDER_READER_WORD_LESSON_SIZE : LESSON_SIZE,
      )
  const lessonLength = isSarahLetters
    ? sarahLetterLessonSizeForStart(lessonStart, lessonDeckCards.length)
    : isOlderReaderPhonemes
    ? Math.min(LESSON_SIZE, lessonDeckCards.length - lessonStart)
    : isOlderReaderWords
      ? Math.min(OLDER_READER_WORD_LESSON_SIZE, lessonDeckCards.length - lessonStart)
      : LESSON_SIZE
  const lessonCards = isOlderReaderWords
    ? selectedWordLessonCards
    : lessonDeckCards.slice(lessonStart, lessonStart + lessonLength)
  const lessonIndex = isOlderReaderWords ? 0 : cardIndex - lessonStart
  const sarahActivities = useMemo(
    () => (isSarahLetters ? buildSarahActivities(lessonCards) : []),
    [isSarahLetters, lessonCards],
  )
  const olderReaderActivities = useMemo(
    () => (isOlderReaderWords ? buildOlderReaderActivities(lessonCards) : []),
    [isOlderReaderWords, lessonCards],
  )
  const phonemeActivities = useMemo(
    () => (isOlderReaderPhonemes ? buildOlderReaderPhonemeActivities(lessonCards) : []),
    [isOlderReaderPhonemes, lessonCards],
  )
  const progress = isSarahLetters || isOlderReaderWords || isOlderReaderPhonemes
    ? Math.min(
        sarahActivityIndex + 1,
        isSarahLetters
          ? sarahActivities.length
          : isOlderReaderWords
          ? olderReaderActivities.length
          : phonemeActivities.length,
      )
    : lessonIndex + 1
  const progressTotal = isSarahLetters ? sarahActivities.length : isOlderReaderWords ? olderReaderActivities.length : isOlderReaderPhonemes ? phonemeActivities.length : lessonCards.length
  const lessonNumber = isSarahLetters
    ? sarahLetterLessonNumberForIndex(cardIndex, lessonDeckCards.length)
    : isOlderReaderPhonemes
    ? fixedLessonNumberForIndex(cardIndex, lessonDeckCards.length)
    : isOlderReaderWords
    ? Math.floor(cardIndex / OLDER_READER_WORD_LESSON_SIZE) + 1
    : lessonNumberForIndex(
        cardIndex,
        lessonDeckCards.length,
        isOlderReaderWords ? OLDER_READER_WORD_LESSON_SIZE : LESSON_SIZE,
      )
  const completePhonemeAndDone = () => {
    if (isOlderReaderPhonemes) completeOlderReaderPhonemeLesson(activeDeck, lessonCards)
    onDone()
  }

  return (
    <section className="learning-screen lesson-focus">
      <LessonMenu
        isOpen={menuOpen}
        onToggle={onMenuToggle}
        decks={decks}
        activeDeck={activeDeck}
        activeDeckId={activeDeckId}
        onDeckChange={onDeckChange}
        onRestartLesson={onRestartLesson}
        onGoHome={onGoHome}
        onBackToPath={onBackToPath}
        mode={mode}
        onModeChange={onModeChange}
        showAdultDetails={showAdultDetails}
        onToggleAdultDetails={onToggleAdultDetails}
      />

      <FocusLessonTopBar
        lessonNumber={lessonNumber}
        progress={progress}
        total={progressTotal}
        onMenuToggle={onMenuToggle}
        onHome={isOlderReaderWords && onGoHome ? onGoHome : undefined}
      />

      {isSarahLetters ? (
        <SarahLetterLesson
          key={`${activeDeck.id}:${lessonNumber}:${sarahActivityIndex}`}
          deck={activeDeck}
          lessonCards={lessonCards}
          lessonNumber={lessonNumber}
          activityIndex={sarahActivityIndex}
          onActivityChange={onSarahActivityChange}
          onLessonChange={onSarahLessonChange}
          onLessonComplete={onLessonComplete}
          showAdultDetails={showAdultDetails}
        />
      ) : mode === 'flashcardMode' ? (
        <FsrsFlashcardMode
          deck={activeDeck}
          onComplete={onDone}
          onSessionStateChange={setFsrsActive}
        />
      ) : isOlderReaderWords ? (
        <OlderReaderLesson
          key={`${activeDeck.id}:${lessonNumber}:${sarahActivityIndex}`}
          deck={activeDeck}
          lessonCards={lessonCards}
          activities={olderReaderActivities}
          lessonNumber={lessonNumber}
          activityIndex={sarahActivityIndex}
          onActivityChange={onSarahActivityChange}
          onNextLesson={onAdvanceLesson}
          onLessonComplete={onLessonComplete}
          onDone={completePhonemeAndDone}
        />
      ) : isOlderReaderPhonemes ? (
        <OlderReaderPhonemeLesson
          key={`${activeDeck.id}:${lessonNumber}:${sarahActivityIndex}`}
          deck={activeDeck}
          lessonCards={lessonCards}
          activities={phonemeActivities}
          lessonNumber={lessonNumber}
          activityIndex={sarahActivityIndex}
          onActivityChange={onSarahActivityChange}
          onNextLesson={onAdvanceLesson}
          onLessonComplete={onLessonComplete}
          onDone={onDone}
        />
      ) : activeDeck.type === 'math' ? (
        <MathLesson
          key={`${activeDeck.id}:${lessonNumber}:${activeCard.id}`}
          deck={activeDeck}
          card={activeCard}
          lessonNumber={lessonNumber}
          questionNumber={lessonIndex + 1}
          totalQuestions={lessonCards.length}
          difficulty={mathDifficulty}
          onNext={onNext}
          onLessonComplete={onLessonComplete}
          onDone={onDone}
          onChangeDifficulty={onChangeMathDifficulty}
        />
      ) : mode === 'listeningMode' ? (
        <ExploreMode
          deck={activeDeck}
          card={activeCard}
          isLessonEnd={lessonIndex + 1 >= lessonCards.length}
          onNext={onNext}
          onNextLesson={onNextLesson}
          onDone={onDone}
        />
      ) : mode === 'readerMode' ? (
        <FlashcardMode
          key={`${activeDeck.id}:${mode}:${activeCard.id}`}
          deck={activeDeck}
          card={activeCard}
          onNext={onNext}
        />
      ) : (
        <ChoiceMode
          key={`${activeDeck.id}:${mode}:${phase}:${activeCard.id}`}
          deck={activeDeck}
          lessonCards={lessonCards}
          card={activeCard}
          cardIndex={lessonIndex}
          mode={mode}
          onNext={onNext}
        />
      )}
      {isOlderReaderWords && (mode !== 'flashcardMode' || fsrsActive) && (
        <div className="mode-toggle-bar">
          <button
            type="button"
            className={mode === 'flashcardMode' ? 'active' : ''}
            onClick={() => onModeToggle('flashcardMode')}
          >
            Flashcards
          </button>
          <button
            type="button"
            className={mode === 'activeRecall' ? 'active' : ''}
            onClick={() => onModeToggle('activeRecall')}
          >
            Active Recall
          </button>
        </div>
      )}
    </section>
  )
}

function LessonMenu({
  isOpen,
  onToggle,
  decks,
  activeDeck,
  activeDeckId,
  onDeckChange,
  onRestartLesson,
  onGoHome,
  onBackToPath,
  mode,
  onModeChange,
  showAdultDetails,
  onToggleAdultDetails,
}: {
  isOpen: boolean
  onToggle: () => void
  decks: LearningDeck[]
  activeDeck: LearningDeck
  activeDeckId: string
  onDeckChange: (deckId: string) => void
  onRestartLesson: () => void
  onGoHome?: () => void
  onBackToPath?: () => void
  mode: LearningMode
  onModeChange: (mode: LearningMode) => void
  showAdultDetails: boolean
  onToggleAdultDetails: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onToggle()
      }
    }
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && isOpen) {
        onToggle()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onToggle])

  return (
    <>
      <button
        type="button"
        className="menu-button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="lesson-menu"
        aria-label="Open menu"
      >
        Menu
      </button>
      {isOpen && (
        <div
          id="lesson-menu"
          ref={menuRef}
          className="lesson-menu"
          role="dialog"
          aria-label="Lesson menu"
        >
          <div className="lesson-menu-header">
            <strong>Menu</strong>
            <button type="button" className="menu-close" onClick={onToggle} aria-label="Close menu">
              Close
            </button>
          </div>
          <div className="lesson-menu-content">
            {onBackToPath && (
              <button type="button" className="menu-item" onClick={onBackToPath}>
                Back to Sections
              </button>
            )}
            <button type="button" className="menu-item" onClick={onRestartLesson}>
              Restart Lesson
            </button>
            {decks.length > 1 && (
              <div className="menu-section">
                <strong>Choose Deck</strong>
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    type="button"
                    className={`menu-item ${deck.id === activeDeckId ? 'active' : ''}`}
                    onClick={() => onDeckChange(deck.id)}
                  >
                    {deck.level ? `Level ${deck.level}` : deck.title}
                    {deck.id === activeDeckId && ' selected'}
                  </button>
                ))}
              </div>
            )}
            {decks.some((deck) => deck.profile !== 'anna') ? (
              <div className="menu-section">
                <strong>Study Mode</strong>
                <button
                  type="button"
                  className={`menu-item ${mode === 'listeningMode' ? 'active' : ''}`}
                  onClick={() => onModeChange('listeningMode')}
                >
                  Listen
                </button>
                <button
                  type="button"
                  className={`menu-item ${mode === 'activeRecall' ? 'active' : ''}`}
                  onClick={() => onModeChange('activeRecall')}
                >
                  Active Recall
                </button>
                {(activeDeck.type === 'reading-words' || activeDeck.type === 'chinese-vocab') && (
                  <button
                    type="button"
                    className={`menu-item ${mode === 'flashcardMode' ? 'active' : ''}`}
                    onClick={() => onModeChange('flashcardMode')}
                  >
                    Flashcards (FSRS)
                  </button>
                )}
                <button
                  type="button"
                  className={`menu-item ${mode === 'readerMode' ? 'active' : ''}`}
                  onClick={() => onModeChange('readerMode')}
                >
                  Flash Cards
                </button>
              </div>
            ) : (
              <div className="menu-section">
                <strong>Study Mode</strong>
                <div className="menu-note">Active Recall only</div>
              </div>
            )}
            <div className="menu-section">
              <strong>Options</strong>
              <AudioPackButton compact />
              <button type="button" className="menu-item" onClick={onToggleAdultDetails}>
                {showAdultDetails ? 'Showing ' : ''}Adult Details
              </button>
            </div>
              {activeDeck.type === 'letters' && (
                <div className="menu-note parent-note">
                  This section teaches letter sounds before letter names. The goal is hearing, saying, and matching sounds.
                </div>
              )}
            {onGoHome && (
              <button type="button" className="menu-item menu-home" onClick={onGoHome}>
                Home
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function FocusLessonTopBar({
  lessonNumber,
  progress,
  total,
  onMenuToggle,
  onHome,
}: {
  lessonNumber: number
  progress: number
  total: number
  onMenuToggle: () => void
  onHome?: () => void
}) {
  const dots = Math.min(5, total)
  const filledDots = Math.ceil((progress / total) * dots)

  return (
    <div className="focus-topbar">
      <button
        type="button"
        className="menu-button-compact"
        onClick={onMenuToggle}
        aria-label="Menu"
      >
        Menu
      </button>
      {onHome && (
        <button
          type="button"
          className="home-button-compact"
          onClick={onHome}
          aria-label="Home"
        >
          <HomeIcon />
          <span>Home</span>
        </button>
      )}
      <div className="focus-progress">
        <span className="lesson-label">Lesson {lessonNumber}</span>
        <div className="progress-dots" aria-label={`Progress ${progress} of ${total}`}>
          {Array.from({ length: dots }).map((_, i) => (
            <span key={i} className={i < filledDots ? 'filled' : ''} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AudioPromptButton({
  onClick,
  label = 'Listen',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button type="button" className="audio-prompt-button" onClick={onClick}>
      <span className="audio-icon" aria-hidden="true">
        <span className="audio-wave" />
        <span className="audio-wave" />
        <span className="audio-wave" />
      </span>
      <span className="audio-label">{label}</span>
    </button>
  )
}

function SarahLetterLesson({
  deck,
  lessonCards,
  lessonNumber,
  activityIndex,
  onActivityChange,
  onLessonChange,
  onLessonComplete,
  showAdultDetails,
}: {
  deck: LearningDeck
  lessonCards: LearningCard[]
  lessonNumber: number
  activityIndex: number
  onActivityChange: (index: number) => void
  onLessonChange: (deltaLessons: number) => void
  onLessonComplete: () => void
  showAdultDetails: boolean
}) {
  const activities = useMemo(() => buildSarahActivities(lessonCards), [lessonCards])
  const activity = activities[Math.min(activityIndex, Math.max(0, activities.length - 1))]
  const completed = activityIndex >= activities.length
  const [status, setStatus] = useState<SarahActivityStatus>('idle')
  const [wrongChoice, setWrongChoice] = useState('')
  const [tries, setTries] = useState(0)
  const completionRecordedRef = useRef(false)

  useAutoplaySarahActivity(deck, completed ? undefined : activity, `${deck.id}:${lessonNumber}:${activityIndex}`)

  useEffect(() => {
    if (!activity || completed) return
    if (activity.kind !== 'intro') return
    const timer = window.setTimeout(() => nextActivity(), 3000)
    return () => window.clearTimeout(timer)
  }, [activity, completed, activityIndex])

  function nextActivity() {
    onActivityChange(activityIndex + 1)
  }

  function restartLesson() {
    onActivityChange(0)
  }

  function choose(answer: string, option?: LearningCard) {
    if (!activity || status === 'correct' || status === 'revealed') return
    if (option && getSarahQuestionKind(activity) === 'letterToSound') void playCardAudio(deck, option)
    const correctAnswer = getSarahCorrectAnswer(activity)
    if (answer === correctAnswer) {
      setStatus('correct')
      playSfx('correct')
      void playNarrationClip('feedback:great')
      void playSarahActivityAudio(deck, activity)
      window.setTimeout(nextActivity, 850)
      return
    }
    setWrongChoice(answer)
    if (tries === 0) {
      setTries(1)
      setStatus('try-again')
      void playNarrationClip('feedback:try-again')
      void playSarahActivityAudio(deck, activity)
      return
    }
    setStatus('revealed')
    void playSarahActivityAudio(deck, activity)
    window.setTimeout(nextActivity, 1450)
  }

  useEffect(() => {
    if (completed && !completionRecordedRef.current) {
      completionRecordedRef.current = true
      playSfx('fireworks')
      fireworksCelebration()
      const currentProgress = parseInt(localStorage.getItem('completed-lessons-sarah') || '0', 10)
      localStorage.setItem('completed-lessons-sarah', (currentProgress + 1).toString())
      recordLocalProgressChange()
      onLessonComplete()
    }
  }, [completed, onLessonComplete])

  if (!activity || completed) {
    return (
      <section className="sarah-complete focus-complete">
        <div className="celebration-burst" aria-hidden="true" />
        <Mascot mood="happy" />
        <div>
          <span className="prompt-topline">Lesson {lessonNumber} complete</span>
          <h2>You practiced {lessonCards.length} sounds!</h2>
          <div className="letter-review-row" aria-label="Letters practiced">
            {lessonCards.map((card) => <strong key={card.id}>{card.displayText}</strong>)}
          </div>
        </div>
        <div className="completion-actions">
          <button type="button" onClick={restartLesson}>Again</button>
          <button type="button" className="primary" onClick={() => onLessonChange(1)}>Next lesson</button>
        </div>
      </section>
    )
  }

  const isIntro = activity.kind === 'intro'
  const mood: MascotMood =
    status === 'correct' ? 'happy' : status === 'try-again' || status === 'revealed' ? 'curious' : isIntro ? 'reading' : 'curious'
  const feedback = getSarahFeedback(status, activity)

  return (
    <section className={`focus-lesson ${isIntro ? 'intro' : 'question'} ${status}`}>
      <div className="focus-main">
        {isIntro ? (
          <SarahIntroView
            deck={deck}
            activity={activity}
            activityIndex={activityIndex}
            onNext={nextActivity}
            showAdultDetails={showAdultDetails}
          />
        ) : (
          <SarahQuestionView
            deck={deck}
            activity={activity}
            status={status}
            wrongChoice={wrongChoice}
            onChoose={choose}
            showAdultDetails={showAdultDetails}
          />
        )}
      </div>

      <div className={`focus-feedback ${status ? (status === 'correct' ? 'happy' : 'try') : ''}`}>
        <Mascot mood={mood} size="small" />
        <div className="feedback-text">
          <strong>{feedback.title}</strong>
          <span>{feedback.detail}</span>
        </div>
      </div>
    </section>
  )
}

function SarahIntroView({
  deck,
  activity,
  activityIndex,
  onNext,
  showAdultDetails,
}: {
  deck: LearningDeck
  activity: SarahActivity
  activityIndex: number
  onNext: () => void
  showAdultDetails: boolean
}) {
  return (
    <div className="focus-intro">
      <div className="focus-prompt">
        <span className="stage-label">Sound {Math.min(activityIndex + 1, 5)} of 5</span>
        <h2>{activity.card.sound} like {activity.card.exampleWord}</h2>
      </div>
      <div className="focus-visual">
        <div className="letter-display">
          <strong>{activity.card.displayText}</strong>
          {showAdultDetails && <span className="phonetic-detail">{activity.card.sound}</span>}
        </div>
        <Picture deck={deck} card={activity.card} />
        <span className="example-word">{activity.card.exampleWord}</span>
        {activity.card.mouthCue && <span className="mouth-cue">{activity.card.mouthCue}</span>}
      </div>
      <div className="focus-actions">
        <AudioPromptButton
          onClick={() => playSarahActivityAudio(deck, activity)}
          label="Listen"
        />
        <button type="button" className="primary" onClick={onNext}>Next</button>
      </div>
    </div>
  )
}

function SarahQuestionView({
  deck,
  activity,
  status,
  wrongChoice,
  onChoose,
  showAdultDetails,
}: {
  deck: LearningDeck
  activity: SarahActivity
  status: SarahActivityStatus
  wrongChoice: string
  onChoose: (answer: string, option?: LearningCard) => void
  showAdultDetails: boolean
}) {
  const questionKind = getSarahQuestionKind(activity)
  const correctAnswer = getSarahCorrectAnswer(activity)
  const disabled = status === 'correct' || status === 'revealed'

  function handleAudioClick() {
    if (questionKind === 'upperLowerMatch') {
      void playCardAudio(deck, activity.card)
    } else {
      void playCardAudio(deck, activity.card)
    }
  }

  const chooseByIndex = useCallback((index: number) => {
    if (disabled) return
    if (activity.textOptions) {
      const answer = activity.textOptions[index]
      if (answer) onChoose(answer)
      return
    }
    const option = activity.options?.[index]
    if (option) onChoose(option.id, option)
  }, [activity.options, activity.textOptions, disabled, onChoose])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreControllerKey(event) || disabled) return
      if (isChoiceKey(event, 'A')) {
        event.preventDefault()
        chooseByIndex(0)
      }
      if (isChoiceKey(event, 'B')) {
        event.preventDefault()
        chooseByIndex(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chooseByIndex, disabled])

  return (
    <div className="focus-question">
      <div className="focus-prompt">
        {questionKind === 'soundToLetter' && (
          <>
            <span className="stage-label">Hear the sound</span>
            <h2>Find {activity.card.sound}.</h2>
            <AudioPromptButton onClick={handleAudioClick} label="Tap to hear" />
            {showAdultDetails && <span className="phonetic-detail">{activity.card.sound}</span>}
          </>
        )}
        {questionKind === 'letterToSound' && (
          <>
            <span className="stage-label">Say the sound</span>
            <h2>Which sound starts {activity.card.exampleWord}?</h2>
            <div className="prompt-letter">{activity.card.displayText}</div>
          </>
        )}
        {questionKind === 'upperLowerMatch' && (
          <>
            <span className="stage-label">Match big and little</span>
            <h2>
              {activity.promptCase === 'upper'
                ? `Find little ${activity.card.lowercase}.`
                : `Find big ${activity.card.uppercase}.`}
            </h2>
            <div className="prompt-letter case-prompt-display">
              {activity.promptCase === 'upper' ? activity.card.uppercase : activity.card.lowercase}
            </div>
          </>
        )}
        {questionKind === 'beginningSound' && (
          <>
            <span className="stage-label">Starting sound</span>
            <h2>{activity.card.exampleWord} starts with which sound?</h2>
            <div className="focus-visual compact">
              <Picture deck={deck} card={activity.card} />
              <span className="example-word">{activity.card.exampleWord}</span>
              <AudioPromptButton onClick={handleAudioClick} label="Hear the word" />
            </div>
          </>
        )}
        {questionKind === 'wordToBeginningSound' && (
          <>
            <span className="stage-label">Starting sound</span>
            <h2>{activity.card.exampleWord} starts with which sound?</h2>
            <div className="focus-visual compact">
              <Picture deck={deck} card={activity.card} />
              <span className="example-word">{activity.card.exampleWord}</span>
            </div>
          </>
        )}
        {questionKind === 'soundToWord' && (
          <>
            <span className="stage-label">Find the word</span>
            <h2>Which word starts with {activity.card.sound}?</h2>
            <AudioPromptButton onClick={handleAudioClick} label="Hear the sound" />
            {showAdultDetails && <span className="phonetic-detail">{activity.card.sound}</span>}
          </>
        )}
      </div>

      <div className="focus-options" aria-label="Answer choices">
        {activity.textOptions ? (
          activity.textOptions.map((option, index) => (
            <button
              key={option}
              type="button"
              aria-label={`Choice ${choiceKeyLabel(index)}: ${option}`}
              className={`focus-option squish ${choiceState(option, correctAnswer, wrongChoice, status)}`}
              disabled={disabled}
              onClick={() => onChoose(option)}
            >
              <span className="choice-key" aria-hidden="true">{choiceKeyLabel(index)}</span>
              <strong>{option}</strong>
            </button>
          ))
        ) : (
          (activity.options ?? []).map((option, index) => {
            const answer = option.id
            const isSoundQuestion = questionKind === 'letterToSound'
            const showPictureOption = questionKind === 'soundToWord'
            const showSoundLabel =
              questionKind === 'letterToSound' ||
              questionKind === 'beginningSound' ||
              questionKind === 'wordToBeginningSound'
            return (
              <button
                key={option.id}
                type="button"
                aria-label={`Choice ${choiceKeyLabel(index)}: ${option.displayText}`}
                className={`focus-option squish ${showPictureOption ? 'picture-choice' : ''} ${choiceState(answer, correctAnswer, wrongChoice, status)}`}
                disabled={disabled}
                onClick={() => onChoose(answer, option)}
              >
                <span className="choice-key" aria-hidden="true">{choiceKeyLabel(index)}</span>
                {showPictureOption && <Picture deck={deck} card={option} />}
                <strong>{showSoundLabel ? option.displayText : option.displayText}</strong>
                {!isSoundQuestion && !showAdultDetails && option.exampleWord && !showPictureOption && (
                  <small className="friendly-hint">{option.exampleWord}</small>
                )}
                {showPictureOption && <small className="friendly-hint">{option.exampleWord}</small>}
                {showAdultDetails && (
                  <small className="phonetic-hint">{option.sound}</small>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function OlderReaderLesson({
  deck,
  lessonCards,
  activities,
  lessonNumber,
  activityIndex,
  onActivityChange,
  onNextLesson,
  onLessonComplete,
  onDone,
}: {
  deck: LearningDeck
  lessonCards: LearningCard[]
  activities: OlderReaderActivity[]
  lessonNumber: number
  activityIndex: number
  onActivityChange: (index: number) => void
  onNextLesson: () => void
  onLessonComplete: () => void
  onDone: () => void
}) {
  const activity = activities[Math.min(activityIndex, activities.length - 1)]
  const [selected, setSelected] = useState('')
  const [gentleReveal, setGentleReveal] = useState(false)
  const [complete, setComplete] = useState(false)
  const [firstTryStreak, setFirstTryStreak] = useState(0)
  const completionRecordedRef = useRef(false)
  const firstTryCorrectCountsRef = useRef<Record<string, number>>({})
  const lessonId = `${deck.id}:lesson:${lessonNumber}`
  const correct = selected === activity?.card.id
  const isPeek = activity?.kind === 'peek'
  const isReadTogether = activity?.kind === 'readTogether'
  const isSentenceBridge = activity?.kind === 'sentenceBridge'
  const showCompletion = complete || activityIndex >= activities.length
  const challengeActive = Boolean(activity?.challenge && firstTryStreak >= 2 && !selected && !gentleReveal)
  const prompt = activity ? getOlderReaderPrompt(activity) : ''
  const promptNarration = useNarration(
    showCompletion
      ? 'older-reader:growing'
      : isPeek
        ? undefined
        : activity?.kind === 'audioToWord'
          ? undefined
          : activity
            ? `older-reader:prompt:${activity.kind}`
            : undefined,
    showCompletion ? 'These words are growing!' : prompt,
    `${deck.id}:${lessonNumber}:${showCompletion ? 'complete' : activityIndex}`,
  )

  useEffect(() => {
    markWordLessonIntroduced(deck.id, lessonCards, lessonId)
  }, [deck.id, lessonCards, lessonId])

  const finishActivity = useCallback(() => {
    if (activityIndex >= activities.length - 1) {
      markCardsRecalled(deck.id, lessonCards)
      setComplete(true)
      return
    }
    onActivityChange(activityIndex + 1)
    setSelected('')
    setGentleReveal(false)
  }, [activities.length, activityIndex, deck.id, lessonCards, onActivityChange])

  const chooseByIndex = useCallback((index: number) => {
    if (!activity || selected || showCompletion || gentleReveal) return
    const option = activity.options[index]
    if (!option) return
    setSelected(option.id)
    if (option.id === activity.card.id) {
      playSfx('correct')
      void playNarrationClip('feedback:great')
      void playCardAudio(deck, activity.card)
      updateCardProgress(deck.id, activity.card.id, { recalledAt: Date.now(), firstTryRecalled: true })
      firstTryCorrectCountsRef.current[activity.card.id] = (firstTryCorrectCountsRef.current[activity.card.id] ?? 0) + 1
      setFirstTryStreak((value) => value + 1)
      window.setTimeout(finishActivity, 650)
      return
    }
    setGentleReveal(true)
    setFirstTryStreak(0)
    void playNarrationClip('feedback:let-me-help')
    void playCardAudio(deck, activity.card)
    updateCardProgress(deck.id, activity.card.id, { recalledAt: Date.now(), firstTryRecalled: false })
    window.setTimeout(finishActivity, 1800)
  }, [activity, deck, finishActivity, gentleReveal, selected, showCompletion])

  useEffect(() => {
    if (!activity || showCompletion || isPeek || isReadTogether) return
    if (activity.kind !== 'audioToWord') return
    const timer = window.setTimeout(() => {
      void playCardAudio(deck, activity.card)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [activity, deck, showCompletion, isPeek, isReadTogether])

  useEffect(() => {
    if (!activity || showCompletion || !isPeek) return
    const timer = window.setTimeout(() => {
      void playNarrationClip(
        activityIndex === 0 ? 'older-reader:intro:today-words' : 'feedback:this-word-is',
        activityIndex === 0 ? 'Today we are going to learn.' : 'This word is.',
        activityIndex === 0
          ? deckAudioPackPath(deck, 'audio/narration/anne-soft-female-v2/today-we-are-going-to-learn.mp3')
          : undefined,
      )
    }, 180)
    const audioTimer = window.setTimeout(() => {
      void playCardAudio(deck, activity.card)
    }, activityIndex === 0 ? 1250 : 800)
    const advanceTimer = window.setTimeout(() => {
      finishActivity()
    }, activityIndex === 0 ? 3100 : 2500)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(audioTimer)
      window.clearTimeout(advanceTimer)
    }
  }, [activity, deck, finishActivity, showCompletion, isPeek])

  useEffect(() => {
    if (!activity || showCompletion || !isReadTogether) return
    const sentence = activity.card.exampleSentence || `I can read ${optionLabel(activity.card)}.`
    const timer = window.setTimeout(() => {
      void playNarrationClip(
        `word-sentence:${activity.card.id}`,
        sentence,
        deckAudioPackPath(deck, activity.card.exampleAudio),
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [activity, deck, isReadTogether, showCompletion])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreControllerKey(event)) return
      if (isChoiceKey(event, 'A')) {
        event.preventDefault()
        if (showCompletion) onNextLesson()
        else if (isReadTogether) finishActivity()
        else if (!isPeek) chooseByIndex(0)
      }
      if (isChoiceKey(event, 'B')) {
        event.preventDefault()
        if (showCompletion) onDone()
        else if (!isPeek && !isReadTogether) chooseByIndex(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chooseByIndex, finishActivity, isPeek, isReadTogether, onDone, onNextLesson, showCompletion])

  useEffect(() => {
    if (showCompletion && !completionRecordedRef.current) {
      completionRecordedRef.current = true
      playSfx('fireworks')
      fireworksCelebration()
      const currentProgress = parseInt(localStorage.getItem('completed-lessons-anna') || '0', 10)
      localStorage.setItem('completed-lessons-anna', (currentProgress + 1).toString())
      recordLocalProgressChange()
      recordWordLessonResults(deck.id, lessonId, lessonCards, firstTryCorrectCountsRef.current)
      onLessonComplete()
    }
  }, [deck.id, lessonCards, lessonId, onLessonComplete, showCompletion])

  if (isPeek && activity && !showCompletion) {
    return (
      <section className="focus-lesson older-reader-lesson">
        <div className="focus-main">
          <div className="peek-phase">
            <span className="stage-label">Lesson {lessonNumber} - Word {activityIndex + 1} of {lessonCards.length}</span>
            <div className="peek-card">
              <div className="peek-word">{optionLabel(activity.card)}</div>
            </div>
            <div className="peek-hint">Listen and look</div>
          </div>
        </div>
        <div className="focus-feedback">
          <Mascot mood="reading" size="small" />
          <div className="feedback-text">
            <strong>This word is</strong>
            <span>{optionLabel(activity.card)}</span>
          </div>
        </div>
      </section>
    )
  }

  if ((isReadTogether || isSentenceBridge) && activity && !showCompletion) {
    const sentence = activity.card.exampleSentence || `I can read ${optionLabel(activity.card)}.`
    const targetWord = optionLabel(activity.card)
    const sentenceParts = sentence.split(new RegExp(`(${escapeRegExp(targetWord)})`, 'iu'))
    if (isSentenceBridge) {
      return (
        <section className="focus-lesson older-reader-lesson">
          <div className="focus-main">
            <div className="focus-question older-reader-question">
              <div className="focus-prompt sentence-bridge-card">
                <span className="stage-label">Tiny sentence</span>
                <h2>
                  {sentenceParts.map((part, index) => (
                    part.toLowerCase() === targetWord.toLowerCase()
                      ? selected
                        ? <mark key={`${part}:${index}`}>{part}</mark>
                        : <span key={`${part}:${index}`} className="sentence-blank">_____</span>
                      : <span key={`${part}:${index}`}>{part}</span>
                  ))}
                </h2>
                <AudioPromptButton
                  onClick={() => playNarrationClip(
                    `word-sentence:${activity.card.id}`,
                    sentence,
                    deckAudioPackPath(deck, activity.card.exampleAudio),
                  )}
                  label="Hear sentence"
                />
              </div>
              <div className="focus-options" aria-label="Answer choices">
                {activity.options.map((option, index) => {
                  const isCorrectOption = gentleReveal && option.id === activity.card.id
                  const isWrongSelection = gentleReveal && selected === option.id && option.id !== activity.card.id
                  const isSelectedCorrect = !gentleReveal && selected && option.id === activity.card.id
                  const isSelectedWrong = !gentleReveal && selected === option.id && option.id !== activity.card.id
                  const stateClass = isCorrectOption
                    ? 'correct pulse'
                    : isWrongSelection
                      ? 'selected-soft'
                      : isSelectedCorrect
                        ? 'correct pulse'
                        : isSelectedWrong
                          ? 'wrong shake'
                          : ''
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-label={`Choice ${choiceKeyLabel(index)}: ${optionLabel(option)}`}
                      className={`focus-option squish ${stateClass}`}
                      disabled={Boolean(selected)}
                      onClick={() => chooseByIndex(index)}
                    >
                      <span className="choice-key" aria-hidden="true">{choiceKeyLabel(index)}</span>
                      <strong>{optionLabel(option)}</strong>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className={`focus-feedback ${gentleReveal ? 'happy' : selected ? (correct ? 'happy' : 'try') : ''}`}>
            <Mascot mood={gentleReveal ? 'curious' : selected ? (correct ? 'happy' : 'curious') : 'reading'} size="small" />
            <div className="feedback-text">
              {gentleReveal ? (
                <>
                  <strong>Let's read it</strong>
                  <span>It was {targetWord}.</span>
                </>
              ) : selected ? (
                correct ? (
                  <>
                    <strong>Nice reading!</strong>
                    <span>{targetWord} fits.</span>
                  </>
                ) : (
                  <>
                    <strong>Try again</strong>
                    <span>Pick the other one.</span>
                  </>
                )
              ) : (
                <>
                  <strong>Choose one</strong>
                  <span>A or B</span>
                </>
              )}
            </div>
          </div>
        </section>
      )
    }
    return (
      <section className="focus-lesson older-reader-lesson">
        <div className="focus-main">
          <div className="read-together-card">
            <span className="stage-label">Read together</span>
            <h2>
              {sentenceParts.map((part, index) => (
                part.toLowerCase() === targetWord.toLowerCase()
                  ? <mark key={`${part}:${index}`}>{part}</mark>
                  : <span key={`${part}:${index}`}>{part}</span>
              ))}
            </h2>
            <div className="focus-actions">
              <button
                type="button"
                className="choice-action"
                onClick={() => void playNarrationClip(
                  `word-sentence:${activity.card.id}`,
                  sentence,
                  deckAudioPackPath(deck, activity.card.exampleAudio),
                )}
              >
                <PlayIcon />
                Hear it
              </button>
              <button type="button" className="primary choice-action" onClick={finishActivity}>
                <span>A</span>
                Finish
              </button>
            </div>
          </div>
        </div>
        <div className="focus-feedback">
          <Mascot mood="reading" size="small" />
          <div className="feedback-text">
            <strong>You can read it!</strong>
            <span>Listen and read along.</span>
          </div>
        </div>
      </section>
    )
  }

  if (!activity || showCompletion) {
    return (
      <section className="focus-lesson older-reader-lesson">
        <div className="focus-main">
          <div className="focus-intro completion-card">
            <div className="focus-prompt">
              <span className="stage-label">Lesson {lessonNumber}</span>
              <h2>Great work with these words!</h2>
            </div>
            <div className="word-growth-strip">
              {lessonCards.map((card) => (
                <div key={card.id} className="word-growth-card blooming">
                  <span className="growth-icon" aria-hidden="true">⭐</span>
                  <span className="growth-word">{card.word || card.displayText}</span>
                </div>
              ))}
            </div>
            <div className="focus-actions">
              <button type="button" className="choice-action" onClick={promptNarration.replay}>
                <PlayIcon />
                Play
              </button>
              <button type="button" className="primary choice-action" onClick={onNextLesson}>
                <span>A</span>
                Next Lesson
              </button>
              <button type="button" className="choice-action" onClick={onDone}>
                <span>B</span>
                Done
              </button>
            </div>
          </div>
        </div>
        <div className="focus-feedback happy">
          <Mascot mood="happy" size="small" />
          <div className="feedback-text">
            <strong>Great job!</strong>
            <span>These words are growing!</span>
          </div>
        </div>
      </section>
    )
  }

  const showPromptPicture = ['pictureToWord', 'startsWithSound', 'review'].includes(activity.kind)
  const showOptionPictures = activity.kind === 'wordToPicture'
  const showWordQuestionPictures = false
  const mood: MascotMood = gentleReveal ? 'curious' : selected ? (correct ? 'happy' : 'curious') : activity.kind === 'audioToWord' ? 'reading' : 'curious'

  return (
    <section className="focus-lesson older-reader-lesson">
      <div className="focus-main">
        <div className="focus-question older-reader-question">
          <div className="focus-prompt">
            <span className="stage-label">Lesson {lessonNumber} - Practice {activityIndex - OLDER_READER_PEEK_COUNT + 1} of {OLDER_READER_RECOGNITION_COUNT}</span>
            {challengeActive && <span className="challenge-badge">Sparkle challenge</span>}
            <h2>{prompt}</h2>
            {promptNarration.shouldShowPlayButton && (
              <AudioPromptButton onClick={promptNarration.replay} label="Hear question" />
            )}
            {activity.kind === 'audioToWord' && <AudioPromptButton onClick={() => playCardAudio(deck, activity.card)} label="Hear it" />}
            {activity.kind === 'audioToWord' && selected && (
              <div className="word-answer-reveal">
                <strong>{optionLabel(activity.card)}</strong>
              </div>
            )}
            {activity.kind === 'wordToPicture' && <div className="word-display prompt-word">{optionLabel(activity.card)}</div>}
            {activity.kind === 'wordFamily' && <div className="word-chunk">{wordChunk(activity.card)}</div>}
            {showPromptPicture && showWordQuestionPictures && (
              <div className="focus-visual compact">
                <Picture deck={deck} card={activity.card} />
              </div>
            )}
          </div>
          <div className="focus-options" aria-label="Answer choices">
            {activity.options.map((option, index) => {
              const isCorrectOption = gentleReveal && option.id === activity.card.id
              const isWrongSelection = gentleReveal && selected === option.id && option.id !== activity.card.id
              const isSelectedCorrect = !gentleReveal && selected && option.id === activity.card.id
              const isSelectedWrong = !gentleReveal && selected === option.id && option.id !== activity.card.id
              const stateClass = isCorrectOption
                ? 'correct pulse'
                : isWrongSelection
                  ? 'selected-soft'
                  : isSelectedCorrect
                    ? 'correct pulse'
                    : isSelectedWrong
                      ? 'wrong shake'
                      : ''
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={`Choice ${choiceKeyLabel(index)}: ${optionLabel(option)}`}
                  className={`focus-option squish ${showOptionPictures ? 'picture-choice' : ''} ${stateClass}`}
                  disabled={Boolean(selected)}
                  onClick={() => chooseByIndex(index)}
                >
                  <span className="choice-key" aria-hidden="true">{choiceKeyLabel(index)}</span>
                  {showOptionPictures && <Picture deck={deck} card={option} />}
                  <strong>{optionLabel(option)}</strong>
                  {!showOptionPictures && option.category && <small>{option.category}</small>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className={`focus-feedback ${gentleReveal ? 'happy' : selected ? (correct ? 'happy' : 'try') : ''}`}>
        <Mascot mood={mood} size="small" />
        <div className="feedback-text">
          {gentleReveal ? (
            <>
              <strong>Let's hear it!</strong>
              <span>It was {optionLabel(activity.card)}.</span>
            </>
          ) : selected ? (
            correct ? (
              <>
                <strong>Great!</strong>
                <span>{encouragement[(activityIndex + activity.card.id.length) % encouragement.length]}</span>
              </>
            ) : (
              <>
                <strong>Try again</strong>
                <span>Pick the other one.</span>
              </>
            )
          ) : (
            <>
              <strong>Choose one</strong>
              <span>3 for A, 4 for B</span>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function ExploreMode({
  deck,
  card,
  isLessonEnd,
  onNext,
  onNextLesson,
  onDone,
}: {
  deck: LearningDeck
  card: LearningCard
  isLessonEnd: boolean
  onNext: () => void
  onNextLesson: () => void
  onDone: () => void
}) {
  useAutoplayCard(deck, card, `learn:${deck.id}:${card.id}`)
  const mood: MascotMood = card.type === 'word' ? 'curious' : 'reading'
  const [showSentenceMeaning, setShowSentenceMeaning] = useState(false)

  if (card.type === 'sentence') {
    return (
      <SentenceExploreMode
        deck={deck}
        card={card}
        showMeaning={showSentenceMeaning}
        isLessonEnd={isLessonEnd}
        onToggleMeaning={() => setShowSentenceMeaning((value) => !value)}
        onNext={onNext}
        onNextLesson={onNextLesson}
        onDone={onDone}
      />
    )
  }

  return (
    <section className="focus-lesson">
      <div className="focus-main">
        <div className="focus-intro">
          <button
            type="button"
            className="focus-visual focus-visual-tap"
            onClick={() => void playCardAudio(deck, card)}
            aria-label={`Hear ${card.word ?? card.displayText}`}
          >
            {card.type === 'word' ? (
              <>
                <Picture deck={deck} card={card} />
                <div className="word-display">{card.word}</div>
              </>
            ) : (
              <>
                <div className="letter-display">
                  <strong>{card.displayText}</strong>
                </div>
                <Picture deck={deck} card={card} />
                <span className="example-word">{card.exampleWord}</span>
              </>
            )}
          </button>
          <div className="focus-actions">
            <button type="button" className="primary" onClick={onNext}>Next</button>
            <button type="button" className="secondary-action full-row" onClick={onNextLesson}>Next Lesson</button>
          </div>
        </div>
      </div>
      <div className="focus-feedback">
        <Mascot mood={mood} size="small" />
        <div className="feedback-text">
          <strong>{card.type === 'word' ? 'Read it!' : 'Say it!'}</strong>
          <span>Tap the card to hear</span>
        </div>
      </div>
    </section>
  )
}

function SentenceExploreMode({
  deck,
  card,
  showMeaning,
  isLessonEnd,
  onToggleMeaning,
  onNext,
  onNextLesson,
  onDone,
}: {
  deck: LearningDeck
  card: LearningCard
  showMeaning: boolean
  isLessonEnd: boolean
  onToggleMeaning: () => void
  onNext: () => void
  onNextLesson: () => void
  onDone: () => void
}) {
  return (
    <section className="focus-lesson">
      <div className="focus-main">
        <div className="focus-intro sentence-section">
          <div className="focus-prompt">
            <span className="stage-label">Sentence</span>
            <h2>Read the sentence.</h2>
          </div>
          <div className="sentence-card">
            <p>{card.sentence || card.displayText}</p>
            {showMeaning && card.meaning && <strong>{card.meaning}</strong>}
          </div>
          <div className="focus-actions">
            <button type="button" className="primary choice-action" onClick={isLessonEnd ? onNextLesson : onNext}>
              <span>A</span>
              {isLessonEnd ? 'Next Lesson' : 'Sentence Forward'}
            </button>
            <button type="button" className="choice-action" onClick={isLessonEnd ? onDone : onToggleMeaning}>
              <span>B</span>
              {isLessonEnd ? 'Done' : showMeaning ? 'Hide English' : 'Show English'}
            </button>
          </div>
        </div>
      </div>
      <div className="focus-feedback">
        <Mascot mood="reading" size="small" />
        <div className="feedback-text">
          <strong>Sentence time</strong>
          <span>Use A and B</span>
        </div>
        <AudioPromptButton onClick={() => playCardAudio(deck, card)} label="Listen" />
      </div>
    </section>
  )
}

function FlashcardMode({
  deck,
  card,
  onNext,
}: {
  deck: LearningDeck
  card: LearningCard
  onNext: () => void
}) {
  const [choice, setChoice] = useState<FlashcardChoice | ''>('')
  useAutoplayCard(deck, card, `flash:${deck.id}:${card.id}`)

  function choose(nextChoice: FlashcardChoice) {
    if (choice) return
    setChoice(nextChoice)
    saveFlashcardChoice(deck.id, card.id, nextChoice)
    window.setTimeout(onNext, 520)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreControllerKey(event) || choice) return
      if (isChoiceKey(event, 'A')) {
        event.preventDefault()
        choose('again')
      } else if (isChoiceKey(event, 'B')) {
        event.preventDefault()
        choose('good')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <section className="focus-lesson">
      <div className="focus-main">
        <div className="focus-intro flashcard-section">
          <div className="focus-prompt">
            <span className="stage-label">Flash Cards</span>
            <h2>How did it feel?</h2>
          </div>
          <div className="flashcard-card">
            {deck.type === 'reading-words' ? null : card.type === 'word' ? <Picture deck={deck} card={card} /> : <div className="sentence-card"><p>{card.displayText}</p></div>}
            <div className="word-display">{optionLabel(card)}</div>
            {card.meaning && card.meaning !== optionLabel(card) && <strong className="flashcard-meaning">{card.meaning}</strong>}
          </div>
          <div className="focus-actions">
            <button
              type="button"
              className={`choice-action ${choice === 'again' ? 'chosen-good' : ''}`}
              disabled={Boolean(choice)}
              onClick={() => choose('again')}
            >
              <span>A</span>
              Again
            </button>
            <button
              type="button"
              className={`choice-action ${choice === 'good' ? 'chosen-good' : ''}`}
              disabled={Boolean(choice)}
              onClick={() => choose('good')}
            >
              <span>B</span>
              Good
            </button>
          </div>
        </div>
      </div>
      <div className={`focus-feedback ${choice ? 'happy' : ''}`}>
        <Mascot mood={choice ? 'happy' : 'curious'} size="small" />
        <div className="feedback-text">
          <strong>{choice ? 'Got it!' : 'Pick one'}</strong>
          <span>{choice ? 'Nice flash card work.' : 'A again, B good'}</span>
        </div>
      </div>
    </section>
  )
}

const SWIPE_THRESHOLD = 40
const SWIPE_LABELS: Record<string, { text: string; color: string }> = {
  up: { text: 'Try More', color: '#7C4DFF' },
  left: { text: 'Almost', color: '#e65100' },
  right: { text: 'Good', color: '#2e7d32' },
  down: { text: 'Easy', color: '#1565c0' },
}

function stableHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function deckAudioPackPath(deck: LearningDeck, path?: string) {
  if (!path) return undefined
  if (/^(https?:|data:|blob:)/u.test(path)) return path
  return [deck.baseUrl || deck.assetBaseUrl, path.replace(/^\/+/u, '')].filter(Boolean).join('/')
}

type FrontMode = 'text' | 'audio' | 'picture'

function getFrontMode(deck: LearningDeck, card: LearningCard | undefined, index: number): FrontMode {
  if (!card || !card.image) return 'text'
  if (deck.type === 'reading-words') {
    return stableHash(`${card.id}:${index}`) % 3 === 0 ? 'audio' : 'text'
  }
  const bucket = stableHash(`${card.id}:${index}`) % 10
  if (bucket < 3) return 'audio'
  if (bucket < 5) return 'picture'
  return 'text'
}

function getQueueCounts(cards: LearningCard[], states: Map<string, FlashcardState>, now: number) {
  let newCount = 0
  let learningCount = 0
  let reviewCount = 0
  let doneCount = 0
  for (const card of cards) {
    const state = states.get(card.id)
    if (!state) { newCount++; continue }
    if (state.state === 'learning' || state.state === 'relearning') {
      learningCount++
    } else if (state.due <= now) {
      reviewCount++
    } else {
      doneCount++
    }
  }
  return { new: newCount, learning: learningCount, review: reviewCount, done: doneCount }
}

function WordReplayButton({
  audioUrl,
  onClick,
}: {
  audioUrl?: string
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void
}) {
  if (!audioUrl) return null
  return (
    <button type="button" className="fsrs-word-play-button" aria-label="Play word audio" onClick={onClick}>
      <PlayIcon />
    </button>
  )
}

function MathLesson({
  deck,
  card,
  lessonNumber,
  questionNumber,
  totalQuestions,
  difficulty,
  onNext,
  onLessonComplete,
  onDone,
  onChangeDifficulty,
}: {
  deck: LearningDeck
  card: LearningCard
  lessonNumber: number
  questionNumber: number
  totalQuestions: number
  difficulty: MathDifficulty
  onNext: () => void
  onLessonComplete: () => void
  onDone: () => void
  onChangeDifficulty: (d: MathDifficulty) => void
}) {
  const isEasy = difficulty === 'easy'
  const [selected, setSelected] = useState('')
  const [gentleReveal, setGentleReveal] = useState(false)
  const [complete, setComplete] = useState(false)
  const completionRecorded = useRef(false)
  const options = useMemo(() => buildOptions([card], card), [card])
  const correct = selected === card.id
  useAutoplayCard(deck, card, `math:${deck.id}:${card.id}`)

  const finishQuestion = useCallback(() => {
    if (questionNumber >= totalQuestions) {
      const operation = card.mathOperation === 'subtract' ? 'subtract' : 'add'
      const nextIndex = (deck.cards.findIndex((candidate) => candidate.id === card.id) + 1) % Math.max(1, deck.cards.length)
      saveMathIndex(operation, difficulty, nextIndex)
      setComplete(true)
      if (!completionRecorded.current) {
        completionRecorded.current = true
        onLessonComplete()
        playSfx('fireworks')
        fireworksCelebration()
      }
      return
    }
    onNext()
  }, [onLessonComplete, onNext, questionNumber, totalQuestions])

  const chooseByIndex = useCallback((index: number) => {
    if (selected || gentleReveal || complete) return
    const option = options[index]
    if (!option) return
    setSelected(option.id)
    if (option.id === card.id) {
      playSfx('correct')
      speakText(deck, `${card.equation?.replace('=', 'is') ?? card.mathPrompt}`)
      window.setTimeout(finishQuestion, 1400)
    } else {
      setGentleReveal(true)
      void playNarrationClip('feedback:let-me-help')
      window.setTimeout(finishQuestion, 1600)
    }
  }, [card.id, complete, finishQuestion, gentleReveal, options, selected])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreControllerKey(event)) return
      if (complete) {
        if (isChoiceKey(event, 'A')) {
          event.preventDefault()
          onNext()
        } else if (isChoiceKey(event, 'B')) {
          event.preventDefault()
          onDone()
        }
        return
      }
      if (isChoiceKey(event, 'A')) {
        event.preventDefault()
        chooseByIndex(0)
      } else if (isChoiceKey(event, 'B')) {
        event.preventDefault()
        chooseByIndex(1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chooseByIndex, complete, onDone, onNext])

  if (complete) {
    return (
      <section className="lesson-complete math-complete">
        <Mascot mood="happy" />
        <span className="prompt-topline">Math lesson {lessonNumber}</span>
        <h1>Five problems finished!</h1>
        <p>That was strong thinking.</p>
        <div className="completion-actions">
          <button type="button" className="primary choice-action" onClick={onNext}><span>A</span>Next Lesson</button>
          <button type="button" className="choice-action" onClick={onDone}><span>B</span>Choose Level</button>
        </div>
        <MathDiffBar difficulty={difficulty} onChangeDifficulty={onChangeDifficulty} />
      </section>
    )
  }

  return (
    <section className="focus-lesson math-focus-lesson">
      <div className="focus-main">
        <div className="focus-question">
          <div className="focus-prompt">
            <span className="stage-label">Problem {questionNumber} of {totalQuestions}</span>
            <h2>{card.mathPrompt || card.displayText}</h2>
            <AudioPromptButton onClick={() => playCardAudio(deck, card)} label="Listen" />
          </div>
          <MathVisual card={card} isEasy={isEasy} />
          <div className={`focus-options ${isEasy ? 'focus-options-easy' : ''}`} aria-label="Answer choices">
            {options.map((option, index) => {
              const isCorrectOption = gentleReveal && option.id === card.id
              const isWrongSelection = gentleReveal && selected === option.id && option.id !== card.id
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`focus-option ${isEasy ? 'focus-option-easy' : ''} ${isCorrectOption ? 'correct pulse' : isWrongSelection ? 'selected-soft' : selected === option.id ? 'correct' : ''}`}
                  disabled={Boolean(selected)}
                  onClick={() => chooseByIndex(index)}
                >
                  {!isEasy && <span className="choice-key">{choiceKeyLabel(index)}</span>}
                  <strong>{optionLabel(option)}</strong>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className={`focus-feedback ${selected ? 'happy' : ''}`}>
        <Mascot mood={selected ? 'happy' : 'curious'} size="small" />
        <div className="feedback-text">
          <strong>{gentleReveal ? "Let's count together" : selected && correct ? "Great thinking!" : "Choose one"}</strong>
          <span>{gentleReveal ? `The answer is ${card.mathAnswer}.` : "A or B"}</span>
        </div>
      </div>
      <MathDiffBar difficulty={difficulty} onChangeDifficulty={onChangeDifficulty} />
    </section>
  )
}

function MathDiffBar({ difficulty, onChangeDifficulty }: { difficulty: MathDifficulty; onChangeDifficulty: (d: MathDifficulty) => void }) {
  return (
    <div className="math-diff-bar" role="group" aria-label="Switch difficulty">
      {MATH_DIFFICULTIES.map((level) => {
        const details = MATH_DIFFICULTY_DETAILS[level]
        return (
          <button
            key={level}
            type="button"
            className={`math-diff-btn math-diff-btn-${level} ${difficulty === level ? 'active' : ''}`}
            onClick={() => onChangeDifficulty(level)}
            title={details.title}
            aria-label={details.title}
            aria-pressed={difficulty === level}
          >
            <span aria-hidden="true">{details.icon}</span>
          </button>
        )
      })}
    </div>
  )
}

function FsrsFlashcardMode({
  deck,
  onComplete,
  onSessionStateChange,
}: {
  deck: LearningDeck
  onComplete: () => void
  onSessionStateChange?: (active: boolean) => void
}) {
  const [cardStates, setCardStates] = useState<Map<string, FlashcardState>>(() => loadFlashcardStates(deck.id))
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [rating, setRating] = useState<Rating | null>(null)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, due: 0, newCards: 0 })
  const [swipeDir, setSwipeDir] = useState<string | null>(null)
  const [celebrationFired, setCelebrationFired] = useState(false)
  const audioPlayedRef = useRef(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const sortedCards = useMemo(() => {
    const states = [...cardStates.values()]
    const starterCards = deck.type === 'reading-words'
      ? deck.cards.filter((card) => GREEN_EGGS_STARTER_WORDS.has(optionLabel(card).toLowerCase()))
      : []
    const starterGateActive = starterCards.length > 0 && !starterCards.every((card) => {
      const state = states.find((item) => item.cardId === card.id)
      return state?.state === 'review' && state.reps >= 2
    })
    const availableCards = starterGateActive ? starterCards : deck.cards
    const cardsWithStates = availableCards.filter((c) => states.some((s) => s.cardId === c.id))
    const newCards = availableCards.filter((c) => !states.some((s) => s.cardId === c.id))
    const dueCards = cardsWithStates.filter((c) => {
      const state = states.find((s) => s.cardId === c.id)
      return state && state.due <= Date.now()
    })
    return [...dueCards, ...newCards]
  }, [deck.cards, deck.type, cardStates])

  const sessionCards = useMemo(
    () => sortedCards.slice(0, deck.type === 'reading-words' ? OLDER_READER_WORD_LESSON_SIZE : sortedCards.length),
    [deck.type, sortedCards],
  )
  const currentCard = sessionCards[currentCardIndex]
  const isSessionComplete = currentCardIndex >= sessionCards.length
  const frontMode = useMemo(() => getFrontMode(deck, currentCard, currentCardIndex), [deck, currentCard, currentCardIndex])
  const currentAudioUrl = currentCard ? resolveAssetUrl(deck, currentCard.audio) : undefined

  const queueCounts = useMemo(
    () => getQueueCounts(sortedCards, cardStates, Date.now()),
    [sortedCards, cardStates],
  )

  useEffect(() => {
    const states = loadFlashcardStates(deck.id)
    const dueCount = [...states.values()].filter((s) => s.due <= Date.now()).length
    const newCount = deck.cards.length - states.size
    setSessionStats({ reviewed: 0, due: dueCount, newCards: newCount })
  }, [deck.id, deck.cards.length])

  useEffect(() => {
    if (!currentCard || audioPlayedRef.current) return
    const shouldPlay = (frontMode === 'audio' && !isFlipped) || (frontMode !== 'audio' && isFlipped)
    if (!shouldPlay) return
    audioPlayedRef.current = true
    if (currentAudioUrl) {
      void playAudioUrl(currentAudioUrl)
      window.setTimeout(() => void playAudioUrl(currentAudioUrl), 1500)
    }
  }, [isFlipped, currentCard, currentAudioUrl, frontMode])

  useEffect(() => {
    audioPlayedRef.current = false
    setIsFlipped(false)
    setRating(null)
    setSwipeDir(null)
  }, [currentCardIndex])

  useEffect(() => {
    onSessionStateChange?.(!isSessionComplete && !!currentCard)
  }, [isSessionComplete, currentCard, onSessionStateChange])

  useEffect(() => {
    if (isSessionComplete && !celebrationFired && sessionStats.reviewed > 0) {
      setCelebrationFired(true)
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#FFD600', '#7C4DFF', '#FF6D00', '#00E676', '#00B0FF'], disableForReducedMotion: true })
      playSfx('celebrate')
    }
  }, [isSessionComplete, celebrationFired, sessionStats.reviewed])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (shouldIgnoreControllerKey(e)) return
      if (isSessionComplete || !currentCard) return
      if (!isFlipped) {
        if (isChoiceKey(e, 'A') || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
      } else if (!rating) {
        if (isChoiceKey(e, 'A')) { e.preventDefault(); handleRate(1) }
        else if (isChoiceKey(e, 'B')) { e.preventDefault(); handleRate(2) }
        else if (isChoiceKey(e, 'C')) { e.preventDefault(); handleRate(3) }
        else if (isChoiceKey(e, 'D')) { e.preventDefault(); handleRate(4) }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function handleFlip() {
    if (!isFlipped) setIsFlipped(true)
  }

  function replayCurrentWord(event?: ReactMouseEvent<HTMLButtonElement>) {
    event?.stopPropagation()
    if (currentAudioUrl) void playAudioUrl(currentAudioUrl)
  }

  function handleRate(r: Rating) {
    if (!currentCard || rating) return
    setRating(r)
    const currentState = getCardState(deck.id, currentCard.id)
    const result = scheduleCard(currentState, r)
    const newStates = new Map(cardStates)
    newStates.set(currentCard.id, result.card)
    setCardStates(newStates)
    saveFlashcardStates(deck.id, newStates)
    setSessionStats((prev) => ({ ...prev, reviewed: prev.reviewed + 1 }))
    window.setTimeout(() => {
      setIsFlipped(false)
      setRating(null)
      setCurrentCardIndex((i) => i + 1)
    }, 600)
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (!isFlipped || rating) return
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStartRef.current || !isFlipped || rating) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    const dy = e.touches[0].clientY - touchStartRef.current.y
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { setSwipeDir(null); return }
    if (Math.abs(dx) > Math.abs(dy)) setSwipeDir(dx > 0 ? 'right' : 'left')
    else setSwipeDir(dy > 0 ? 'down' : 'up')
  }

  function handleTouchEnd() {
    if (!touchStartRef.current || !isFlipped || rating) { touchStartRef.current = null; setSwipeDir(null); return }
    const swipeRating: Record<string, Rating> = { up: 1, left: 2, right: 3, down: 4 }
    if (swipeDir && swipeRating[swipeDir]) handleRate(swipeRating[swipeDir])
    touchStartRef.current = null
    setSwipeDir(null)
  }

  if (isSessionComplete) {
    return (
      <section className="fsrs-complete">
        <div className="celebration-burst" aria-hidden="true" />
        <Mascot mood="happy" />
        <div>
          <span className="prompt-topline">Session complete!</span>
          <h2>You reviewed {sessionStats.reviewed} cards</h2>
          <p>All caught up! Come back later for more reviews.</p>
        </div>
        <div className="completion-actions">
          <button type="button" className="primary" onClick={onComplete}>Done</button>
        </div>
      </section>
    )
  }

  if (!currentCard) {
    return (
      <section className="fsrs-empty">
        <Mascot mood="curious" />
        <h2>No cards to review</h2>
        <p>Add more cards to this deck to start learning.</p>
        <button type="button" className="primary" onClick={onComplete}>Back</button>
      </section>
    )
  }

  const cardState = cardStates.get(currentCard.id)
  const stateLabel = !cardState ? 'New' : cardState.state === 'learning' ? 'Learning' : cardState.state === 'relearning' ? 'Practicing' : 'Review'
  const swipeLabel = swipeDir ? SWIPE_LABELS[swipeDir] : null

  return (
    <section className="fsrs-flashcard">
      <div className="fsrs-header">
        <span className="fsrs-state-badge">{stateLabel}</span>
        <div className="fsrs-queue-counts">
          <span className="fsrs-queue-count queue-new"><strong>{queueCounts.new}</strong>New</span>
          <span className="fsrs-queue-count queue-learning"><strong>{queueCounts.learning}</strong>Learn</span>
          <span className="fsrs-queue-count queue-review"><strong>{queueCounts.review}</strong>Review</span>
          <span className="fsrs-queue-count queue-done"><strong>{queueCounts.done}</strong>Done</span>
        </div>
        <span className="fsrs-progress">{currentCardIndex + 1}/{sessionCards.length}</span>
      </div>

      <div
        className={`fsrs-card-container ${isFlipped ? 'flipped' : ''} ${swipeDir ? `fsrs-swipe-${swipeDir}` : ''} ${!isFlipped && frontMode === 'audio' ? 'fsrs-audio-front' : ''} ${!isFlipped && frontMode === 'picture' ? 'fsrs-picture-front' : ''}`}
        onClick={isFlipped ? undefined : handleFlip}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="fsrs-card">
          <div className="fsrs-card-front">
            <div className="fsrs-card-content">
              {frontMode === 'audio' ? (
                <>
                  <h2 className="fsrs-word fsrs-word-audio">Listen</h2>
                  <p className="fsrs-hint">The word plays twice</p>
                  <WordReplayButton audioUrl={currentAudioUrl} onClick={replayCurrentWord} />
                </>
              ) : frontMode === 'picture' && currentCard.image ? (
                <>
                  <div className="fsrs-image fsrs-image-front">
                    <img src={resolveAssetUrl(deck, currentCard.image)} alt="What word?" />
                  </div>
                  <p className="fsrs-hint">What word matches?</p>
                </>
              ) : (
                <>
                  <h2 className="fsrs-word">{currentCard.displayText}</h2>
                  {currentCard.pinyin && <p className="fsrs-pinyin">{currentCard.pinyin}</p>}
                  <p className="fsrs-hint">Tap to reveal</p>
                  <WordReplayButton audioUrl={currentAudioUrl} onClick={replayCurrentWord} />
                </>
              )}
            </div>
          </div>
          <div className="fsrs-card-back">
            <div className="fsrs-card-content">
              {currentCard.image && (
                <div className="fsrs-image">
                  <img src={resolveAssetUrl(deck, currentCard.image)} alt={currentCard.displayText} />
                </div>
              )}
              <h2 className="fsrs-word">{currentCard.displayText}</h2>
              {currentCard.pinyin && <p className="fsrs-pinyin">{currentCard.pinyin}</p>}
              {currentCard.meaning && <p className="fsrs-meaning">{currentCard.meaning}</p>}
              {currentCard.exampleSentence && <p className="fsrs-example">{currentCard.exampleSentence}</p>}
              <WordReplayButton audioUrl={currentAudioUrl} onClick={replayCurrentWord} />
            </div>
          </div>
        </div>
        {swipeDir && swipeLabel && (
          <div className="fsrs-swipe-indicator" style={{ color: swipeLabel.color }}>
            {swipeLabel.text}
          </div>
        )}
      </div>

      {isFlipped && (
        <div className="fsrs-rating-buttons">
          <button type="button" className={`fsrs-btn fsrs-btn-again ${rating === 1 ? 'selected' : ''}`} onClick={() => handleRate(1)} disabled={rating !== null}>
            <kbd>A</kbd>
            <span className="btn-label">Try More</span>
            <span className="btn-interval">&lt;1m</span>
          </button>
          <button type="button" className={`fsrs-btn fsrs-btn-hard ${rating === 2 ? 'selected' : ''}`} onClick={() => handleRate(2)} disabled={rating !== null}>
            <kbd>B</kbd>
            <span className="btn-label">Hard</span>
            <span className="btn-interval">6m</span>
          </button>
          <button type="button" className={`fsrs-btn fsrs-btn-good ${rating === 3 ? 'selected' : ''}`} onClick={() => handleRate(3)} disabled={rating !== null}>
            <kbd>C</kbd>
            <span className="btn-label">Good</span>
            <span className="btn-interval">10m</span>
          </button>
          <button type="button" className={`fsrs-btn fsrs-btn-easy ${rating === 4 ? 'selected' : ''}`} onClick={() => handleRate(4)} disabled={rating !== null}>
            <kbd>D</kbd>
            <span className="btn-label">Easy</span>
            <span className="btn-interval">4d</span>
          </button>
        </div>
      )}

      {!isFlipped && (
        <div className="fsrs-show-answer">
          <button type="button" className="fsrs-btn fsrs-btn-show" onClick={handleFlip}>
            <kbd>A</kbd>
            Show Answer
          </button>
          <p className="fsrs-swipe-hint">After flipping: swipe ↑ Try More ← Almost → Good ↓ Easy</p>
        </div>
      )}
    </section>
  )
}

function ChoiceMode({
  deck,
  lessonCards,
  card,
  cardIndex,
  mode,
  onNext,
}: {
  deck: LearningDeck
  lessonCards: LearningCard[]
  card: LearningCard
  cardIndex: number
  mode: LearningMode
  onNext: () => void
}) {
  const [selected, setSelected] = useState('')
  const [gentleReveal, setGentleReveal] = useState(false)
  useAutoplayCard(deck, card, `question:${deck.id}:${card.id}`)
  const options = useMemo(() => buildOptions(lessonCards, card), [card, lessonCards])
  const correct = selected === card.id
  const mood: MascotMood = gentleReveal ? 'curious' : selected ? (correct ? 'happy' : 'curious') : 'curious'

  function choose(cardId: string) {
    if (gentleReveal) return
    setSelected(cardId)
    if (cardId === card.id) {
      markCardRecalled(deck.id, card.id)
      void playCardAudio(deck, card)
      window.setTimeout(onNext, 900)
    } else {
      setGentleReveal(true)
      void playNarrationClip('feedback:let-me-help')
      void playCardAudio(deck, card)
      window.setTimeout(onNext, 1800)
    }
  }

  const chooseByIndex = useCallback((index: number) => {
    if (gentleReveal || selected) return
    const option = options[index]
    if (option) choose(option.id)
  }, [gentleReveal, options, selected])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreControllerKey(event)) return
      if (isChoiceKey(event, 'A')) {
        event.preventDefault()
        chooseByIndex(0)
      } else if (isChoiceKey(event, 'B')) {
        event.preventDefault()
        chooseByIndex(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chooseByIndex])

  return (
    <section className="focus-lesson">
      <div className="focus-main">
        <div className="focus-question">
          <div className="focus-prompt">
            <span className="stage-label">{mode === 'readerMode' ? 'Quiz' : 'Practice'}</span>
            <h2>{getChoicePrompt(deck, card, mode)}</h2>
            <div className="prompt-cue">
              <AudioPromptButton onClick={() => playCardAudio(deck, card)} label="Listen" />
            </div>
          </div>
          {deck.type === 'math' && <MathVisual card={card} />}
          {deck.type === 'chinese-vocab' && (
            <div className="chinese-question-card">
              <span>{card.simpleMeaning}</span>
              <strong>{card.pinyin}</strong>
            </div>
          )}
          <div className="focus-options" aria-label="Answer choices">
            {options.map((option) => {
              const isCorrectOption = gentleReveal && option.id === card.id
              const isWrongSelection = gentleReveal && selected === option.id && option.id !== card.id
              const isSelectedCorrect = !gentleReveal && selected && option.id === card.id
              const isSelectedWrong = !gentleReveal && selected === option.id && option.id !== card.id
              const stateClass = isCorrectOption
                ? 'correct pulse'
                : isWrongSelection
                  ? 'selected-soft'
                  : isSelectedCorrect
                    ? 'correct'
                    : isSelectedWrong
                      ? 'wrong'
                      : ''
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`focus-option ${stateClass}`}
                  disabled={Boolean(selected)}
                  onClick={() => choose(option.id)}
                >
                  <strong>{optionLabel(option)}</strong>
                  <small>{optionSmallLabel(option)}</small>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className={`focus-feedback ${gentleReveal ? 'happy' : selected ? (correct ? 'happy' : 'try') : ''}`}>
        <Mascot mood={mood} size="small" />
        <div className="feedback-text">
          {gentleReveal ? (
            <>
              <strong>Let's hear it!</strong>
              <span>It was {optionLabel(card)}.</span>
            </>
          ) : selected ? (
            correct ? (
              <>
                <strong>Great!</strong>
                <span>{encouragement[(cardIndex + card.id.length) % encouragement.length]}</span>
              </>
            ) : (
              <>
                <strong>Try again</strong>
                <span>That was {optionLabel(card)}</span>
              </>
            )
          ) : (
            <>
              <strong>Choose one</strong>
              <span>Tap the answer</span>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

const MATH_OBJECT_EMOJI: Record<string, string> = {
  apples: '🍎',
  apple: '🍎',
  berries: '🍓',
  berry: '🍓',
  blocks: '🟦',
  block: '🟦',
  shells: '🐚',
  shell: '🐚',
  stars: '⭐',
  star: '⭐',
  buttons: '🔵',
  button: '🔵',
  flowers: '🌸',
  flower: '🌸',
  fish: '🐟',
  birds: '🐦',
  bird: '🐦',
  clouds: '☁️',
  cloud: '☁️',
  hearts: '💜',
  heart: '💜',
  suns: '🌟',
  sun: '🌟',
}

function ObjectImage({ object }: { object: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      className="math-obj-img"
      src={`${import.meta.env.BASE_URL}math-objects/${object}.png`}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  )
}

function RotateOverlay() {
  return (
    <div className="rotate-overlay" aria-live="polite">
      <div className="rotate-overlay-inner">
        <div className="rotate-icon" aria-hidden="true">&#8635;</div>
        <h2>Rotate your device</h2>
        <p>This app works best in landscape mode</p>
      </div>
    </div>
  )
}

function MathVisual({ card, isEasy = false }: { card: LearningCard; isEasy?: boolean }) {
  const kind = card.mathQuestionKind || (card.mathOperation === 'subtract' ? 'picture-subtract' : 'picture-add')
  const object = card.mathObject || 'apple'
  const emoji = MATH_OBJECT_EMOJI[object] ?? '🔴'

  if (isEasy) {
    if (card.mathOperation === 'subtract') {
      const groups = card.mathVisualGroups ?? []
      const total = groups[0] ?? 0
      const removing = groups[1] ?? 0
      return (
        <div className="math-count-easy math-count-subtract" aria-label={`${total} ${object}s, take away ${removing}`}>
          <ObjectImage object={object} />
          <div className="math-count-group">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`math-count-emoji ${i >= total - removing ? 'count-cross' : ''}`} aria-hidden="true">
                {emoji}
              </span>
            ))}
          </div>
        </div>
      )
    }
    const groups = card.mathVisualGroups ?? []
    const op = '+'
    return (
      <div className="math-count-easy" aria-label={groups.map((g) => `${g} ${object}s`).join(' plus ')}>
        <ObjectImage object={object} />
        {groups.map((group, gi) => (
          <div key={gi} className="math-count-part">
            {gi > 0 && <span className="math-count-op" aria-hidden="true">{op}</span>}
            <div className="math-count-group">
              {group === 0
                ? <span className="math-count-zero" aria-hidden="true">0</span>
                : Array.from({ length: group }, (_, i) => (
                    <span key={i} className="math-count-emoji" aria-hidden="true">{emoji}</span>
                  ))
              }
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (kind === 'equation') {
    return (
      <div className="math-equation-card">
        <ObjectImage object={object} />
        <span className="math-eq-formula">{card.equation || card.displayText}</span>
      </div>
    )
  }

  if (card.mathOperation === 'subtract') {
    const count = card.mathVisualCount ?? 0
    const removed = card.mathRemovedCount ?? 0
    return (
      <div className="math-visual-card">
        <ObjectImage object={object} />
        {card.mathStoryText && <p>{card.mathStoryText}</p>}
        <div className="math-token-row" aria-label={`${count} ${object}s, ${removed} taken away`}>
          {Array.from({ length: count }, (_, index) => (
            <span key={index} className={`math-token ${index < removed ? 'removed' : ''}`} aria-hidden="true" />
          ))}
        </div>
      </div>
    )
  }

  const groups = card.mathVisualGroups ?? []
  return (
    <div className="math-visual-card">
      <ObjectImage object={object} />
      {card.mathStoryText && <p>{card.mathStoryText}</p>}
      <div className="math-group-row" aria-label={groups.map((group) => `${group} ${object}s`).join(' plus ')}>
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="math-token-group">
            {Array.from({ length: group }, (_, index) => (
              <span key={index} className="math-token" aria-hidden="true" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Picture({ deck, card }: { deck: LearningDeck; card: LearningCard }) {
  const label = card.exampleWord || card.word || card.displayText
  return (
    <AssetImage
      src={resolveAssetUrl(deck, card.image)}
      label={label}
      className="picture-frame"
      fallback={<PictureFallback label={label} />}
    />
  )
}

function AssetImage({
  src,
  label,
  className,
  fallback,
}: {
  src?: string
  label: string
  className: string
  fallback: ReactNode
}) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>()

  if (!src || failedSrc === src) return <div className={className}>{fallback}</div>
  return (
    <div className={className}>
      <img src={src} alt={label} onError={() => setFailedSrc(src)} />
    </div>
  )
}

function PictureFallback({ label }: { label: string }) {
  const initial = label.trim()[0]?.toLocaleUpperCase() ?? '?'
  return (
    <div className="picture-fallback" aria-label={`${label} picture placeholder`}>
      <span>{initial}</span>
      <strong>{label}</strong>
      <small>Picture soon</small>
    </div>
  )
}

function Mascot({ size = 'large', mood = 'reading' }: { size?: 'small' | 'large'; mood?: MascotMood }) {
  const [failed, setFailed] = useState(false)
  const src = `${import.meta.env.BASE_URL}assets/mascots/mascot-expressions.png`

  useEffect(() => {
    const image = new Image()
    image.onerror = () => setFailed(true)
    image.src = src
  }, [src])

  return failed ? (
    <span className={`panda-fallback ${size}`} aria-label="Chunky Learner panda mascot">
      <span className="panda-ear left" />
      <span className="panda-ear right" />
      <span className="panda-eye left" />
      <span className="panda-eye right" />
      <span className="panda-nose" />
    </span>
  ) : (
    <span
      className={`mascot-sprite ${size} mood-${mood}`}
      role="img"
      aria-label={`Chunky Learner panda mascot feeling ${mood}`}
      style={{ backgroundImage: `url(${src})` }}
    />
  )
}

function ChunkyLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`chunky-logo ${compact ? 'compact' : ''}`} aria-label="Chunky Learner">
      <span>Chunky</span>
      <strong>Learner</strong>
    </div>
  )
}

function PlayIcon() {
  return <span className="play-icon" aria-hidden="true" />
}

function HomeIcon() {
  return <span className="home-icon" aria-hidden="true" />
}

function AudioPackButton({ compact = false }: { compact?: boolean }) {
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<AudioPackInstallProgress | undefined>()
  const [installed, setInstalled] = useState(() => getInstalledAudioPackSummary())
  const [availableVersion, setAvailableVersion] = useState('')
  useEffect(() => {
    let cancelled = false
    void loadAudioClipPackManifest().then((manifest) => {
      if (!cancelled) setAvailableVersion(manifest?.version || manifest?.createdAt || '')
    })
    return () => {
      cancelled = true
    }
  }, [])
  const needsUpdate = Boolean(installed && availableVersion && installed.version !== availableVersion)
  const label = installing
    ? `Saving ${progress?.done ?? 0}/${progress?.total ?? 0}`
    : needsUpdate
      ? 'Update Audio'
      : installed
      ? `Audio saved (${installed.clipCount ?? '?'})`
      : 'Save Audio'

  async function install() {
    if (installing) return
    setInstalling(true)
    try {
      await installAudioClipPack(setProgress)
      setInstalled(getInstalledAudioPackSummary())
    } finally {
      setInstalling(false)
    }
  }

  return (
    <button
      type="button"
      className={compact ? 'menu-item audio-pack-button compact' : 'audio-pack-button'}
      disabled={installing}
      onClick={install}
    >
      {label}
    </button>
  )
}

function useAutoplayCard(deck: LearningDeck, card: LearningCard, key: string) {
  const lastKey = useRef('')

  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    if (!loadAppSettings().autoplayAudio) return
    const timer = window.setTimeout(() => {
      void playCardAudio(deck, card)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [card, deck, key])
}

async function playCardAudio(deck: LearningDeck, card: LearningCard) {
  const audioPath = card.audio || card.exampleAudio || card.letterNameAudio
  const audioUrl = resolveAssetUrl(deck, audioPath)
  if (audioUrl) {
    try {
      await playAudioUrl(audioUrl)
      return
    } catch {
      // Missing or not-yet-recorded assets fall back to browser speech.
    }
  }

  const text = card.ttsText || card.speechCue || card.mathPrompt || card.exampleWord || card.word || card.displayText
  speakText(deck, text)
}

function buildOptions(cards: LearningCard[], card: LearningCard): LearningCard[] {
  const seed = card.id

  if (card.type === 'math' && card.mathAnswerOptions && card.mathAnswer !== undefined) {
    const answer = card.mathAnswer
    const offsets = [1, 2, -2, -1]
    const offset = offsets[stableHash(card.id) % offsets.length]
    const wrong = Math.max(0, answer + offset)
    const options = wrong === answer ? [answer, answer + 1] : [wrong, answer]
    return options.sort((a, b) => stableSort(`${card.id}:${a}`) - stableSort(`${card.id}:${b}`)).map(num => ({
      ...card,
      id: num === answer ? card.id : `${card.id}-wrong-${num}`,
      displayText: String(num),
      category: ''
    }))
  }

  const distractors = cards
    .filter((candidate) => candidate.id !== card.id)
    .sort((a, b) => stableSort(`${seed}:${a.id}`) - stableSort(`${seed}:${b.id}`))
    .slice(0, 1)
  return [card, ...distractors].sort(
    (a, b) => stableSort(`order:${seed}:${a.id}`) - stableSort(`order:${seed}:${b.id}`),
  )
}

function buildOlderReaderActivities(lessonCards: LearningCard[]): OlderReaderActivity[] {
  const wordCards = lessonCards.filter((card) => card.type === 'word')
  if (!wordCards.length) return []

  const peekActivities: OlderReaderActivity[] = wordCards.map((card) => ({
    kind: 'peek' as OlderReaderQuestionKind,
    card,
    options: [] as LearningCard[],
  }))

  const practiceKinds: OlderReaderQuestionKind[] = [
    'audioToWord',
    'wordFamily',
    'audioToWord',
    'startsWithSound',
    'sentenceBridge',
    'audioToWord',
    'wordFamily',
    'audioToWord',
    'startsWithSound',
    'audioToWord',
    'sentenceBridge',
    'audioToWord',
    'audioToWord',
  ]
  const quizActivities: OlderReaderActivity[] = Array.from({ length: OLDER_READER_RECOGNITION_COUNT }, (_, index) => {
    const card = wordCards[index % wordCards.length]
    const kind = practiceKinds[index % practiceKinds.length]
    return {
      kind,
      card,
      options: buildOlderReaderOptions(wordCards, card, kind, true),
      challenge: ['pictureToWord', 'review', 'wordFamily'].includes(kind),
    }
  })

  return [
    ...peekActivities,
    ...quizActivities,
    {
      kind: 'readTogether',
      card: wordCards[0],
      options: [],
    },
  ]
}

function buildOlderReaderOptions(
  lessonCards: LearningCard[],
  card: LearningCard,
  kind: OlderReaderQuestionKind,
  preferNearMiss = false,
): LearningCard[] {
  const candidates = lessonCards.filter((candidate) => candidate.id !== card.id)
  const preferred = candidates.filter((candidate) => {
    if (kind === 'startsWithSound') return firstSound(candidate) !== firstSound(card)
    if (kind === 'wordFamily') return wordChunk(candidate) !== wordChunk(card)
    return true
  })
  const pool = preferred.length ? preferred : candidates
  const distractor = pool
    .map((candidate) => ({
      candidate,
      score: preferNearMiss ? olderReaderDistractorScore(card, candidate, kind) : 0,
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      return stableSort(`older:${kind}:${card.id}:${a.candidate.id}`) - stableSort(`older:${kind}:${card.id}:${b.candidate.id}`)
    })[0]?.candidate ?? card

  return [card, distractor].sort(
    (a, b) => stableSort(`older-order:${kind}:${card.id}:${a.id}`) - stableSort(`older-order:${kind}:${card.id}:${b.id}`),
  )
}

function olderReaderDistractorScore(card: LearningCard, candidate: LearningCard, kind: OlderReaderQuestionKind): number {
  const word = optionLabel(card).toLowerCase()
  const other = optionLabel(candidate).toLowerCase()
  let score = 0
  if (firstSound(card) === firstSound(candidate)) score += kind === 'startsWithSound' ? -3 : 4
  if (wordChunk(card) === wordChunk(candidate)) score += kind === 'wordFamily' ? -3 : 4
  score += Math.max(0, 3 - Math.abs(word.length - other.length))
  if (isBookWord(candidate)) score += 2
  if (word[0] && word[0] === other[0]) score += 1
  if (word[word.length - 1] && word[word.length - 1] === other[other.length - 1]) score += 1
  return score
}

function getOlderReaderPrompt(activity: OlderReaderActivity): string {
  if (activity.kind === 'peek') return ''
  if (activity.kind === 'pictureToWord' || activity.kind === 'review') return 'What word matches the picture?'
  if (activity.kind === 'wordToPicture') return 'Which picture matches this word?'
  if (activity.kind === 'audioToWord') return 'Which word did you hear?'
  if (activity.kind === 'startsWithSound') return `Which word starts with ${firstSound(activity.card)}?`
  if (activity.kind === 'wordFamily') return 'Which word has this chunk?'
  if (activity.kind === 'sentenceBridge') return 'Which word fits?'
  if (activity.kind === 'readTogether') return 'Read together.'
  return 'Choose the word.'
}

function isBookWord(card: LearningCard): boolean {
  const word = optionLabel(card).toLowerCase()
  return GREEN_EGGS_STARTER_WORDS.has(word) || (card.tags ?? []).some((tag) => tag.toLowerCase() === 'green-eggs-starter')
}

function firstSound(card: LearningCard): string {
  const word = optionLabel(card).toLowerCase()
  const digraph = ['sh', 'ch', 'th', 'wh', 'ph'].find((chunk) => word.startsWith(chunk))
  return digraph ? digraph : word[0] ?? ''
}

function wordChunk(card: LearningCard): string {
  const word = optionLabel(card).toLowerCase()
  if (word.length <= 2) return word
  return word.slice(-2)
}

function optionLabel(card: LearningCard): string {
  return card.word || card.displayText || card.grapheme || card.exampleWord || ''
}

function optionSmallLabel(card: LearningCard): string {
  if (card.type === 'phoneme') return card.exampleWord || ''
  if (card.type === 'letter') return card.exampleWord || ''
  if (card.type === 'sentence') return card.meaning || ''
  if (card.type === 'math') return 'answer'
  if (card.type === 'chinese') return [card.pinyin, card.simpleMeaning].filter(Boolean).join(' - ')
  return card.category || ''
}

function getChoicePrompt(deck: LearningDeck, card: LearningCard, mode: LearningMode): string {
  if (card.type === 'sentence') return mode === 'readerMode' ? 'Read this sentence.' : 'Find this sentence.'
  if (deck.type === 'reading-words') return mode === 'readerMode' ? 'What word matches the picture?' : 'Find this word.'
  if (deck.type === 'letters') return mode === 'readerMode' ? 'Which letter makes this sound?' : 'Tap the matching letter.'
  if (card.grapheme) return mode === 'readerMode' ? 'Which spelling matches this sound?' : 'Tap the matching sound.'
  if (deck.type === 'math') return card.mathPrompt || card.equation || card.displayText || 'Solve.'
  if (deck.type === 'chinese-vocab') return 'Tap the matching character.'
  return 'Choose the match.'
}

function buildSarahActivities(lessonCards: LearningCard[]): SarahActivity[] {
  const intros = lessonCards.map((card): SarahActivity => ({ kind: 'intro', card }))
  const wordToBeginningSound = lessonCards.map((card): SarahActivity => ({
    kind: 'wordToBeginningSound',
    card,
    options: buildSarahOptions(lessonCards, card),
  }))
  const soundToWord = lessonCards.map((card): SarahActivity => ({
    kind: 'soundToWord',
    card,
    options: buildSarahOptions(lessonCards, card),
  }))
  const upperLower = lessonCards.map((card, index): SarahActivity => {
    const promptCase = index % 2 === 0 ? 'upper' : 'lower'
    return {
      kind: 'upperLowerMatch',
      card,
      promptCase,
      textOptions: buildCaseOptions(lessonCards, card, promptCase),
      correctText: promptCase === 'upper' ? card.lowercase : card.uppercase,
    }
  })
  const review = lessonCards.map((card, index): SarahActivity => buildSarahReviewActivity(lessonCards, card, index))
  return [...intros, ...wordToBeginningSound, ...soundToWord, ...upperLower, ...review]
}

function buildSarahReviewActivity(lessonCards: LearningCard[], card: LearningCard, index: number): SarahActivity {
  const variant = SARAH_REVIEW_VARIANTS[index % SARAH_REVIEW_VARIANTS.length]
  if (variant === 'upperLowerMatch') {
    const promptCase = index % 2 === 0 ? 'upper' : 'lower'
    return {
      kind: 'review',
      reviewVariant: variant,
      card,
      promptCase,
      textOptions: buildCaseOptions(lessonCards, card, promptCase),
      correctText: promptCase === 'upper' ? card.lowercase : card.uppercase,
    }
  }
  return {
    kind: 'review',
    reviewVariant: variant,
    card,
    options: buildSarahOptions(lessonCards, card),
  }
}

function buildSarahOptions(lessonCards: LearningCard[], card: LearningCard): LearningCard[] {
  const distractor = bestDistractor(lessonCards, card)
  return [card, distractor].sort(
    (a, b) => stableSort(`sarah:${card.id}:${a.id}`) - stableSort(`sarah:${card.id}:${b.id}`),
  )
}

function buildCaseOptions(lessonCards: LearningCard[], card: LearningCard, promptCase: 'upper' | 'lower'): string[] {
  const distractor = bestDistractor(lessonCards, card)
  const correct = promptCase === 'upper' ? card.lowercase : card.uppercase
  const wrong = promptCase === 'upper' ? distractor.lowercase : distractor.uppercase
  return [correct, wrong]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => stableSort(`case:${card.id}:${a}`) - stableSort(`case:${card.id}:${b}`))
}

function bestDistractor(lessonCards: LearningCard[], card: LearningCard): LearningCard {
  const lower = card.lowercase ?? ''
  const confusable = CONFUSABLES[lower] ?? []
  const match = lessonCards.find((candidate) => candidate.id !== card.id && confusable.includes(candidate.lowercase ?? ''))
  if (match) return match
  return (
    lessonCards
      .filter((candidate) => candidate.id !== card.id)
      .sort((a, b) => stableSort(`distractor:${card.id}:${a.id}`) - stableSort(`distractor:${card.id}:${b.id}`))[0] ?? card
  )
}

function getSarahQuestionKind(activity: SarahActivity): SarahQuestionKind | 'intro' {
  return activity.kind === 'review' ? activity.reviewVariant ?? 'soundToLetter' : activity.kind
}

function getSarahCorrectAnswer(activity: SarahActivity): string {
  if (activity.textOptions) return activity.correctText ?? ''
  return activity.card.id
}

function getSarahFeedback(status: SarahActivityStatus, activity: SarahActivity): { title: string; detail: string } {
  if (activity.kind === 'intro') {
    return { title: 'Listen with Chunky!', detail: `${activity.card.sound} like ${activity.card.exampleWord}.` }
  }
  if (status === 'correct') return { title: 'Yay!', detail: 'Great job!' }
  if (status === 'try-again') return { title: 'Almost!', detail: 'Try one more time.' }
  if (status === 'revealed') return { title: 'Here it is!', detail: `It was ${sarahAnswerText(activity)}.` }
  return { title: 'Hmm...', detail: 'Tap one choice.' }
}

function sarahAnswerText(activity: SarahActivity): string {
  if (activity.textOptions) return activity.correctText ?? ''
  return activity.card.displayText
}

function choiceState(answer: string, correctAnswer: string, wrongChoice: string, status: SarahActivityStatus): string {
  if (status === 'revealed' && answer === correctAnswer) return 'correct pulse'
  if (status === 'correct' && answer === correctAnswer) return 'correct pulse'
  if (wrongChoice === answer && (status === 'try-again' || status === 'revealed')) return 'wrong shake'
  return ''
}

function useAutoplaySarahActivity(deck: LearningDeck, activity: SarahActivity | undefined, key: string) {
  const lastKey = useRef('')

  useEffect(() => {
    if (!activity || lastKey.current === key) return
    lastKey.current = key
    const timer = window.setTimeout(() => {
      void playSarahActivityAudio(deck, activity)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [activity, deck, key])
}

async function playSarahActivityAudio(deck: LearningDeck, activity: SarahActivity) {
  const kind = getSarahQuestionKind(activity)
  if (kind === 'upperLowerMatch') {
    await playCardAudio(deck, activity.card)
    return
  }
  await playCardAudio(deck, activity.card)
}

function speakText(deck: LearningDeck, text?: string) {
  if (!text || !('speechSynthesis' in window)) return
  stopAudioPlayback()
  const utterance = new SpeechSynthesisUtterance(text.replaceAll('/', ''))
  utterance.lang = deck.language || 'en-US'
  utterance.rate = deck.profile === 'sarah' ? 0.72 : 0.86
  window.speechSynthesis.speak(utterance)
}

function readStoryProgress(storyId: string, pageCount: number): number {
  try {
    const stored = window.localStorage.getItem(storyProgressKey(storyId))
    const index = stored ? Number(stored) : 0
    return Number.isFinite(index) ? Math.max(0, Math.min(pageCount - 1, index)) : 0
  } catch {
    return 0
  }
}

function saveStoryProgress(storyId: string, pageIndex: number) {
  try {
    window.localStorage.setItem(storyProgressKey(storyId), String(pageIndex))
    recordLocalProgressChange()
  } catch {
    // Reading should never depend on storage support.
  }
}

function storyProgressKey(storyId: string): string {
  return `chunky-reader:story:${storyId}:page`
}

function readContinueState(): ContinueLearningState | undefined {
  try {
    const raw = localStorage.getItem(CONTINUE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as ContinueLearningState
    return parsed.section ? parsed : undefined
  } catch {
    return undefined
  }
}

function orderCardsForMode(deck: LearningDeck, mode: LearningMode): LearningCard[] {
  const sourceCards = deck.profile === 'anna' && deck.type === 'reading-words'
    ? deck.cards.filter((card) => card.type === 'word')
    : deck.cards
  if (deck.profile !== 'anna') return sourceCards
  const now = Date.now()
  return sourceCards
    .map((card, index) => ({ card, index, progress: readCardProgress(deck.id, card.id) }))
    .sort((a, b) => {
      const aPriority = cardPriority(a.progress, mode, now)
      const bPriority = cardPriority(b.progress, mode, now)
      if (aPriority !== bPriority) return aPriority - bPriority
      const aDifficulty = a.card.difficulty ?? Number.MAX_SAFE_INTEGER
      const bDifficulty = b.card.difficulty ?? Number.MAX_SAFE_INTEGER
      if (aDifficulty !== bDifficulty) return aDifficulty - bDifficulty
      return a.index - b.index
    })
    .map((entry) => entry.card)
}

function cardPriority(progress: CardProgress, mode: LearningMode, now: number): number {
  const deferred = (progress.reviewAfter ?? 0) > now
  if (mode === 'listeningMode') {
    if (!progress.listenedAt) return 0
    return deferred ? 2 : 1
  }
  if (mode === 'activeRecall') {
    if (deferred) return 2
    if (!progress.recalledAt) return 0
    return 1
  }
  if (!progress.flashGoodAt) return 0
  return progress.flashAgainAt && progress.flashAgainAt > progress.flashGoodAt ? 0 : 1
}

interface CardProgress {
  listenedAt?: number
  reviewAfter?: number
  recalledAt?: number
  firstTryRecalled?: boolean
  flashAgainAt?: number
  flashGoodAt?: number
}

function markCardsListened(deckId: string, cards: LearningCard[]) {
  const listenedAt = Date.now()
  for (const card of cards) {
    updateCardProgress(deckId, card.id, {
      listenedAt,
      reviewAfter: listenedAt + ONE_DAY_MS,
    })
  }
}

function markCardRecalled(deckId: string, cardId: string) {
  updateCardProgress(deckId, cardId, { recalledAt: Date.now() })
}

function markCardsRecalled(deckId: string, cards: LearningCard[]) {
  const recalledAt = Date.now()
  for (const card of cards) {
    updateCardProgress(deckId, card.id, { recalledAt })
  }
}

function saveFlashcardChoice(deckId: string, cardId: string, choice: FlashcardChoice) {
  updateCardProgress(deckId, cardId, choice === 'again' ? { flashAgainAt: Date.now() } : { flashGoodAt: Date.now() })
}

function readCardProgress(deckId: string, cardId: string): CardProgress {
  try {
    const raw = window.localStorage.getItem(cardProgressKey(deckId, cardId))
    return raw ? JSON.parse(raw) as CardProgress : {}
  } catch {
    return {}
  }
}

function updateCardProgress(deckId: string, cardId: string, patch: CardProgress) {
  try {
    const next = { ...readCardProgress(deckId, cardId), ...patch }
    window.localStorage.setItem(cardProgressKey(deckId, cardId), JSON.stringify(next))
    recordLocalProgressChange()
  } catch {
    // Review scheduling is helpful, but the lesson must keep working without storage.
  }
}

function cardProgressKey(deckId: string, cardId: string): string {
  return `chunky-reader:card-progress:${deckId}:${cardId}`
}

function lessonStartForIndex(index: number, totalCards: number, lessonSize = LESSON_SIZE): number {
  const lastFullStart = Math.max(0, totalCards - lessonSize)
  return Math.min(Math.floor(index / lessonSize) * lessonSize, lastFullStart)
}

function lessonNumberForIndex(index: number, totalCards: number, lessonSize = LESSON_SIZE): number {
  const totalLessons = Math.max(1, Math.ceil(totalCards / lessonSize))
  const lastFullStart = Math.max(0, totalCards - lessonSize)
  if (index >= lastFullStart && index % lessonSize !== 0) return totalLessons
  return Math.min(totalLessons, Math.floor(index / lessonSize) + 1)
}

function fixedLessonStartForIndex(index: number, totalCards: number): number {
  if (totalCards <= 0) return 0
  const start = Math.floor(index / LESSON_SIZE) * LESSON_SIZE
  return Math.min(start, Math.max(0, totalCards - 1))
}

function fixedLessonNumberForIndex(index: number, totalCards: number): number {
  const totalLessons = Math.max(1, Math.ceil(totalCards / LESSON_SIZE))
  return Math.min(totalLessons, Math.floor(index / LESSON_SIZE) + 1)
}

interface OlderReaderPhonemeProgress {
  learnedIds: string[]
  nextIndex: number
  cycle: number
}

function readOlderReaderPhonemeProgress(deckId: string, totalCards: number): OlderReaderPhonemeProgress {
  try {
    const raw = window.localStorage.getItem(olderReaderPhonemeProgressKey(deckId))
    const parsed = raw ? JSON.parse(raw) as Partial<OlderReaderPhonemeProgress> : {}
    const nextIndex = Number.isFinite(parsed.nextIndex) ? Number(parsed.nextIndex) : 0
    return {
      learnedIds: Array.isArray(parsed.learnedIds) ? parsed.learnedIds.filter((id): id is string => typeof id === 'string') : [],
      nextIndex: Math.min(Math.max(0, nextIndex), Math.max(0, totalCards - 1)),
      cycle: Number.isFinite(parsed.cycle) ? Number(parsed.cycle) : 1,
    }
  } catch {
    return { learnedIds: [], nextIndex: 0, cycle: 1 }
  }
}

function readOlderReaderPhonemeNextIndex(deckId: string, totalCards: number): number {
  return readOlderReaderPhonemeProgress(deckId, totalCards).nextIndex
}

function completeOlderReaderPhonemeLesson(deck: LearningDeck, lessonCards: LearningCard[]): number {
  const progress = readOlderReaderPhonemeProgress(deck.id, deck.cards.length)
  const learned = new Set(progress.learnedIds)
  for (const card of lessonCards) learned.add(card.id)

  const allDone = deck.cards.every((card) => learned.has(card.id))
  const nextIndex = allDone ? 0 : Math.max(0, deck.cards.findIndex((card) => !learned.has(card.id)))
  const nextProgress: OlderReaderPhonemeProgress = {
    learnedIds: allDone ? [] : [...learned],
    nextIndex,
    cycle: allDone ? progress.cycle + 1 : progress.cycle,
  }

  try {
    window.localStorage.setItem(olderReaderPhonemeProgressKey(deck.id), JSON.stringify(nextProgress))
    recordLocalProgressChange()
  } catch {
    // Progress tracking should help the loop, but never block the reading lesson.
  }

  return nextIndex
}

function olderReaderPhonemeProgressKey(deckId: string): string {
  return `chunky-reader:older-reader-phonemes:${deckId}`
}

function sarahLetterLessonCount(totalCards: number): number {
  if (totalCards <= LESSON_SIZE) return 1
  const normalCards = totalCards - SARAH_FINAL_REVIEW_SIZE
  if (normalCards <= LESSON_SIZE) return 2
  return Math.ceil((normalCards - LESSON_SIZE) / SARAH_LESSON_ADVANCE) + 2
}

function sarahFinalLessonStart(totalCards: number): number {
  return Math.max(0, totalCards - SARAH_FINAL_REVIEW_SIZE)
}

function sarahLetterLessonStartForIndex(index: number, totalCards: number): number {
  const finalStart = sarahFinalLessonStart(totalCards)
  if (index >= finalStart) return finalStart
  return Math.floor(index / SARAH_LESSON_ADVANCE) * SARAH_LESSON_ADVANCE
}

function sarahLetterLessonStartForNumber(lessonIndex: number, totalCards: number): number {
  const finalLessonIndex = sarahLetterLessonCount(totalCards) - 1
  if (lessonIndex >= finalLessonIndex) return sarahFinalLessonStart(totalCards)
  return lessonIndex * SARAH_LESSON_ADVANCE
}

function sarahLetterLessonNumberForIndex(index: number, totalCards: number): number {
  const finalStart = sarahFinalLessonStart(totalCards)
  if (index >= finalStart) return sarahLetterLessonCount(totalCards)
  return Math.floor(index / SARAH_LESSON_ADVANCE) + 1
}

function sarahLetterLessonSizeForStart(start: number, totalCards: number): number {
  if (start >= sarahFinalLessonStart(totalCards)) return Math.min(SARAH_FINAL_REVIEW_SIZE, totalCards - start)
  return Math.min(LESSON_SIZE, totalCards - start)
}

function stableSort(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function StickerBook({ onClose }: { onClose: () => void }) {
  const [annaLessons] = useState(() => parseInt(localStorage.getItem('completed-lessons-anna') || '0', 10))
  const [sarahLessons] = useState(() => parseInt(localStorage.getItem('completed-lessons-sarah') || '0', 10))
  const [hundredLessons] = useState(() => parseInt(localStorage.getItem('completed-lessons-100') || '0', 10))

  function renderStickers(lessons: number, isAnna: boolean) {
    const stickers = []
    const totalSlots = Math.max(6, lessons + (3 - (lessons % 3 || 3)))
    for (let i = 0; i < totalSlots; i++) {
      const emojis = isAnna ? ['A1', 'A2', 'A3', 'A4'] : ['S1', 'S2', 'S3', 'S4']
      stickers.push(i < lessons ? emojis[i % emojis.length] : '')
    }
    return stickers
  }

  function renderHundredLessonStickers(lessons: number) {
    const stickers = []
    const trophyStickers = ['100', 'WIN', 'BOOK', 'STAR']
    const totalSlots = Math.max(6, lessons + (3 - (lessons % 3 || 3)))
    for (let i = 0; i < totalSlots; i++) {
      stickers.push(i < lessons ? trophyStickers[i % trophyStickers.length] : '')
    }
    return stickers
  }

  return (
    <section className="sticker-book-overlay">
      <div className="sticker-book-content">
        <div className="sticker-book-header">
          <h2>My Stickers</h2>
          <button type="button" onClick={onClose} className="squish">Close</button>
        </div>
        
        <h3 style={{marginTop: 0, color: 'var(--brand-dark)'}}>Older Reader ({annaLessons})</h3>
        <div className="sticker-grid" style={{marginBottom: '2rem'}}>
          {renderStickers(annaLessons, true).map((s, i) => (
            <div key={i} className={`sticker-slot ${s ? 'earned pulse' : ''}`}>
              {s}
            </div>
          ))}
        </div>

        <h3 style={{marginTop: 0, color: 'var(--brand-dark)'}}>Earliest Reader ({sarahLessons})</h3>
        <div className="sticker-grid" style={{marginBottom: '2rem'}}>
          {renderStickers(sarahLessons, false).map((s, i) => (
            <div key={i} className={`sticker-slot ${s ? 'earned pulse' : ''}`}>
              {s}
            </div>
          ))}
        </div>

        <h3 style={{marginTop: 0, color: 'var(--brand-dark)'}}>100 Lessons ({hundredLessons})</h3>
        <div className="sticker-grid">
          {renderHundredLessonStickers(hundredLessons).map((s, i) => (
            <div key={i} className={`sticker-slot ${s ? 'earned pulse' : ''}`}>
              {s}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function fireworksCelebration() {
  const duration = 5500
  const animationEnd = Date.now() + duration
  const defaults = { startVelocity: 36, spread: 360, ticks: 80, zIndex: 200 }
  const colors = ['#FFD600', '#FF6D00', '#00E676', '#00B0FF', '#FF4081', '#7C4DFF', '#FFFFFF']

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  // Opening burst from center
  confetti({ particleCount: 100, spread: 120, origin: { x: 0.5, y: 0.55 }, colors, zIndex: 200, startVelocity: 45 })

  const interval: ReturnType<typeof setInterval> = setInterval(function () {
    const timeLeft = animationEnd - Date.now()
    if (timeLeft <= 0) return clearInterval(interval)

    const particleCount = 80 * (timeLeft / duration)
    confetti({ ...defaults, particleCount, colors, origin: { x: randomInRange(0.1, 0.35), y: Math.random() - 0.1 } })
    confetti({ ...defaults, particleCount, colors, origin: { x: randomInRange(0.65, 0.9), y: Math.random() - 0.1 } })
  }, 220)
}
function buildOlderReaderPhonemeActivities(lessonCards: LearningCard[]): OlderReaderPhonemeActivity[] {
  const activities: OlderReaderPhonemeActivity[] = []
  
  // 1. Intros
  for (const card of lessonCards) {
    activities.push({ kind: 'intro', card })
  }
  
  // 2. Sound to spelling
  for (const card of lessonCards) {
    activities.push({ kind: 'soundToSpelling', card, options: buildOlderReaderPhonemeOptions(lessonCards, card, 'soundToSpelling') })
  }
  
  // 3. Spelling to sound (using example words)
  for (const card of lessonCards) {
    activities.push({ kind: 'spellingToSound', card, options: buildOlderReaderPhonemeOptions(lessonCards, card, 'spellingToSound') })
  }
  
  // 4. Example word
  for (const card of lessonCards) {
    activities.push({ kind: 'exampleWord', card, options: buildOlderReaderPhonemeOptions(lessonCards, card, 'exampleWord') })
  }
  
  // 5. Mixed Review
  for (const card of lessonCards) {
    activities.push({
      kind: 'mixedReview',
      card,
      options: buildOlderReaderPhonemeOptions(lessonCards, card, 'mixedReview'),
      reviewVariant: 'spellingPatternRecall',
    })
  }
  
  return activities
}

function buildOlderReaderPhonemeOptions(
  lessonCards: LearningCard[],
  card: LearningCard,
  kind: OlderReaderPhonemeActivityKind,
): LearningCard[] {
  const distractor = lessonCards
    .filter((candidate) => candidate.id !== card.id)
    .sort((a, b) => stableSort(`phoneme:${kind}:${card.id}:${a.id}`) - stableSort(`phoneme:${kind}:${card.id}:${b.id}`))[0]
  const options = distractor ? [card, distractor] : [card]
  return options.sort((a, b) => stableSort(`phoneme-order:${kind}:${card.id}:${a.id}`) - stableSort(`phoneme-order:${kind}:${card.id}:${b.id}`))
}

function OlderReaderPhonemeLesson({
  deck,
  lessonCards,
  activities,
  lessonNumber,
  activityIndex,
  onActivityChange,
  onNextLesson,
  onLessonComplete,
  onDone,
}: {
  deck: LearningDeck
  lessonCards: LearningCard[]
  activities: OlderReaderPhonemeActivity[]
  lessonNumber: number
  activityIndex: number
  onActivityChange: (index: number) => void
  onNextLesson: () => void
  onLessonComplete: () => void
  onDone: () => void
}) {
  const [status, setStatus] = useState<SarahActivityStatus>('idle')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const completionRecordedRef = useRef(false)
  
  const isComplete = activityIndex >= activities.length
  useEffect(() => {
    if (!isComplete || completionRecordedRef.current) return
    completionRecordedRef.current = true
    playSfx('fireworks')
    fireworksCelebration()
    onLessonComplete()
  }, [isComplete, onLessonComplete])

  if (isComplete) {
    return (
      <section className="lesson-complete">
        <div className="celebration-burst" aria-hidden="true" />
        <Mascot mood="happy" />
        <span className="prompt-topline">Lesson {lessonNumber}</span>
        <h1>You practiced 5 sounds!</h1>
        <div className="completion-cards" aria-label="Review cards">
          {lessonCards.map((c) => (
            <div key={c.id} className="completion-card" style={{padding: '0.5rem', background: 'var(--c-surface)', borderRadius: 'var(--radius)', border: '2px solid var(--c-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem'}}>
              <SpellingChip text={c.primarySpelling || c.displayText} />
              <small>{c.exampleWord}</small>
            </div>
          ))}
        </div>
        <div className="completion-actions">
          <button type="button" className="primary" onClick={onNextLesson}>Next Lesson</button>
          <button type="button" onClick={onDone}>Back to Phonemes</button>
      </div>
    </section>
  )
}

  const activity = activities[activityIndex]
  const card = activity.card
  const audioAsset = resolveAssetUrl(deck, card.audio)
  const exampleAudioAsset = resolveAssetUrl(deck, card.exampleAudio)
  const isIntro = activity.kind === 'intro'
  const options = activity.options || []

  useEffect(() => {
    if (isIntro) {
      void playNarrationClip(card.id, card.speechCue, audioAsset)
    }
  }, [isIntro, audioAsset, card.speechCue, card.id])

  function handleSelect(optionCard: LearningCard) {
    if (status !== 'idle' && status !== 'try-again') return
    setSelectedCardId(optionCard.id)
    if (optionCard.id === card.id) {
      setStatus('correct')
      playSfx('correct')
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 }, zIndex: 9999 })
      setTimeout(() => {
        onActivityChange(activityIndex + 1)
        setStatus('idle')
        setSelectedCardId(null)
      }, 1500)
    } else {
      setStatus('try-again')
    }
  }

  function renderChoices() {
    return (
      <div className="choices">
        {options.map((opt) => {
          const isSelected = selectedCardId === opt.id
          const isWrong = isSelected && status === 'try-again'
          const isCorrect = isSelected && status === 'correct'
          let content = null
          if (activity.kind === 'soundToSpelling' || activity.kind === 'mixedReview') {
            content = <SpellingChip text={opt.primarySpelling || opt.displayText} />
          } else if (activity.kind === 'spellingToSound') {
            content = <span style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{opt.exampleWord}</span>
          } else if (activity.kind === 'exampleWord') {
            content = <span style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{opt.exampleWord}</span>
          }
          
          return (
            <button
              key={opt.id}
              type="button"
              className={`choice-button squish ${isWrong ? 'wrong' : ''} ${isCorrect ? 'correct' : ''}`}
              onClick={() => handleSelect(opt)}
            >
              {content}
            </button>
          )
        })}
      </div>
    )
  }

  let prompt = ''
  if (activity.kind === 'soundToSpelling') prompt = 'Listen. Which spelling makes that sound?'
  else if (activity.kind === 'spellingToSound') prompt = 'What sound can this spelling make?'
  else if (activity.kind === 'exampleWord') prompt = 'Which word has this sound?'
  else if (activity.kind === 'mixedReview') prompt = 'Which spelling can make the sound in this word?'

  return (
    <div className={`active-activity ${status}`} style={{display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center'}}>
      {isIntro ? (
        <div className="intro-activity" style={{display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center'}}>
          <span className="prompt-topline">Listen</span>
          <div className="intro-card-large" style={{display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', background: 'var(--c-surface)', padding: '2rem', borderRadius: '1rem', border: '3px solid var(--c-brand)'}}>
             <button type="button" className="big-audio-button squish" style={{fontSize: '3rem', background: 'var(--c-brand)', color: 'white', border: 'none', borderRadius: '50%', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 0 rgba(0,0,0,0.1)'}} onClick={() => playNarrationClip(card.id, card.speechCue, audioAsset)}>
               Play
             </button>
             <SpellingChip text={card.primarySpelling || card.displayText} />
             <div className="intro-example">
               <button type="button" className="example-audio squish" style={{fontSize: '1.5rem', fontWeight: 'bold', padding: '0.75rem 1.5rem', borderRadius: '100px', border: '2px solid var(--c-border)', cursor: 'pointer', background: 'white'}} onClick={() => playNarrationClip(card.id + '-example', card.exampleWord, exampleAudioAsset)}>
                 Play {card.exampleWord}
               </button>
             </div>
          </div>
          <div className="intro-actions" style={{marginTop: '1rem'}}>
            <button type="button" className="primary" onClick={() => { setStatus('idle'); onActivityChange(activityIndex + 1); }}>Next</button>
          </div>
        </div>
      ) : (
        <div className="question-activity" style={{display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center'}}>
          <span className="prompt-topline">{prompt}</span>
          
          <div className="question-stimulus" style={{minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            {(activity.kind === 'soundToSpelling' || activity.kind === 'exampleWord') && (
              <button type="button" className="big-audio-button squish" style={{fontSize: '3rem', background: 'var(--c-brand)', color: 'white', border: 'none', borderRadius: '50%', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 0 rgba(0,0,0,0.1)'}} onClick={() => playNarrationClip(card.id, card.speechCue, audioAsset)}>
                Play
              </button>
            )}
            {activity.kind === 'spellingToSound' && (
              <SpellingChip text={card.primarySpelling || card.displayText} />
            )}
            {activity.kind === 'mixedReview' && (
              <button type="button" className="example-audio squish" style={{fontSize: '1.5rem', fontWeight: 'bold', padding: '0.75rem 1.5rem', borderRadius: '100px', border: '2px solid var(--c-border)', cursor: 'pointer', background: 'white'}} onClick={() => playNarrationClip(card.id + '-example', card.exampleWord, exampleAudioAsset)}>
                Play {card.exampleWord}
              </button>
            )}
          </div>
          
          {renderChoices()}
        </div>
      )}
      <Mascot mood={status === 'correct' ? 'happy' : status === 'try-again' ? 'curious' : 'curious'} />
    </div>
  )
}

function SpellingChip({ text }: { text: string }) {
  const parts = text.split('_')
  if (parts.length === 2) {
    return (
      <span className="spelling-chip split-chip" style={{fontSize: '4rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '2px', color: 'var(--c-brand-dark)', textShadow: '2px 2px 0 white'}}>
        {parts[0]}<span className="chip-blank" style={{color: 'var(--c-border)', opacity: 0.5}}>_</span>{parts[1]}
      </span>
    )
  }
  return <span className="spelling-chip" style={{fontSize: '4rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '2px', color: 'var(--c-brand-dark)', textShadow: '2px 2px 0 white'}}>{text}</span>
}

export default App
