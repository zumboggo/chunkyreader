import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

async function refactorApp() {
  const appPath = path.join(root, 'src', 'App.tsx')
  let content = await fs.readFile(appPath, 'utf8')

  // 1. Add new imports
  const importsToAdd = `
import { SectionPicker, PandaCloset } from './SectionPicker'
import type { SectionId } from './types'
import { markLessonComplete } from './progress'
import { getNewlyUnlockedRewards } from './rewards'
`
  content = content.replace("import { HundredLessonsHome, HundredLessonScreen } from './HundredLessons'\n", "import { HundredLessonsHome, HundredLessonScreen } from './HundredLessons'\n" + importsToAdd)

  // 2. Replace App state
  const appStateSearch = `  const [decks, setDecks] = useState<LearningDeck[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [profile, setProfile] = useState<ProfileId | null>(null)
  const [growingView, setGrowingView] = useState<GrowingReaderView>('home')`

  const appStateReplace = `  const [decks, setDecks] = useState<LearningDeck[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [activeSection, setActiveSection] = useState<SectionId | null>(null)
  const [profile, setProfile] = useState<ProfileId | null>(null)
  const [growingView, setGrowingView] = useState<GrowingReaderView>('home')
  const [showCloset, setShowCloset] = useState(false)`

  content = content.replace(appStateSearch, appStateReplace)

  // 3. Replace useEffect URL parsing
  const useEffectSearch = `        const initialProfile = params.get('profile') as ProfileId | null
        const initialMode = params.get('mode') as LearningMode | null
        const wantsStories = params.get('stories') === 'true'
        const profileDeck =
          initialProfile && ['anna', 'sarah', 'library', '100-lessons'].includes(initialProfile)
            ? nextDecks.find((deck) => deck.profile === initialProfile) ?? nextDecks[0]
            : nextDecks[0]
        setDecks(nextDecks)
        setStories(nextStories)
        setProfile(initialProfile && ['anna', 'sarah', 'library', '100-lessons'].includes(initialProfile) ? initialProfile : null)
        setGrowingView(initialProfile === 'anna' ? (wantsStories ? 'stories' : 'home') : 'home')
        setActiveDeckId(profileDeck?.id ?? '')`
  
  const useEffectReplace = `        const initialSection = params.get('section') as SectionId | null
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
        }`

  content = content.replace(useEffectSearch, useEffectReplace)

  // 4. Add chooseSection function
  const chooseProfileSearch = `  function chooseProfile(nextProfile: ProfileId) {`
  const chooseSectionStr = `  function chooseSection(section: SectionId, currentDecks = decks) {
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
  }\n\n`
  content = content.replace(chooseProfileSearch, chooseSectionStr + chooseProfileSearch)

  // 5. Replace App render
  const renderSearchStart = `  return (
    <main className={\`app-shell \${isLessonActive ? 'lesson-active' : ''}\`}>
      <header className="topbar">`
  const renderSearchEnd = `        </section>
      )}
    </main>
  )`
  
  // Extract the whole render block and replace the middle logic
  const startIndex = content.indexOf(renderSearchStart)
  const endIndex = content.indexOf(renderSearchEnd) + renderSearchEnd.length
  
  const oldRender = content.substring(startIndex, endIndex)
  
  const newRender = `  return (
    <main className={\`app-shell \${isLessonActive ? 'lesson-active' : ''}\`}>
      <header className="topbar">
        <button
          className="brand-button squish"
          type="button"
          onClick={() => {
            setActiveSection(null)
            setProfile(null)
            setGrowingView('home')
            setMenuOpen(false)
            setHundredLessonId('')
          }}
        >
          <Mascot size="small" mood="reading" />
          <span>
            <strong>Home</strong>
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
  )`

  content = content.replace(oldRender, newRender)
  
  await fs.writeFile(appPath, content)
  console.log('App.tsx refactored')
}

refactorApp().catch(console.error)
