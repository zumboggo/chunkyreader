import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadDeckLibrary, resolveAssetUrl } from './decks'
import type { LearningCard, LearningDeck, LearningMode, ProfileId } from './types'

type MascotMood = 'happy' | 'reading' | 'sad' | 'curious'

const modeDetails: Array<{
  id: LearningMode
  label: string
  helper: string
}> = [
  { id: 'listeningMode', label: 'Explore', helper: 'Tap, listen, peek' },
  { id: 'activeRecall', label: 'Practice', helper: 'Match and try' },
  { id: 'readerMode', label: 'Quiz', helper: 'Choose the answer' },
]

const encouragement = [
  'Great job!',
  'You found it!',
  'Nice reading!',
  'You did it!',
  'One more!',
]

function App() {
  const [decks, setDecks] = useState<LearningDeck[]>([])
  const [profile, setProfile] = useState<ProfileId | null>(null)
  const [activeDeckId, setActiveDeckId] = useState('')
  const [mode, setMode] = useState<LearningMode>('listeningMode')
  const [cardIndex, setCardIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const nextDecks = await loadDeckLibrary()
        if (cancelled) return
        const params = new URLSearchParams(window.location.search)
        const initialProfile = params.get('profile') as ProfileId | null
        const initialMode = params.get('mode') as LearningMode | null
        const profileDeck =
          initialProfile && ['anna', 'sarah', 'library'].includes(initialProfile)
            ? nextDecks.find((deck) => deck.profile === initialProfile) ?? nextDecks[0]
            : nextDecks[0]
        setDecks(nextDecks)
        setProfile(initialProfile && ['anna', 'sarah', 'library'].includes(initialProfile) ? initialProfile : null)
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
    setActiveDeckId(firstDeck?.id ?? '')
    setMode('listeningMode')
    setCardIndex(0)
    setShowBack(false)
  }

  function moveCard(delta: number) {
    if (!activeDeck?.cards.length) return
    setCardIndex((index) => (index + delta + activeDeck.cards.length) % activeDeck.cards.length)
    setShowBack(false)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand-button" type="button" onClick={() => setProfile(null)}>
          <Mascot size="small" mood="reading" />
          <span>
            <strong>Chunky Reader</strong>
            <small>{activeDeck ? activeDeck.title : 'Ready to read?'}</small>
          </span>
        </button>
        <nav className="top-actions" aria-label="Learning paths">
          <button className={profile === 'anna' ? 'active' : ''} type="button" onClick={() => chooseProfile('anna')}>
            Anna
          </button>
          <button className={profile === 'sarah' ? 'active' : ''} type="button" onClick={() => chooseProfile('sarah')}>
            Sarah
          </button>
          <button className={profile === 'library' ? 'active' : ''} type="button" onClick={() => chooseProfile('library')}>
            Decks
          </button>
        </nav>
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
      ) : activeDeck && currentCard ? (
        <LearningScreen
          decks={visibleDecks}
          activeDeck={activeDeck}
          activeDeckId={activeDeckId}
          card={currentCard}
          cardIndex={cardIndex}
          mode={mode}
          showBack={showBack}
          onDeckChange={(deckId) => {
            setActiveDeckId(deckId)
            setCardIndex(0)
            setShowBack(false)
          }}
          onModeChange={(nextMode) => {
            setMode(nextMode)
            setCardIndex(0)
            setShowBack(false)
          }}
          onToggleBack={() => setShowBack((value) => !value)}
          onNext={() => moveCard(1)}
          onPrevious={() => moveCard(-1)}
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
          <span className="kid-portrait anna-portrait" aria-hidden="true" />
          <span className="path-badge">Words</span>
          <strong>Anna</strong>
          <small>{annaCount} reading cards</small>
        </button>
        <button type="button" className="path-card sarah-path" onClick={() => onChoose('sarah')}>
          <span className="kid-portrait sarah-portrait" aria-hidden="true" />
          <span className="path-badge">Sounds</span>
          <strong>Sarah</strong>
          <small>{sarahCount} letter and sound cards</small>
        </button>
      </div>
      <div className="quick-grid" aria-label="Quick learning choices">
        <button type="button" className="quick-tile letters-tile" onClick={() => onChoose('sarah')}>
          <span>ABC</span>
          <strong>Letters</strong>
        </button>
        <button type="button" className="quick-tile sounds-tile" onClick={() => onChoose('sarah')}>
          <span className="headphone-icon" aria-hidden="true" />
          <strong>Sounds</strong>
        </button>
        <button type="button" className="quick-tile words-tile" onClick={() => onChoose('anna')}>
          <span className="book-icon" aria-hidden="true" />
          <strong>Words</strong>
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

function LearningScreen({
  decks,
  activeDeck,
  activeDeckId,
  card,
  cardIndex,
  mode,
  showBack,
  onDeckChange,
  onModeChange,
  onToggleBack,
  onNext,
  onPrevious,
}: {
  decks: LearningDeck[]
  activeDeck: LearningDeck
  activeDeckId: string
  card: LearningCard
  cardIndex: number
  mode: LearningMode
  showBack: boolean
  onDeckChange: (deckId: string) => void
  onModeChange: (mode: LearningMode) => void
  onToggleBack: () => void
  onNext: () => void
  onPrevious: () => void
}) {
  const progress = activeDeck.cards.length ? cardIndex + 1 : 0
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
          <h1>{activeDeck.profile === 'anna' ? 'Reading Words' : activeDeck.level === 1 ? 'Letters' : 'Reading Sounds'}</h1>
          <p>{activeDeck.description}</p>
        </div>
        <div className="deck-meta">
          <strong>{activeDeck.cards.length}</strong>
          <span>cards</span>
        </div>
      </div>
      <div className="lesson-progress" aria-label="Lesson progress">
        <span>★ Level {activeDeck.level ?? Math.max(1, card.difficulty ?? 1)}</span>
        <div><span style={{ width: `${Math.max(6, (progress / activeDeck.cards.length) * 100)}%` }} /></div>
        <strong>{progress} / {activeDeck.cards.length}</strong>
        <span className="gift-icon" aria-hidden="true">🎁</span>
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

      <div className="mode-tabs" aria-label="Choose learning mode">
        {modeDetails.map((item) => (
          <button
            key={item.id}
            type="button"
            className={mode === item.id ? 'active' : ''}
            onClick={() => onModeChange(item.id)}
          >
            <strong>{item.label}</strong>
            <small>{item.helper}</small>
          </button>
        ))}
      </div>

      {mode === 'listeningMode' ? (
        <ExploreMode
          deck={activeDeck}
          card={card}
          cardIndex={cardIndex}
          showBack={showBack}
          onToggleBack={onToggleBack}
          onNext={onNext}
          onPrevious={onPrevious}
        />
      ) : (
        <ChoiceMode
          key={`${activeDeck.id}:${mode}:${card.id}`}
          deck={activeDeck}
          card={card}
          cardIndex={cardIndex}
          mode={mode}
          onNext={onNext}
          onPrevious={onPrevious}
        />
      )}
    </section>
  )
}

function ExploreMode({
  deck,
  card,
  cardIndex,
  showBack,
  onToggleBack,
  onNext,
  onPrevious,
}: {
  deck: LearningDeck
  card: LearningCard
  cardIndex: number
  showBack: boolean
  onToggleBack: () => void
  onNext: () => void
  onPrevious: () => void
}) {
  const showDetails = showBack || card.type !== 'word'
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

      <article className="reader-card" onClick={onToggleBack}>
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
        total={deck.cards.length}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </section>
  )
}

