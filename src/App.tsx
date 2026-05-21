import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { loadDeckLibrary, resolveAssetUrl } from './decks'
import { loadAnneStories, resolveStoryAssetUrl } from './stories'
import type { LearningCard, LearningDeck, LearningMode, ProfileId, Story, StoryPage } from './types'

type MascotMood = 'happy' | 'reading' | 'sad' | 'curious'
type LessonPhase = 'learn' | 'question'
type GrowingReaderView = 'home' | 'words' | 'stories'
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

interface SarahActivity {
  kind: SarahActivityKind
  card: LearningCard
  options?: LearningCard[]
  textOptions?: string[]
  correctText?: string
  promptCase?: 'upper' | 'lower'
  reviewVariant?: SarahQuestionKind
}

const LESSON_SIZE = 5
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SARAH_FINAL_REVIEW_SIZE = 6
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

function shouldIgnoreControllerKey(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat) return true
  const target = event.target
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function choiceKeyLabel(index: number) {
  return index === 0 ? 'A' : index === 1 ? 'B' : String(index + 1)
}

function App() {
  const [decks, setDecks] = useState<LearningDeck[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [profile, setProfile] = useState<ProfileId | null>(null)
  const [growingView, setGrowingView] = useState<GrowingReaderView>('home')
  const [activeDeckId, setActiveDeckId] = useState('')
  const [mode, setMode] = useState<LearningMode>('listeningMode')
  const [cardIndex, setCardIndex] = useState(0)
  const [phase, setPhase] = useState<LessonPhase>('learn')
  const [sarahActivityIndex, setSarahActivityIndex] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAdultDetails, setShowAdultDetails] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const nextDecks = await loadDeckLibrary()
        const nextStories = await loadAnneStories().catch(() => [])
        if (cancelled) return
        const params = new URLSearchParams(window.location.search)
        const initialProfile = params.get('profile') as ProfileId | null
        const initialMode = params.get('mode') as LearningMode | null
        const wantsStories = params.get('stories') === 'true'
        const profileDeck =
          initialProfile && ['anna', 'sarah', 'library'].includes(initialProfile)
            ? nextDecks.find((deck) => deck.profile === initialProfile) ?? nextDecks[0]
            : nextDecks[0]
        setDecks(nextDecks)
        setStories(nextStories)
        setProfile(initialProfile && ['anna', 'sarah', 'library'].includes(initialProfile) ? initialProfile : null)
        setGrowingView(initialProfile === 'anna' ? (wantsStories ? 'stories' : 'home') : 'home')
        setActiveDeckId(profileDeck?.id ?? '')
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
  const activeDeck = useMemo(
    () => visibleDecks.find((deck) => deck.id === activeDeckId) ?? visibleDecks[0],
    [activeDeckId, visibleDecks],
  )
  const currentCard = activeDeck?.cards[cardIndex % Math.max(1, activeDeck.cards.length)]
  const isLessonActive = Boolean(profile && activeDeck && currentCard)

  function chooseProfile(nextProfile: ProfileId) {
    const firstDeck = decks.find((deck) => deck.profile === nextProfile) ?? decks[0]
    setProfile(nextProfile)
    setGrowingView('home')
    setActiveDeckId(firstDeck?.id ?? '')
    setMode('listeningMode')
    setCardIndex(0)
    setPhase('learn')
    setSarahActivityIndex(0)
    setMenuOpen(false)
  }

  function openGrowingWords() {
    const firstDeck = decks.find((deck) => deck.profile === 'anna') ?? decks[0]
    setGrowingView('words')
    setActiveDeckId(firstDeck?.id ?? '')
    setCardIndex(0)
    setPhase('learn')
    setSarahActivityIndex(0)
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
    const orderedCards = orderCardsForMode(activeDeck, mode)
    const lessonStart = lessonStartForIndex(cardIndex, orderedCards.length)
    const lessonCards = orderedCards.slice(lessonStart, lessonStart + LESSON_SIZE)
    if (mode === 'listeningMode') markCardsListened(activeDeck.id, lessonCards)
    setCardIndex((lessonStart + LESSON_SIZE) % orderedCards.length)
    setPhase(mode === 'listeningMode' ? 'learn' : 'question')
    setSarahActivityIndex(0)
    setMenuOpen(false)
  }

  function finishCurrentPath() {
    if (profile === 'anna') {
      setGrowingView('home')
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
    setCardIndex(sarahLetterLessonStartForNumber(nextLesson, activeDeck.cards.length))
    setPhase('learn')
    setSarahActivityIndex(0)
  }

  function restartLesson() {
    setCardIndex((index) => {
      const lessonStart = activeDeck?.profile === 'sarah' && activeDeck?.type === 'letters'
        ? sarahLetterLessonStartForIndex(index, activeDeck.cards.length)
        : lessonStartForIndex(index, activeDeck?.cards.length ?? 0)
      return lessonStart
    })
    setPhase('learn')
    setSarahActivityIndex(0)
    setMenuOpen(false)
  }

  return (
    <main className={`app-shell ${isLessonActive ? 'lesson-active' : ''}`}>
      <header className="topbar">
        <button
          className="brand-button"
          type="button"
          onClick={() => {
            setProfile(null)
            setGrowingView('home')
            setMenuOpen(false)
          }}
        >
          <Mascot size="small" mood="reading" />
          <span>
            <strong>Chunky Reader</strong>
            <small>{activeDeck ? activeDeck.title : 'Ready to read?'}</small>
          </span>
        </button>
      </header>

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
      ) : !profile ? (
        <HomeScreen onChoose={chooseProfile} decks={decks} />
      ) : profile === 'anna' && growingView === 'home' ? (
        <GrowingReaderHome
          decks={visibleDecks}
          stories={stories}
          onWords={openGrowingWords}
          onStories={() => setGrowingView('stories')}
        />
      ) : profile === 'anna' && growingView === 'stories' ? (
        <StorySection stories={stories} onBack={() => setGrowingView('home')} />
      ) : activeDeck && currentCard ? (
        <LearningScreen
          decks={visibleDecks}
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
          onBackToPath={profile === 'anna' ? () => setGrowingView('home') : undefined}
          onRestartLesson={restartLesson}
          onModeChange={changeMode}
          onNextLesson={moveNextLessonFromCurrent}
          onDone={finishCurrentPath}
          onGoHome={() => {
            setProfile(null)
            setGrowingView('home')
            setMenuOpen(false)
          }}
          onToggleAdultDetails={() => setShowAdultDetails((v) => !v)}
        />
      ) : (
        <section className="empty-screen">
          <Mascot mood="curious" />
          <h1>No cards yet</h1>
          <p>Add cards to this deck and Chunky Reader will pick them up.</p>
        </section>
      )}
    </main>
  )
}

