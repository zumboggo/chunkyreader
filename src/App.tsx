import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

import { SectionPicker, PandaCloset } from './SectionPicker'
import type { SectionId } from './types'
import { markLessonComplete } from './progress'
type MascotMood = 'happy' | 'reading' | 'sad' | 'curious'
type LessonPhase = 'learn' | 'question'
type GrowingReaderView = 'home' | 'words' | 'stories' | 'phonemes'
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
type OlderReaderQuestionKind =
  | 'pictureToWord'
  | 'wordToPicture'
  | 'audioToWord'
  | 'startsWithSound'
  | 'wordFamily'
  | 'review'

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
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SARAH_FINAL_REVIEW_SIZE = 6
const SARAH_LESSON_ADVANCE = 2
const OLDER_READER_ACTIVITY_COUNT = 25
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
  const activeDeck = useMemo(
    () => visibleDecks.find((deck) => deck.id === activeDeckId) ?? visibleDecks[0],
    [activeDeckId, visibleDecks],
  )
  const currentCard = activeDeck?.cards[cardIndex % Math.max(1, activeDeck.cards.length)]
  const isLessonActive = Boolean(profile && activeDeck && currentCard)

  function chooseSection(section: SectionId, currentDecks = decks) {
    setActiveSection(section)
    setPhase('learn')
    setSarahActivityIndex(0)
    setMenuOpen(false)
    setCardIndex(0)
    
    let targetDeckId = ''
    let targetMode: LearningMode = 'activeRecall'
    
    if (section === 'letters') {
      targetDeckId = currentDecks.find(d => d.type === 'letters' && d.profile === 'sarah')?.id ?? ''
      targetMode = 'listeningMode'
    } else if (section === 'sounds') {
      targetDeckId = currentDecks.find(d => d.type === 'phonemes' && d.profile === 'sarah')?.id ?? ''
      targetMode = 'listeningMode'
    } else if (section === 'words') {
      targetDeckId = currentDecks.find(d => d.type === 'reading-words' && d.profile === 'anna')?.id ?? ''
      targetMode = 'activeRecall'
    } else if (section === 'math') {
      targetDeckId = currentDecks.find(d => d.type === 'math')?.id ?? ''
      targetMode = 'activeRecall'
    } else if (section === 'chinese') {
      targetDeckId = currentDecks.find(d => d.type === 'chinese-vocab')?.id ?? ''
      targetMode = 'activeRecall'
    }
    
    setActiveDeckId(targetDeckId)
    setMode(targetMode)
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
    }
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
            <strong>🏠 Home</strong>
          </span>
        </button>
      </header>

      {showCloset && <PandaCloset onClose={() => setShowCloset(false)} />}

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
        <SectionPicker onChooseSection={(s) => chooseSection(s)} onShowCloset={() => setShowCloset(true)} />
      ) : activeSection === 'stories' ? (
        <StorySection stories={stories} onBack={() => setActiveSection(null)} />
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
          onBackToPath={() => setActiveSection(null)}
          onRestartLesson={restartLesson}
          onModeChange={changeMode}
          onNextLesson={() => {
            if (activeSection) markLessonComplete(activeSection, activeDeckId)
            moveNextLessonFromCurrent()
          }}
          onDone={() => setActiveSection(null)}
          onGoHome={() => setActiveSection(null)}
          onToggleAdultDetails={() => setShowAdultDetails((v) => !v)}
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
          <span className="choice-sticker" aria-hidden="true">💯</span>
          <span className="path-badge">Classic</span>
          <strong>100 Lessons</strong>
          <small>Teach Your Child to Read</small>
        </button>
      </div>
      <div style={{display: 'flex', justifyContent: 'center', marginTop: '1rem'}}>
        <button className="sticker-nav-button squish" style={{fontSize: '1.2rem', padding: '0.75rem 1.5rem'}} onClick={onShowStickers}>🏆 Sticker Book</button>
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
}: {
  decks: LearningDeck[]
  stories: Story[]
  onWords: () => void
  onStories: () => void
  onPhonemes: () => void
}) {
  const wordCount = decks.filter(d => d.type === 'reading-words').reduce((sum, deck) => sum + deck.cards.length, 0)
  const pageCount = stories.reduce((sum, story) => sum + story.pages.length, 0)
  const phonemeCount = decks.filter(d => d.type === 'phonemes').reduce((sum, deck) => sum + deck.cards.length, 0)

  return (
    <section className="growing-reader-home">
      <div className="reader-hero">
        <img className="reader-hero-child" src={`${import.meta.env.BASE_URL}assets/profiles/anna-red-shirt.png`} alt="" />
        <div>
          <ChunkyLogo compact />
          <h1>Older Reader</h1>
          <p>Choose one happy reading pocket.</p>
        </div>
        <Mascot mood="reading" />
      </div>
      <div className="reader-choice-grid" aria-label="Choose an Older Reader activity">
        <button type="button" className="reader-choice phoneme-choice" onClick={onPhonemes}>
          <span className="choice-sticker" aria-hidden="true">🔊</span>
          <strong>Phonemes</strong>
          <small>{phonemeCount} sounds & spellings</small>
        </button>
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
          <span className="prompt-topline">Older Reader</span>
          <h1>Read a Story</h1>
          <p>Pick one tiny story. Each one has three gentle pages.</p>
        </div>
        <AudioPackButton />
        <Mascot mood="happy" />
      </div>

      {stories.length === 0 ? (
        <section className="empty-screen story-empty">
          <Mascot mood="curious" />
          <h2>Stories are coming soon</h2>
          <p>Add stories to <strong>public/stories/anne-stories.json</strong>.</p>
        </section>
      ) : (
        <div className="story-grid" aria-label="Story library">
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
  const isOlderReaderWords = activeDeck.profile === 'anna' && activeDeck.type === 'reading-words'
  const isOlderReaderPhonemes = activeDeck.profile === 'anna' && activeDeck.type === 'phonemes'
  const lessonDeckCards = isSarahLetters || isOlderReaderPhonemes ? activeDeck.cards : orderCardsForMode(activeDeck, mode)
  const activeCard = lessonDeckCards[cardIndex % Math.max(1, lessonDeckCards.length)] ?? card
  const lessonStart = isSarahLetters
    ? sarahLetterLessonStartForIndex(cardIndex, lessonDeckCards.length)
    : isOlderReaderPhonemes
    ? fixedLessonStartForIndex(cardIndex, lessonDeckCards.length)
    : lessonStartForIndex(cardIndex, lessonDeckCards.length)
  const lessonLength = isSarahLetters
    ? sarahLetterLessonSizeForStart(lessonStart, lessonDeckCards.length)
    : isOlderReaderPhonemes
    ? Math.min(LESSON_SIZE, lessonDeckCards.length - lessonStart)
    : LESSON_SIZE
  const lessonCards = lessonDeckCards.slice(lessonStart, lessonStart + lessonLength)
  const lessonIndex = cardIndex - lessonStart
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
    : lessonNumberForIndex(cardIndex, lessonDeckCards.length)
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
      ) : isOlderReaderWords ? (
        <OlderReaderLesson
          key={`${activeDeck.id}:${lessonNumber}:${sarahActivityIndex}`}
          deck={activeDeck}
          lessonCards={lessonCards}
          activities={olderReaderActivities}
          lessonNumber={lessonNumber}
          activityIndex={sarahActivityIndex}
          onActivityChange={onSarahActivityChange}
          onNextLesson={onNextLesson}
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
          onNextLesson={onNextLesson}
          onDone={onDone}
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
                ← Back to Older Reader
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
                {showAdultDetails ? '✓ ' : ''}Adult Details
              </button>
            </div>
              {activeDeck.type === 'letters' && (
                <div className="menu-note parent-note">
                  This section teaches letter sounds before letter names. The goal is hearing, saying, and matching sounds.
                </div>
              )}
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
      playSfx('correct')
      void playNarrationClip('feedback:great')
      void playSarahActivityAudio(deck, activity)
      window.setTimeout(nextActivity, 850)
      return
    }
    setWrongChoice(answer)
    playSfx('wrong')
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
    if (completed) {
      playSfx('fireworks')
      fireworksCelebration()
      const currentProgress = parseInt(localStorage.getItem('completed-lessons-sarah') || '0', 10)
      localStorage.setItem('completed-lessons-sarah', (currentProgress + 1).toString())
    }
  }, [completed])

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
  onDone,
}: {
  deck: LearningDeck
  lessonCards: LearningCard[]
  activities: OlderReaderActivity[]
  lessonNumber: number
  activityIndex: number
  onActivityChange: (index: number) => void
  onNextLesson: () => void
  onDone: () => void
}) {
  const activity = activities[Math.min(activityIndex, activities.length - 1)]
  const [selected, setSelected] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [complete, setComplete] = useState(false)
  const correct = selected === activity?.card.id
  const showCompletion = complete || activityIndex >= activities.length
  const prompt = activity ? getOlderReaderPrompt(activity) : ''
  const promptNarration = useNarration(
    showCompletion
      ? 'older-reader:complete'
      : activity?.kind === 'audioToWord'
        ? undefined
        : activity
          ? `older-reader:prompt:${activity.kind}`
          : undefined,
    showCompletion ? 'You practiced five words. Great job!' : prompt,
    `${deck.id}:${lessonNumber}:${showCompletion ? 'complete' : activityIndex}`,
  )

  useEffect(() => {
    if (!activity || showCompletion) return
    if (activity.kind !== 'audioToWord') return
    const timer = window.setTimeout(() => {
      void playCardAudio(deck, activity.card)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [activity, deck, showCompletion])

  const finishActivity = useCallback(() => {
    if (activityIndex >= activities.length - 1) {
      markCardsRecalled(deck.id, lessonCards)
      setComplete(true)
      return
    }
    onActivityChange(activityIndex + 1)
  }, [activities.length, activityIndex, deck.id, lessonCards, onActivityChange])

  const chooseByIndex = useCallback((index: number) => {
    if (!activity || selected || showCompletion) return
    const option = activity.options[index]
    if (!option) return
    setSelected(option.id)
    if (option.id === activity.card.id) {
      playSfx('correct')
      void playNarrationClip('feedback:great')
      void playCardAudio(deck, activity.card)
      window.setTimeout(finishActivity, 650)
      return
    }
    playSfx('wrong')
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    if (nextAttempts >= 2) {
      window.setTimeout(finishActivity, 900)
    } else {
      void playNarrationClip('feedback:try-again')
      window.setTimeout(() => setSelected(''), 620)
    }
  }, [activity, attempts, deck, finishActivity, selected, showCompletion])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreControllerKey(event)) return
      if (event.key === '3') {
        event.preventDefault()
        if (showCompletion) onNextLesson()
        else chooseByIndex(0)
      }
      if (event.key === '4') {
        event.preventDefault()
        if (showCompletion) onDone()
        else chooseByIndex(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chooseByIndex, onDone, onNextLesson, showCompletion])

  useEffect(() => {
    if (showCompletion) {
      playSfx('fireworks')
      fireworksCelebration()
      const currentProgress = parseInt(localStorage.getItem('completed-lessons-anna') || '0', 10)
      localStorage.setItem('completed-lessons-anna', (currentProgress + 1).toString())
    }
  }, [showCompletion])

  if (!activity || showCompletion) {
    return (
      <section className="focus-lesson older-reader-lesson">
        <div className="focus-main">
          <div className="focus-intro completion-card">
            <div className="focus-prompt">
              <span className="stage-label">Lesson {lessonNumber}</span>
              <h2>You practiced 5 words!</h2>
            </div>
            <div className="lesson-word-strip">
              {lessonCards.map((card) => (
                <span key={card.id}>{card.word || card.displayText}</span>
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
            <span>That was a full lesson.</span>
          </div>
        </div>
      </section>
    )
  }

  const showPromptPicture = ['pictureToWord', 'startsWithSound', 'review'].includes(activity.kind)
  const showOptionPictures = activity.kind === 'wordToPicture'
  const mood: MascotMood = selected ? (correct ? 'happy' : 'sad') : activity.kind === 'audioToWord' ? 'reading' : 'curious'

  return (
    <section className="focus-lesson older-reader-lesson">
      <div className="focus-main">
        <div className="focus-question older-reader-question">
          <div className="focus-prompt">
            <span className="stage-label">Lesson {lessonNumber} - Practice {activityIndex + 1} of {activities.length}</span>
            <h2>{prompt}</h2>
            {promptNarration.shouldShowPlayButton && (
              <AudioPromptButton onClick={promptNarration.replay} label="Hear question" />
            )}
            {activity.kind === 'audioToWord' && <AudioPromptButton onClick={() => playCardAudio(deck, activity.card)} label="Hear it" />}
            {activity.kind === 'wordToPicture' && <div className="word-display prompt-word">{optionLabel(activity.card)}</div>}
            {activity.kind === 'wordFamily' && <div className="word-chunk">{wordChunk(activity.card)}</div>}
            {showPromptPicture && (
              <div className="focus-visual compact">
                <Picture deck={deck} card={activity.card} />
              </div>
            )}
          </div>
          <div className="focus-options" aria-label="Answer choices">
            {activity.options.map((option, index) => {
              const state =
                selected && option.id === activity.card.id
                  ? 'correct'
                  : selected === option.id
                    ? 'wrong'
                    : ''
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={`Choice ${choiceKeyLabel(index)}: ${optionLabel(option)}`}
                  className={`focus-option squish ${showOptionPictures ? 'picture-choice' : ''} ${state === 'correct' ? 'correct pulse' : state === 'wrong' ? 'wrong shake' : ''}`}
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
      <div className={`focus-feedback ${selected ? (correct ? 'happy' : 'try') : ''}`}>
        <Mascot mood={mood} size="small" />
        <div className="feedback-text">
          {selected ? (
            correct ? (
              <>
                <strong>Great!</strong>
                <span>{encouragement[(activityIndex + activity.card.id.length) % encouragement.length]}</span>
              </>
            ) : (
              <>
                <strong>Try again</strong>
                <span>{attempts >= 1 ? `It was ${optionLabel(activity.card)}.` : 'Pick the other one.'}</span>
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

function buildOlderReaderActivities(lessonCards: LearningCard[]): OlderReaderActivity[] {
  const wordCards = lessonCards.filter((card) => card.type === 'word')
  if (!wordCards.length) return []
  const firstHalfKinds: OlderReaderQuestionKind[] = [
    'pictureToWord',
    'audioToWord',
    'wordToPicture',
    'startsWithSound',
    'audioToWord',
    'review',
  ]
  const audioOnlyStart = Math.floor(OLDER_READER_ACTIVITY_COUNT / 2)

  return Array.from({ length: OLDER_READER_ACTIVITY_COUNT }, (_, index): OlderReaderActivity => {
    const card = wordCards[index % wordCards.length]
    const kind = index >= audioOnlyStart ? 'audioToWord' : firstHalfKinds[index % firstHalfKinds.length]
    return {
      kind,
      card,
      options: buildOlderReaderOptions(wordCards, card, kind),
    }
  })
}

function buildOlderReaderOptions(
  lessonCards: LearningCard[],
  card: LearningCard,
  kind: OlderReaderQuestionKind,
): LearningCard[] {
  const candidates = lessonCards.filter((candidate) => candidate.id !== card.id)
  const preferred = candidates.filter((candidate) => {
    if (kind === 'startsWithSound') return firstSound(candidate) !== firstSound(card)
    if (kind === 'wordFamily') return wordChunk(candidate) !== wordChunk(card)
    return true
  })
  const pool = preferred.length ? preferred : candidates
  const distractor = pool.sort(
    (a, b) => stableSort(`older:${kind}:${card.id}:${a.id}`) - stableSort(`older:${kind}:${card.id}:${b.id}`),
  )[0] ?? card

  return [card, distractor].sort(
    (a, b) => stableSort(`older-order:${kind}:${card.id}:${a.id}`) - stableSort(`older-order:${kind}:${card.id}:${b.id}`),
  )
}

function getOlderReaderPrompt(activity: OlderReaderActivity): string {
  if (activity.kind === 'pictureToWord' || activity.kind === 'review') return 'What word matches the picture?'
  if (activity.kind === 'wordToPicture') return 'Which picture matches this word?'
  if (activity.kind === 'audioToWord') return 'Which word did you hear?'
  if (activity.kind === 'startsWithSound') return `Which word starts with ${firstSound(activity.card)}?`
  if (activity.kind === 'wordFamily') return 'Which word has this chunk?'
  return 'Choose the word.'
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
  if ((status === 'correct' || status === 'revealed') && answer === correctAnswer) return 'correct pulse'
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
  } catch {
    // Reading should never depend on storage support.
  }
}

function storyProgressKey(storyId: string): string {
  return `chunky-reader:story:${storyId}:page`
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
      const emojis = isAnna ? ['🌟', '📚', '🚀', '🌈'] : ['🐼', '🍎', '🎈', '⭐']
      stickers.push(i < lessons ? emojis[i % emojis.length] : '')
    }
    return stickers
  }

  function renderHundredLessonStickers(lessons: number) {
    const stickers = []
    const trophyStickers = ['\u{1F3C6}', '\u{1F396}\uFE0F', '\u{1F4D8}', '\u2B50']
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
  const duration = 2500;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval: ReturnType<typeof setInterval> = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    confetti({
      ...defaults, particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
    });
    confetti({
      ...defaults, particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
    });
  }, 250);
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
  onDone,
}: {
  deck: LearningDeck
  lessonCards: LearningCard[]
  activities: OlderReaderPhonemeActivity[]
  lessonNumber: number
  activityIndex: number
  onActivityChange: (index: number) => void
  onNextLesson: () => void
  onDone: () => void
}) {
  const [status, setStatus] = useState<SarahActivityStatus>('idle')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  
  const isComplete = activityIndex >= activities.length
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
      playSfx('wrong')
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
               🔊
             </button>
             <SpellingChip text={card.primarySpelling || card.displayText} />
             <div className="intro-example">
               <button type="button" className="example-audio squish" style={{fontSize: '1.5rem', fontWeight: 'bold', padding: '0.75rem 1.5rem', borderRadius: '100px', border: '2px solid var(--c-border)', cursor: 'pointer', background: 'white'}} onClick={() => playNarrationClip(card.id + '-example', card.exampleWord, exampleAudioAsset)}>
                 🔊 {card.exampleWord}
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
                🔊
              </button>
            )}
            {activity.kind === 'spellingToSound' && (
              <SpellingChip text={card.primarySpelling || card.displayText} />
            )}
            {activity.kind === 'mixedReview' && (
              <button type="button" className="example-audio squish" style={{fontSize: '1.5rem', fontWeight: 'bold', padding: '0.75rem 1.5rem', borderRadius: '100px', border: '2px solid var(--c-border)', cursor: 'pointer', background: 'white'}} onClick={() => playNarrationClip(card.id + '-example', card.exampleWord, exampleAudioAsset)}>
                🔊 {card.exampleWord}
              </button>
            )}
          </div>
          
          {renderChoices()}
        </div>
      )}
      <Mascot mood={status === 'correct' ? 'happy' : status === 'try-again' ? 'sad' : 'curious'} />
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