function ChoiceMode({
  deck,
  card,
  cardIndex,
  mode,
  onNext,
  onPrevious,
}: {
  deck: LearningDeck
  card: LearningCard
  cardIndex: number
  mode: LearningMode
  onNext: () => void
  onPrevious: () => void
}) {
  const [selected, setSelected] = useState('')
  const options = useMemo(() => buildOptions(deck.cards, card), [card, deck.cards])
  const correct = selected === card.id
  const mood: MascotMood = selected ? (correct ? 'happy' : 'sad') : 'curious'
  const prompt = getChoicePrompt(deck, card, mode)
  const promptShowsWord = deck.type === 'letters' && mode === 'activeRecall'

  function choose(cardId: string) {
    setSelected(cardId)
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
          {card.type === 'word' || mode === 'readerMode' ? (
            <Picture deck={deck} card={card} />
          ) : (
            <MouthCue deck={deck} card={card} />
          )}
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
          total={deck.cards.length}
          onPrevious={onPrevious}
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
  const hasMouthCue = Boolean(card.mouthImage || card.type !== 'word')
  return (
    <div className={`card-back ${hasMouthCue ? 'with-mouth' : 'single-visual'}`}>
      <Picture deck={deck} card={card} />
      {hasMouthCue ? <MouthCue deck={deck} card={card} /> : null}
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
      <span>{card.type === 'word' ? 'Tap to see the picture' : 'Tap to see the mouth'}</span>
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

function MouthCue({ deck, card }: { deck: LearningDeck; card: LearningCard }) {
  return (
    <AssetImage
      src={resolveAssetUrl(deck, card.mouthImage)}
      label={`Mouth for ${card.sound || card.phoneme || card.displayText}`}
      className="mouth-frame"
      fallback={<MouthFallback card={card} />}
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

function MouthFallback({ card }: { card: LearningCard }) {
  const group = mouthGroup(card)
  return (
    <div className={`mouth-fallback mouth-${group}`} aria-label="Mouth shape placeholder">
      <span className="face-eye left" />
      <span className="face-eye right" />
      <span className="mouth-shape" />
      <small>{card.sound || card.phoneme || card.displayText}</small>
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
  onPrevious,
  onNext,
}: {
  cardIndex: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="card-controls">
      <button type="button" onClick={onPrevious} aria-label="Previous card">
        Back
      </button>
      <span>
        {cardIndex + 1} / {total}
      </span>
      <button type="button" className="primary" onClick={onNext} aria-label="Next card">
        Next
      </button>
    </div>
  )
}

function PlayIcon() {
  return <span className="play-icon" aria-hidden="true" />
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
  if ('speechSynthesis' in window && text) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text.replaceAll('/', ''))
    utterance.lang = deck.language || 'en-US'
    utterance.rate = deck.profile === 'sarah' ? 0.72 : 0.86
    window.speechSynthesis.speak(utterance)
  }
}

function playAudioUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url)
    audio.addEventListener('ended', () => resolve(), { once: true })
    audio.addEventListener('error', () => reject(new Error('Audio failed')), { once: true })
    audio.play().catch(reject)
  })
}

function buildOptions(cards: LearningCard[], card: LearningCard): LearningCard[] {
  const seed = card.id
  const distractors = cards
    .filter((candidate) => candidate.id !== card.id)
    .sort((a, b) => stableSort(`${seed}:${a.id}`) - stableSort(`${seed}:${b.id}`))
    .slice(0, 3)
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

function mouthGroup(card: LearningCard): 'closed' | 'open' | 'teeth' | 'round' | 'smile' {
  const key = `${card.sound ?? ''} ${card.phoneme ?? ''} ${card.grapheme ?? ''}`.toLocaleLowerCase()
  if (/m|b|p/u.test(key)) return 'closed'
  if (/f|v|th|θ|ð/u.test(key)) return 'teeth'
  if (/oo|w|u|ʊ|oʊ|ɔ/u.test(key)) return 'round'
  if (/ee|i|y|j/u.test(key)) return 'smile'
  return 'open'
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