function HomeScreen({
  onChoose,
  decks,
}: {
  onChoose: (profile: ProfileId) => void
  decks: LearningDeck[]
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
          <strong>Growing Reader</strong>
          <small>{annaCount} reading cards</small>
        </button>
        <button type="button" className="path-card sarah-path" onClick={() => onChoose('sarah')}>
          <img className="profile-image" src={`${import.meta.env.BASE_URL}assets/profiles/sarah-reading.png`} alt="" />
          <span className="path-badge">Sounds</span>
          <strong>Earliest Reader</strong>
          <small>{sarahCount} letter and sound cards</small>
        </button>
      </div>
      <div className="daily-cloud" aria-label="Daily goal">
        <span className="star-badge" aria-hidden="true">★</span>
        <strong>Daily Goal</strong>
        <span>15 / 20 min</span>
        <div className="daily-progress"><span /></div>
      </div>
    </section>
  )
}

function GrowingReaderHome({
  decks,
  stories,
  onWords,
  onStories,
}: {
  decks: LearningDeck[]
  stories: Story[]
  onWords: () => void
  onStories: () => void
}) {
  const wordCount = decks.reduce((sum, deck) => sum + deck.cards.length, 0)
  const pageCount = stories.reduce((sum, story) => sum + story.pages.length, 0)

  return (
    <section className="growing-reader-home">
      <div className="reader-hero">
        <img className="reader-hero-child" src={`${import.meta.env.BASE_URL}assets/profiles/anna-red-shirt.png`} alt="" />
        <div>
          <ChunkyLogo compact />
          <h1>Growing Reader</h1>
          <p>Choose one happy reading pocket.</p>
        </div>
        <Mascot mood="reading" />
      </div>
      <div className="reader-choice-grid" aria-label="Choose a Growing Reader activity">
        <button type="button" className="reader-choice word-choice" onClick={onWords}>
          <span className="choice-sticker" aria-hidden="true">ABC</span>
          <strong>Read Words</strong>
          <small>{wordCount} picture words</small>
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

function StorySection({ stories, onBack }: { stories: Story[]; onBack: () => void }) {
  const [selectedStoryId, setSelectedStoryId] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [complete, setComplete] = useState(false)
  const selectedStory = stories.find((story) => story.id === selectedStoryId)

  function openStory(story: Story) {
    setSelectedStoryId(story.id)
    setPageIndex(readStoryProgress(story.id, story.pages.length))
    setComplete(false)
  }

  function restartStory(story: Story) {
    saveStoryProgress(story.id, 0)
    setPageIndex(0)
    setComplete(false)
  }

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
        }}
        onComplete={() => {
          setComplete(true)
          saveStoryProgress(selectedStory.id, selectedStory.pages.length - 1)
        }}
      />
    )
  }

  return (
    <section className="story-library">
      <div className="story-library-header">
        <button type="button" className="soft-back" onClick={onBack}>Back</button>
        <div>
          <span className="prompt-topline">Growing Reader</span>
          <h1>Read a Story</h1>
          <p>Pick one tiny story. Each one has three gentle pages.</p>
        </div>
        <Mascot mood="happy" />
      </div>

      {stories.length === 0 ? (
        <section className="empty-screen story-empty">
          <Mascot mood="curious" />
          <h2>Stories are coming soon</h2>
          <p>Add stories to <strong>public/stories/anne-stories.json</strong>.</p>
        </section>
      ) : (
        <div className="story-grid" aria-label="Anne story library">
          {stories.map((story, index) => {
            const cover = story.coverImage || story.pages[0]?.image
            return (
              <button key={story.id} type="button" className="story-card" onClick={() => openStory(story)}>
                <AssetImage
                  src={resolveStoryAssetUrl(cover)}
                  label={story.pages[0]?.altText || story.title}
                  className="story-cover"
                  fallback={<StoryImageFallback title={story.title} pageNumber={1} />}
                />
                <span className="story-number">Story {index + 1}</span>
                <strong>{story.title}</strong>
                <small>{story.description}</small>
                <span className="story-meta">{story.pages.length} pages - {story.readingLevel}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
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
      if (event.key === '3') {
        event.preventDefault()
        nextPage()
      }
      if (event.key === '4') {
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
          <button type="button" className="sound-button read-to-me" onClick={() => speakPlainText(page.text)}>
            <PlayIcon /> Read to Me
          </button>
        </div>
      </article>
      <div className="story-nav">
        <button type="button" disabled={pageIndex === 0} onClick={previousPage}>
          Back
        </button>
        <button type="button" className="primary" onClick={nextPage}>
          {pageIndex >= story.pages.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </section>
  )
}

function StoryPageImage({ page, story }: { page: StoryPage; story: Story }) {
  return (
    <AssetImage
      src={resolveStoryAssetUrl(page.image)}
      label={page.altText || `${story.title} page ${page.pageNumber}`}
      className="story-page-image"
      fallback={<StoryImageFallback title={story.title} pageNumber={page.pageNumber} />}
    />
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
  onNextLesson,
  onDone,
  onGoHome,
  onToggleAdultDetails,
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
  onNextLesson: () => void
  onDone: () => void
  onGoHome: () => void
  onToggleAdultDetails: () => void
}) {
  const isSarahLetters = activeDeck.profile === 'sarah' && activeDeck.type === 'letters'
  const lessonDeckCards = isSarahLetters ? activeDeck.cards : orderCardsForMode(activeDeck, mode)
  const activeCard = lessonDeckCards[cardIndex % Math.max(1, lessonDeckCards.length)] ?? card
  const lessonStart = isSarahLetters
    ? sarahLetterLessonStartForIndex(cardIndex, lessonDeckCards.length)
    : lessonStartForIndex(cardIndex, lessonDeckCards.length)
  const lessonLength = isSarahLetters ? sarahLetterLessonSizeForStart(lessonStart, lessonDeckCards.length) : LESSON_SIZE
  const lessonCards = lessonDeckCards.slice(lessonStart, lessonStart + lessonLength)
  const lessonIndex = cardIndex - lessonStart
  const sarahActivities = useMemo(
    () => (isSarahLetters ? buildSarahActivities(lessonCards) : []),
    [isSarahLetters, lessonCards],
  )
  const progress = isSarahLetters ? Math.min(sarahActivityIndex + 1, sarahActivities.length) : lessonIndex + 1
  const progressTotal = isSarahLetters ? sarahActivities.length : lessonCards.length
  const lessonNumber = isSarahLetters
    ? sarahLetterLessonNumberForIndex(cardIndex, lessonDeckCards.length)
    : lessonNumberForIndex(cardIndex, lessonDeckCards.length)

  return (
    <section className="learning-screen lesson-focus">
      <LessonMenu
        isOpen={menuOpen}
        onToggle={onMenuToggle}
        decks={decks}
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
          showAdultDetails={showAdultDetails}
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
    </section>
  )
}

function LessonMenu({
  isOpen,
  onToggle,
  decks,
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
  activeDeckId: string
  onDeckChange: (deckId: string) => void
  onRestartLesson: () => void
  onGoHome: () => void
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
        ☰
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
              ✕
            </button>
          </div>
          <div className="lesson-menu-content">
            {onBackToPath && (
              <button type="button" className="menu-item" onClick={onBackToPath}>
                ← Back to Growing Reader
              </button>
            )}
            <button type="button" className="menu-item" onClick={onRestartLesson}>
              ↻ Restart Lesson
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
                    {deck.id === activeDeckId && ' ✓'}
                  </button>
                ))}
              </div>
            )}
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
              <button
                type="button"
                className={`menu-item ${mode === 'readerMode' ? 'active' : ''}`}
                onClick={() => onModeChange('readerMode')}
              >
                Flash Cards
              </button>
            </div>
            <div className="menu-section">
              <strong>Options</strong>
              <button type="button" className="menu-item" onClick={onToggleAdultDetails}>
                {showAdultDetails ? '✓ ' : ''}Adult Details
              </button>
            </div>
            <button type="button" className="menu-item menu-home" onClick={onGoHome}>
              ⌂ Home
            </button>
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
}: {
  lessonNumber: number
  progress: number
  total: number
  onMenuToggle: () => void
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
        ☰
      </button>
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
  showAdultDetails,
}: {
  deck: LearningDeck
  lessonCards: LearningCard[]
  lessonNumber: number
  activityIndex: number
  onActivityChange: (index: number) => void
  onLessonChange: (deltaLessons: number) => void
  showAdultDetails: boolean
}) {
  const activities = useMemo(() => buildSarahActivities(lessonCards), [lessonCards])
  const activity = activities[Math.min(activityIndex, Math.max(0, activities.length - 1))]
  const completed = activityIndex >= activities.length
  const [status, setStatus] = useState<SarahActivityStatus>('idle')
  const [wrongChoice, setWrongChoice] = useState('')
  const [tries, setTries] = useState(0)

  useAutoplaySarahActivity(deck, completed ? undefined : activity, `${deck.id}:${lessonNumber}:${activityIndex}`)

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
      void playSarahActivityAudio(deck, activity)
      window.setTimeout(nextActivity, 850)
      return
    }
    setWrongChoice(answer)
    if (tries === 0) {
      setTries(1)
      setStatus('try-again')
      return
    }
    setStatus('revealed')
    void playSarahActivityAudio(deck, activity)
    window.setTimeout(nextActivity, 1450)
  }

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
    status === 'correct' ? 'happy' : status === 'try-again' || status === 'revealed' ? 'sad' : isIntro ? 'reading' : 'curious'
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
        <h2>This is {activity.card.displayText}.</h2>
      </div>
      <div className="focus-visual">
        <div className="letter-display">
          <strong>{activity.card.displayText}</strong>
          {showAdultDetails && <span className="phonetic-detail">{activity.card.sound}</span>}
        </div>
        <Picture deck={deck} card={activity.card} />
        <span className="example-word">{activity.card.exampleWord}</span>
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
      void playSpecificCardAudio(deck, activity.card, activity.card.letterNameAudio, activity.card.displayText)
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
      if (event.key === '3') {
        event.preventDefault()
        chooseByIndex(0)
      }
      if (event.key === '4') {
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
            <h2>Which letter makes this sound?</h2>
            <AudioPromptButton onClick={handleAudioClick} label="Tap to hear" />
            {showAdultDetails && <span className="phonetic-detail">{activity.card.sound}</span>}
          </>
        )}
        {questionKind === 'letterToSound' && (
          <>
            <span className="stage-label">Say the sound</span>
            <h2>What sound does this letter make?</h2>
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
            <h2>This word starts with which sound?</h2>
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
            <h2>This word starts with which sound?</h2>
            <div className="focus-visual compact">
              <Picture deck={deck} card={activity.card} />
              <span className="example-word">{activity.card.exampleWord}</span>
            </div>
          </>
        )}
        {questionKind === 'soundToWord' && (
          <>
            <span className="stage-label">Find the word</span>
            <h2>Which word starts with this sound?</h2>
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
              className={`focus-option ${choiceState(option, correctAnswer, wrongChoice, status)}`}
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
                className={`focus-option ${showPictureOption ? 'picture-choice' : ''} ${choiceState(answer, correctAnswer, wrongChoice, status)}`}
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
          <div className="focus-prompt">
            <span className="stage-label">Listen and learn</span>
            <h2>{card.type === 'word' ? 'This word is...' : 'This letter is...'}</h2>
          </div>
          <div className="focus-visual">
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
          </div>
          <div className="focus-actions">
            <AudioPromptButton onClick={() => playCardAudio(deck, card)} label="Listen" />
            <button type="button" className="primary" onClick={onNext}>Next</button>
            <button type="button" className="secondary-action full-row" onClick={onNextLesson}>Next Lesson</button>
          </div>
        </div>
      </div>
      <div className="focus-feedback">
        <Mascot mood={mood} size="small" />
        <div className="feedback-text">
          <strong>{card.type === 'word' ? 'Read it!' : 'Say it!'}</strong>
          <span>Tap the button to hear</span>
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

  return (
    <section className="focus-lesson">
      <div className="focus-main">
        <div className="focus-intro flashcard-section">
          <div className="focus-prompt">
            <span className="stage-label">Flash Cards</span>
            <h2>How did it feel?</h2>
          </div>
          <div className="flashcard-card">
            {card.type === 'word' ? <Picture deck={deck} card={card} /> : <div className="sentence-card"><p>{card.displayText}</p></div>}
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
  useAutoplayCard(deck, card, `question:${deck.id}:${card.id}`)
  const options = useMemo(() => buildOptions(lessonCards, card), [card, lessonCards])
  const correct = selected === card.id
  const mood: MascotMood = selected ? (correct ? 'happy' : 'sad') : 'curious'

  function choose(cardId: string) {
    setSelected(cardId)
    if (cardId === card.id) {
      markCardRecalled(deck.id, card.id)
      void playCardAudio(deck, card)
      window.setTimeout(onNext, 900)
    }
  }

  return (
    <section className="focus-lesson">
      <div className="focus-main">
        <div className="focus-question">
          <div className="focus-prompt">
            <span className="stage-label">{mode === 'readerMode' ? 'Quiz' : 'Practice'}</span>
            <h2>{getChoicePrompt(deck, card, mode)}</h2>
            {deck.type === 'letters' && mode === 'activeRecall' && (
              <div className="prompt-cue">
                <AudioPromptButton onClick={() => playCardAudio(deck, card)} label="Hear it" />
              </div>
            )}
          </div>
          <div className="focus-options" aria-label="Answer choices">
            {options.map((option) => {
              const state =
                selected && option.id === card.id
                  ? 'correct'
                  : selected === option.id
                    ? 'wrong'
                    : ''
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`focus-option ${state}`}
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
      <div className={`focus-feedback ${selected ? (correct ? 'happy' : 'try') : ''}`}>
        <Mascot mood={mood} size="small" />
        <div className="feedback-text">
          {selected ? (
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
    <span className={`panda-fallback ${size}`} aria-label="Chunky Reader panda mascot">
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
      aria-label={`Chunky Reader panda mascot feeling ${mood}`}
      style={{ backgroundImage: `url(${src})` }}
    />
  )
}

function ChunkyLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`chunky-logo ${compact ? 'compact' : ''}`} aria-label="Chunky Reader">
      <span>Chunky</span>
      <strong>Reading</strong>
    </div>
  )
}

function PlayIcon() {
  return <span className="play-icon" aria-hidden="true" />
}

let activeAudio: HTMLAudioElement | null = null

function useAutoplayCard(deck: LearningDeck, card: LearningCard, key: string) {
  const lastKey = useRef('')

  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
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

  const text = card.speechCue || card.exampleWord || card.word || card.displayText
  speakText(deck, text)
}

function playAudioUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (activeAudio) {
      activeAudio.pause()
      activeAudio.currentTime = 0
    }
    const audio = new Audio(url)
    activeAudio = audio
    audio.addEventListener('ended', () => {
      if (activeAudio === audio) activeAudio = null
      resolve()
    }, { once: true })
    audio.addEventListener('error', () => {
      if (activeAudio === audio) activeAudio = null
      reject(new Error('Audio failed'))
    }, { once: true })
    audio.play().catch(reject)
  })
}

