import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { loadDeckLibrary, resolveAssetUrl } from './decks'
import { loadAnneStories, resolveStoryAssetUrl } from './stories'
import type { LearningCard, LearningDeck, LearningMode, ProfileId, Story, StoryPage } from './types'

type MascotMood = 'happy' | 'reading' | 'sad' | 'curious'
type LessonPhase = 'learn' | 'question'
type GrowingReaderView = 'home' | 'words' | 'stories'
type SarahQuestionKind = 'soundToLetter' | 'letterToSound' | 'upperLowerMatch' | 'beginningSound'
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
const SARAH_FINAL_REVIEW_SIZE = 6
const SARAH_REVIEW_VARIANTS: SarahQuestionKind[] = [
  'letterToSound',
  'soundToLetter',
  'upperLowerMatch',
  'beginningSound',
  'letterToSound',
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

  function chooseProfile(nextProfile: ProfileId) {
    const firstDeck = decks.find((deck) => deck.profile === nextProfile) ?? decks[0]
    setProfile(nextProfile)
    setGrowingView('home')
    setActiveDeckId(firstDeck?.id ?? '')
    setMode('listeningMode')
    setCardIndex(0)
    setPhase('learn')
    setSarahActivityIndex(0)
  }

  function openGrowingWords() {
    const firstDeck = decks.find((deck) => deck.profile === 'anna') ?? decks[0]
    setGrowingView('words')
    setActiveDeckId(firstDeck?.id ?? '')
    setCardIndex(0)
    setPhase('learn')
    setSarahActivityIndex(0)
  }

  function moveCard(delta = 1) {
    if (!activeDeck?.cards.length) return
    setCardIndex((index) => (index + delta + activeDeck.cards.length) % activeDeck.cards.length)
    setPhase('learn')
    setSarahActivityIndex(0)
  }

  function moveWithinLesson() {
    if (!activeDeck?.cards.length) return
    if (phase === 'learn') {
      setPhase('question')
      return
    }
    moveCard(1)
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand-button"
          type="button"
          onClick={() => {
            setProfile(null)
            setGrowingView('home')
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
          onDeckChange={(deckId) => {
            setActiveDeckId(deckId)
            setCardIndex(0)
            setPhase('learn')
            setSarahActivityIndex(0)
          }}
          onNext={moveWithinLesson}
          onSarahActivityChange={setSarahActivityIndex}
          onSarahLessonChange={moveSarahLesson}
          onBackToPath={profile === 'anna' ? () => setGrowingView('home') : undefined}
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

  function nextPage() {
    if (pageIndex >= story.pages.length - 1) {
      onComplete()
      return
    }
    onPageIndexChange(pageIndex + 1)
  }

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
        <button type="button" disabled={pageIndex === 0} onClick={() => onPageIndexChange(Math.max(0, pageIndex - 1))}>
          Previous Page
        </button>
        <button type="button" className="primary" onClick={nextPage}>
          {pageIndex >= story.pages.length - 1 ? 'Finish Story' : 'Next Page'}
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
  onDeckChange,
  onNext,
  onSarahActivityChange,
  onSarahLessonChange,
  onBackToPath,
}: {
  decks: LearningDeck[]
  activeDeck: LearningDeck
  activeDeckId: string
  card: LearningCard
  cardIndex: number
  mode: LearningMode
  phase: LessonPhase
  sarahActivityIndex: number
  onDeckChange: (deckId: string) => void
  onNext: () => void
  onSarahActivityChange: (index: number) => void
  onSarahLessonChange: (deltaLessons: number) => void
  onBackToPath?: () => void
}) {
  const isSarahLetters = activeDeck.profile === 'sarah' && activeDeck.type === 'letters'
  const lessonStart = isSarahLetters
    ? sarahLetterLessonStartForIndex(cardIndex, activeDeck.cards.length)
    : lessonStartForIndex(cardIndex, activeDeck.cards.length)
  const lessonLength = isSarahLetters ? sarahLetterLessonSizeForStart(lessonStart, activeDeck.cards.length) : LESSON_SIZE
  const lessonCards = activeDeck.cards.slice(lessonStart, lessonStart + lessonLength)
  const lessonIndex = cardIndex - lessonStart
  const sarahActivities = useMemo(
    () => (isSarahLetters ? buildSarahActivities(lessonCards) : []),
    [isSarahLetters, lessonCards],
  )
  const progress = isSarahLetters ? Math.min(sarahActivityIndex + 1, sarahActivities.length) : lessonIndex + 1
  const progressTotal = isSarahLetters ? sarahActivities.length : lessonCards.length
  const lessonNumber = isSarahLetters
    ? sarahLetterLessonNumberForIndex(cardIndex, activeDeck.cards.length)
    : lessonNumberForIndex(cardIndex, activeDeck.cards.length)
  const progressLabel = isSarahLetters
    ? sarahActivityIndex < lessonCards.length
      ? `Sound ${Math.min(sarahActivityIndex + 1, lessonCards.length)} of ${lessonCards.length}`
      : `Practice ${Math.min(sarahActivityIndex + 1, sarahActivities.length)} of ${sarahActivities.length}`
    : `${progress} / ${lessonCards.length}`
  return (
    <section className="learning-screen">
      <div className="play-header">
        <button type="button" className="round-icon" aria-label="Open menu">☰</button>
        <ChunkyLogo compact />
        <div className="star-counter" aria-label="Stars earned">
          <span>★</span>
          <strong>{Math.min(999, progress + 127)}</strong>
        </div>
      </div>
      <div className="screen-heading">
        <div>
          <h1>{activeDeck.profile === 'anna' ? 'Growing Reader Words' : activeDeck.level === 1 ? 'Earliest Reader Letters' : 'Reading Sounds'}</h1>
          <p>{activeDeck.description}</p>
        </div>
        <div className="deck-meta">
          <strong>{activeDeck.cards.length}</strong>
          <span>cards</span>
        </div>
      </div>
      {onBackToPath && <button type="button" className="soft-back learning-back" onClick={onBackToPath}>Back to Growing Reader</button>}
      <div className="lesson-progress" aria-label="Lesson progress">
        <span>★ Lesson {lessonNumber}</span>
        <div><span style={{ width: `${Math.max(6, (progress / Math.max(1, progressTotal)) * 100)}%` }} /></div>
        <strong>{progressLabel}</strong>
      </div>

      {decks.length > 1 && (
        <div className="deck-tabs" aria-label="Choose deck">
          {decks.map((deck) => (
            <button
              key={deck.id}
              className={deck.id === activeDeckId ? 'active' : ''}
              type="button"
              onClick={() => onDeckChange(deck.id)}
            >
              {deck.level ? `Level ${deck.level}` : deck.title}
            </button>
          ))}
        </div>
      )}

      {isSarahLetters ? (
        <SarahLetterLesson
          key={`${activeDeck.id}:${lessonNumber}:${sarahActivityIndex}`}
          deck={activeDeck}
          lessonCards={lessonCards}
          lessonNumber={lessonNumber}
          activityIndex={sarahActivityIndex}
          onActivityChange={onSarahActivityChange}
          onLessonChange={onSarahLessonChange}
        />
      ) : phase === 'learn' ? (
        <ExploreMode
          deck={activeDeck}
          card={card}
          cardIndex={lessonIndex}
          total={lessonCards.length}
          onNext={onNext}
        />
      ) : (
        <ChoiceMode
          key={`${activeDeck.id}:${mode}:${phase}:${card.id}`}
          deck={activeDeck}
          lessonCards={lessonCards}
          card={card}
          cardIndex={lessonIndex}
          mode={mode}
          onNext={onNext}
        />
      )}
    </section>
  )
}

function SarahLetterLesson({
  deck,
  lessonCards,
  lessonNumber,
  activityIndex,
  onActivityChange,
  onLessonChange,
}: {
  deck: LearningDeck
  lessonCards: LearningCard[]
  lessonNumber: number
  activityIndex: number
  onActivityChange: (index: number) => void
  onLessonChange: (deltaLessons: number) => void
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
      <section className="sarah-complete">
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
    <section className={`sarah-lesson ${isIntro ? 'intro' : 'question'} ${status}`}>
      <article className="sarah-stage">
        <div className="sarah-card-top">
          <span className="prompt-topline">{getSarahStageLabel(activity, activityIndex)}</span>
          <button type="button" className="sound-button compact" onClick={() => playSarahActivityAudio(deck, activity)}>
            <PlayIcon /> Listen
          </button>
        </div>
        <h2>{getSarahPrompt(activity)}</h2>
        <SarahActivityVisual deck={deck} activity={activity} />
      </article>

      <aside className="sarah-helper">
        <Mascot mood={mood} />
        <div>
          <strong>{feedback.title}</strong>
          <span>{feedback.detail}</span>
        </div>
      </aside>

      {isIntro ? (
        <div className="sarah-intro-actions">
          <button type="button" className="secondary-listen" onClick={() => playSarahActivityAudio(deck, activity)}>
            <PlayIcon /> Listen again
          </button>
          <button type="button" className="primary" onClick={nextActivity}>Next</button>
        </div>
      ) : (
        <SarahAnswerChoices
          activity={activity}
          status={status}
          wrongChoice={wrongChoice}
          onChoose={choose}
        />
      )}
    </section>
  )
}

function SarahActivityVisual({ deck, activity }: { deck: LearningDeck; activity: SarahActivity }) {
  const questionKind = getSarahQuestionKind(activity)
  if (activity.kind === 'intro') {
    return (
      <div className="sarah-intro-visual">
        <div className="letter-orb">
          <strong>{activity.card.displayText}</strong>
          <span>{activity.card.sound}</span>
        </div>
        <Picture deck={deck} card={activity.card} />
        <strong className="example-word">{activity.card.exampleWord}</strong>
      </div>
    )
  }

  if (questionKind === 'beginningSound') {
    return (
      <div className="sarah-picture-prompt">
        <Picture deck={deck} card={activity.card} />
        <strong>{activity.card.exampleWord}</strong>
      </div>
    )
  }

  if (questionKind === 'upperLowerMatch') {
    const promptText = activity.promptCase === 'upper' ? activity.card.uppercase : activity.card.lowercase
    return <div className="case-prompt">{promptText}</div>
  }

  return (
    <div className="question-cue sarah-cue" aria-label="Current sound">
      <strong>{questionKind === 'letterToSound' ? activity.card.displayText : activity.card.sound}</strong>
      <small>{questionKind === 'letterToSound' ? 'Tap the sound' : 'Tap the letter'}</small>
    </div>
  )
}

function SarahAnswerChoices({
  activity,
  status,
  wrongChoice,
  onChoose,
}: {
  activity: SarahActivity
  status: SarahActivityStatus
  wrongChoice: string
  onChoose: (answer: string, option?: LearningCard) => void
}) {
  const correctAnswer = getSarahCorrectAnswer(activity)
  const disabled = status === 'correct' || status === 'revealed'
  const questionKind = getSarahQuestionKind(activity)

  if (activity.textOptions) {
    return (
      <div className="sarah-options text-options" aria-label="Answer choices">
        {activity.textOptions.map((option) => (
          <button
            key={option}
            type="button"
            className={choiceState(option, correctAnswer, wrongChoice, status)}
            disabled={disabled}
            onClick={() => onChoose(option)}
          >
            <strong>{option}</strong>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="sarah-options" aria-label="Answer choices">
      {(activity.options ?? []).map((option) => {
        const answer = option.id
        return (
          <button
            key={option.id}
            type="button"
            className={choiceState(answer, correctAnswer, wrongChoice, status)}
            disabled={disabled}
            onClick={() => onChoose(answer, option)}
          >
            <strong>{sarahOptionLabel(option, questionKind)}</strong>
            <small>{sarahOptionSmall(option, questionKind)}</small>
          </button>
        )
      })}
    </div>
  )
}

function ExploreMode({
  deck,
  card,
  cardIndex,
  total,
  onNext,
}: {
  deck: LearningDeck
  card: LearningCard
  cardIndex: number
  total: number
  onNext: () => void
}) {
  useAutoplayCard(deck, card, `learn:${deck.id}:${card.id}`)
  const showDetails = true
  const mood: MascotMood = showDetails ? 'happy' : card.type === 'word' ? 'curious' : 'reading'
  return (
    <section className="study-layout">
      <div className="helper-panel">
        <Mascot mood={mood} />
        <strong>{card.type === 'word' ? 'Ready to read?' : 'Let us hear the sound!'}</strong>
        <button type="button" className="sound-button" onClick={() => playCardAudio(deck, card)}>
          <PlayIcon /> Tap to listen
        </button>
      </div>

      <article className="reader-card">
        <CardHeader deck={deck} card={card} />
        <div className="main-card-content">
          <CardPrimary card={card} />
          {showDetails ? <CardBack deck={deck} card={card} /> : <PeekHint card={card} />}
        </div>
      </article>

      <div className="mobile-mascot-row">
        <Mascot mood={mood} />
        <div>
          <strong>{showDetails ? 'Yay!' : "I'm here to help!"}</strong>
          <span>{showDetails ? 'Great job!' : card.type === 'word' ? 'Tap the card!' : 'Tap to listen!'}</span>
        </div>
      </div>

      <CardControls
        cardIndex={cardIndex}
        total={total}
        onNext={onNext}
      />
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
  const prompt = getChoicePrompt(deck, card, mode)
  const promptShowsWord = deck.type === 'letters' && mode === 'activeRecall'

  function choose(cardId: string) {
    setSelected(cardId)
    if (cardId === card.id) void playCardAudio(deck, card)
    if (cardId === card.id) window.setTimeout(onNext, 900)
  }

  return (
    <section className="choice-layout">
      <aside className="choice-prompt">
        <div className="prompt-topline">{mode === 'readerMode' ? 'Quiz time' : 'Practice time'}</div>
        <h2>{prompt}</h2>
        <button type="button" className="sound-button" onClick={() => playCardAudio(deck, card)}>
          <PlayIcon /> Tap to listen
        </button>
        <div className="prompt-art">
          {card.type === 'word' || mode === 'readerMode' ? <Picture deck={deck} card={card} /> : <QuestionCue card={card} />}
        </div>
        {promptShowsWord && <strong className="prompt-big">{card.displayText}</strong>}
      </aside>

      <div className="choice-main">
        <div className="choice-options" aria-label="Answer choices">
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
                className={state}
                disabled={Boolean(selected)}
                onClick={() => choose(option.id)}
              >
                <strong>{optionLabel(option)}</strong>
                <small>{optionSmallLabel(option)}</small>
              </button>
            )
          })}
        </div>

        <div className={`feedback ${selected ? (correct ? 'happy' : 'try-again') : ''}`}>
          {selected ? (
            correct ? (
              encouragement[(cardIndex + card.id.length) % encouragement.length]
            ) : (
              <>
                Try this one: <strong>{optionLabel(card)}</strong>
              </>
            )
          ) : (
            'Choose one'
          )}
        </div>
        <div className={`mood-callout ${selected ? (correct ? 'happy' : 'try-again') : 'thinking'}`}>
          <Mascot mood={mood} />
          <div>
            <strong>{selected ? (correct ? 'Yay!' : 'Oops!') : 'Hmm...'}</strong>
            <span>{selected ? (correct ? 'Great job!' : 'Try again!') : "What's that?"}</span>
          </div>
        </div>

        <CardControls
          cardIndex={cardIndex}
          total={lessonCards.length}
          onNext={onNext}
        />
      </div>
    </section>
  )
}

function CardHeader({ deck, card }: { deck: LearningDeck; card: LearningCard }) {
  return (
    <div className="card-header">
      <span>{deck.type === 'phonemes' ? 'Speech sound' : deck.type === 'letters' ? 'Letter sound' : 'Word card'}</span>
      <small>{card.category || (card.difficulty ? `Level ${card.difficulty}` : deck.title)}</small>
    </div>
  )
}

function CardPrimary({ card }: { card: LearningCard }) {
  if (card.type === 'word') {
    return <h2 className="word-display">{card.word}</h2>
  }
  return (
    <div className="sound-display">
      <strong>{card.displayText}</strong>
      <span>{card.sound || card.phoneme}</span>
    </div>
  )
}

function CardBack({ deck, card }: { deck: LearningDeck; card: LearningCard }) {
  return (
    <div className="card-back single-visual">
      <Picture deck={deck} card={card} />
      <div className="card-copy">
        {card.exampleWord && <strong>{card.exampleWord}</strong>}
        {card.meaning && card.meaning !== card.word && <strong>{card.meaning}</strong>}
        {card.exampleSentence && <p>{card.exampleSentence}</p>}
      </div>
    </div>
  )
}

function PeekHint({ card }: { card: LearningCard }) {
  return (
    <div className="peek-hint">
      <span>{card.type === 'word' ? 'Look at the picture' : 'Listen to the sound'}</span>
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

function QuestionCue({ card }: { card: LearningCard }) {
  return (
    <div className="question-cue" aria-label="Current answer">
      <strong>{optionLabel(card)}</strong>
      <small>{optionSmallLabel(card)}</small>
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

function CardControls({
  cardIndex,
  total,
  onNext,
}: {
  cardIndex: number
  total: number
  onNext: () => void
}) {
  return (
    <div className="card-controls">
      <span>
        {cardIndex + 1} / {total}
      </span>
      <button type="button" className="primary" onClick={onNext} aria-label="Next card">
        {cardIndex + 1 >= total ? 'Again' : 'Next'}
      </button>
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

  const text = card.speechCue || card.sound || card.phoneme || card.exampleWord || card.word || card.displayText
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
  if (card.type === 'phoneme') return card.exampleWord || card.phoneme || ''
  if (card.type === 'letter') return card.sound || card.exampleWord || ''
  return card.category || ''
}

function getChoicePrompt(deck: LearningDeck, card: LearningCard, mode: LearningMode): string {
  if (deck.type === 'reading-words') return mode === 'readerMode' ? 'What word matches the picture?' : 'Find this word.'
  if (deck.type === 'letters') return mode === 'readerMode' ? 'Which letter makes this sound?' : 'Tap the matching letter.'
  if (card.grapheme) return mode === 'readerMode' ? 'Which spelling matches this sound?' : 'Tap the matching sound.'
  return 'Choose the match.'
}

function buildSarahActivities(lessonCards: LearningCard[]): SarahActivity[] {
  const intros = lessonCards.map((card): SarahActivity => ({ kind: 'intro', card }))
  const soundToLetter = lessonCards.map((card): SarahActivity => ({
    kind: 'soundToLetter',
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
  return [...intros, ...soundToLetter, ...upperLower, ...beginningSound, ...review]
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

function getSarahPrompt(activity: SarahActivity): string {
  const kind = getSarahQuestionKind(activity)
  const word = titleCase(activity.card.exampleWord ?? '')
  if (kind === 'intro') return `This is ${activity.card.displayText}.`
  if (kind === 'soundToLetter') return `Which letter says ${activity.card.sound}?`
  if (kind === 'letterToSound') return `What sound does ${activity.card.displayText} make?`
  if (kind === 'upperLowerMatch') {
    return activity.promptCase === 'upper'
      ? `Find little ${activity.card.lowercase}.`
      : `Find big ${activity.card.uppercase}.`
  }
  return `${word} starts with what sound?`
}

function getSarahCorrectAnswer(activity: SarahActivity): string {
  if (activity.textOptions) return activity.correctText ?? ''
  return activity.card.id
}

function getSarahStageLabel(activity: SarahActivity, index: number): string {
  if (activity.kind === 'intro') return `Listen ${index + 1} of 5`
  if (activity.kind === 'review') return 'Quick review'
  if (activity.kind === 'soundToLetter') return 'Hear it'
  if (activity.kind === 'letterToSound') return 'Say it'
  if (activity.kind === 'upperLowerMatch') return 'Match it'
  return 'Start sound'
}

function getSarahFeedback(status: SarahActivityStatus, activity: SarahActivity): { title: string; detail: string } {
  if (activity.kind === 'intro') {
    return { title: 'Listen with Chunky!', detail: `${activity.card.displayText} says ${activity.card.sound}.` }
  }
  if (status === 'correct') return { title: 'Yay!', detail: 'Great job!' }
  if (status === 'try-again') return { title: 'Almost!', detail: 'Try one more time.' }
  if (status === 'revealed') return { title: 'Here it is!', detail: `It was ${sarahAnswerText(activity)}.` }
  return { title: 'Hmm...', detail: 'Tap one choice.' }
}

function sarahAnswerText(activity: SarahActivity): string {
  if (activity.textOptions) return activity.correctText ?? ''
  const kind = getSarahQuestionKind(activity)
  return sarahOptionLabel(activity.card, kind)
}

function sarahOptionLabel(card: LearningCard, kind: SarahQuestionKind | 'intro'): string {
  if (kind === 'letterToSound') return card.sound || ''
  return card.displayText
}

function sarahOptionSmall(card: LearningCard, kind: SarahQuestionKind | 'intro'): string {
  if (kind === 'letterToSound') return card.displayText
  if (kind === 'beginningSound') return card.sound || ''
  return card.exampleWord || card.sound || ''
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

function titleCase(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value
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