function buildOptions(cards: LearningCard[], card: LearningCard): LearningCard[] {
  const seed = card.id
  const distractors = cards
    .filter((candidate) => candidate.id !== card.id)
    .sort((a, b) => stableSort(`${seed}:${a.id}`) - stableSort(`${seed}:${b.id}`))
    .slice(0, 1)
  return [card, ...distractors].sort(
    (a, b) => stableSort(`order:${seed}:${a.id}`) - stableSort(`order:${seed}:${b.id}`),
  )
}

function optionLabel(card: LearningCard): string {
  return card.word || card.displayText || card.grapheme || card.exampleWord || ''
}

function optionSmallLabel(card: LearningCard): string {
  if (card.type === 'phoneme') return card.exampleWord || ''
  if (card.type === 'letter') return card.exampleWord || ''
  if (card.type === 'sentence') return card.meaning || ''
  return card.category || ''
}

function getChoicePrompt(deck: LearningDeck, card: LearningCard, mode: LearningMode): string {
  if (card.type === 'sentence') return mode === 'readerMode' ? 'Read this sentence.' : 'Find this sentence.'
  if (deck.type === 'reading-words') return mode === 'readerMode' ? 'What word matches the picture?' : 'Find this word.'
  if (deck.type === 'letters') return mode === 'readerMode' ? 'Which letter makes this sound?' : 'Tap the matching letter.'
  if (card.grapheme) return mode === 'readerMode' ? 'Which spelling matches this sound?' : 'Tap the matching sound.'
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
  const beginningSound = lessonCards.map((card): SarahActivity => ({
    kind: 'beginningSound',
    card,
    options: buildSarahOptions(lessonCards, card),
  }))
  const review = lessonCards.map((card, index): SarahActivity => buildSarahReviewActivity(lessonCards, card, index))
  return [...intros, ...wordToBeginningSound, ...soundToWord, ...upperLower, ...beginningSound, ...review]
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
    return { title: 'Listen with Chunky!', detail: `${activity.card.displayText} as in ${activity.card.exampleWord}.` }
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
  if ((status === 'correct' || status === 'revealed') && answer === correctAnswer) return 'correct'
  if (wrongChoice === answer && (status === 'try-again' || status === 'revealed')) return 'wrong'
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
    await playSpecificCardAudio(deck, activity.card, activity.card.letterNameAudio, activity.card.displayText)
    return
  }
  await playCardAudio(deck, activity.card)
}

async function playSpecificCardAudio(deck: LearningDeck, card: LearningCard, audioPath?: string, fallbackText?: string) {
  const audioUrl = resolveAssetUrl(deck, audioPath)
  if (audioUrl) {
    try {
      await playAudioUrl(audioUrl)
      return
    } catch {
      // Browser speech will cover missing optional audio.
    }
  }
  speakText(deck, fallbackText || card.speechCue || card.displayText)
}

function speakText(deck: LearningDeck, text?: string) {
  if (!text || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.replaceAll('/', ''))
  utterance.lang = deck.language || 'en-US'
  utterance.rate = deck.profile === 'sarah' ? 0.72 : 0.86
  window.speechSynthesis.speak(utterance)
}

function speakPlainText(text?: string) {
  if (!text || !('speechSynthesis' in window)) return
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.currentTime = 0
    activeAudio = null
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/gu, ' ').trim())
  utterance.lang = 'en-US'
  utterance.rate = 0.82
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
  } catch {
    // Reading should never depend on storage support.
  }
}

function storyProgressKey(storyId: string): string {
  return `chunky-reader:story:${storyId}:page`
}

function orderCardsForMode(deck: LearningDeck, mode: LearningMode): LearningCard[] {
  if (deck.profile !== 'anna') return deck.cards
  const now = Date.now()
  return deck.cards
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
  } catch {
    // Review scheduling is helpful, but the lesson must keep working without storage.
  }
}

function cardProgressKey(deckId: string, cardId: string): string {
  return `chunky-reader:card-progress:${deckId}:${cardId}`
}

function lessonStartForIndex(index: number, totalCards: number): number {
  const lastFullStart = Math.max(0, totalCards - LESSON_SIZE)
  return Math.min(Math.floor(index / LESSON_SIZE) * LESSON_SIZE, lastFullStart)
}

function lessonNumberForIndex(index: number, totalCards: number): number {
  const totalLessons = Math.max(1, Math.ceil(totalCards / LESSON_SIZE))
  const lastFullStart = Math.max(0, totalCards - LESSON_SIZE)
  if (index >= lastFullStart && index % LESSON_SIZE !== 0) return totalLessons
  return Math.min(totalLessons, Math.floor(index / LESSON_SIZE) + 1)
}

function sarahLetterLessonCount(totalCards: number): number {
  if (totalCards <= LESSON_SIZE) return 1
  if (totalCards <= LESSON_SIZE + SARAH_FINAL_REVIEW_SIZE) return Math.ceil(totalCards / LESSON_SIZE)
  return Math.ceil((totalCards - SARAH_FINAL_REVIEW_SIZE) / LESSON_SIZE) + 1
}

function sarahFinalLessonStart(totalCards: number): number {
  return Math.max(0, totalCards - SARAH_FINAL_REVIEW_SIZE)
}

function sarahLetterLessonStartForIndex(index: number, totalCards: number): number {
  const finalStart = sarahFinalLessonStart(totalCards)
  if (index >= finalStart) return finalStart
  return Math.floor(index / LESSON_SIZE) * LESSON_SIZE
}

function sarahLetterLessonStartForNumber(lessonIndex: number, totalCards: number): number {
  const finalLessonIndex = sarahLetterLessonCount(totalCards) - 1
  if (lessonIndex >= finalLessonIndex) return sarahFinalLessonStart(totalCards)
  return lessonIndex * LESSON_SIZE
}

function sarahLetterLessonNumberForIndex(index: number, totalCards: number): number {
  const finalStart = sarahFinalLessonStart(totalCards)
  if (index >= finalStart) return sarahLetterLessonCount(totalCards)
  return Math.floor(index / LESSON_SIZE) + 1
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

export default App
