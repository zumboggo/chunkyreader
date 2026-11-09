import './home.css'
import { assetUrl } from './mediaAssets'
import { progressStorage } from './progressStorage'
import { useState } from 'react'
import confetti from 'canvas-confetti'
import { LEARNING_SECTIONS } from './content/sections'
import {
  BOX_CADENCE,
  equipReward,
  getOwnedRewards,
  getRewardById,
  openPandaBox,
  rarityRank,
  rewardsBySlot,
} from './rewards'
import { getSectionProgress, loadProgress, saveProgress, getStreakInfo, getHeatmapData } from './progress'
import { loadGuidedReadingState } from './guidedWordsStorage'
import type { GreenEggsProgress } from './bookProgress'
import type { RewardDrop, RewardItem, RewardRarity, RewardSlot, SectionId } from './types'

export interface ContinueLearningState {
  section: SectionId
  deckId?: string
  cardIndex?: number
  mode?: string
  storyId?: string
  pageIndex?: number
  label?: string
}

export function SectionPicker({
  onChooseSection,
  onChoosePhonemes,
  onChooseFlashcards,
  onShowCloset,
  onShowSettings,
  onContinue,
  continueState,
  greenEggs,
}: {
  onChooseSection: (id: SectionId) => void
  onChoosePhonemes: () => void
  onChooseFlashcards: () => void
  onShowCloset: () => void
  onShowSettings: () => void
  onContinue: () => void
  continueState?: ContinueLearningState
  greenEggs: GreenEggsProgress
}) {
  const [showEarlyReading, setShowEarlyReading] = useState(false)
  const progress = loadProgress()
  const ownedCount = getOwnedRewards(progress).length
  const boxCount = progress.unopenedBoxes || 0
  const streakInfo = getStreakInfo()
  const heatmapData = getHeatmapData()
  const phonemesLearned = getPhonemeLearnedCount()
  const readingState = loadGuidedReadingState('annas-reading-deck')
  const practisedWords = Object.keys(readingState.words).length

  if (showEarlyReading) {
    return (
      <section className="home-screen">
        <button type="button" className="choice-action" onClick={() => setShowEarlyReading(false)}>← All categories</button>
        <div className="home-copy"><div>
          <h1>Letters &amp; Sounds</h1>
          <p>Listen, look, and play together. Choose either little game.</p>
        </div></div>
        <div className="path-grid section-grid" aria-label="Choose a little game">
          {LEARNING_SECTIONS.filter(section => section.id === 'letters' || section.id === 'sounds').map(section => (
            <button key={section.id} type="button" className="path-card"
              style={{ backgroundColor: section.color }} onClick={() => onChooseSection(section.id)}>
              <div className="section-image-container"><img className="section-image" src={assetUrl(section.image)} alt="" /></div>
              <span className="section-audience-pill">Earliest Reader</span>
              <strong>{section.id === 'letters' ? 'Play with letters' : 'Play with sounds'}</strong>
              <p>{section.id === 'letters' ? 'See a letter, hear its sound, and copy or tap.' : 'Hear two sounds and play with familiar pictures.'}</p>
              <div className="section-card-footer"><span>30–60 seconds together</span><span>Let’s play</span></div>
              <SectionProgressBadge count={getSectionProgress(section.id)} />
            </button>
          ))}
        </div>
        <p>Both games are always open. Listen and explore at your own pace.</p>
      </section>
    )
  }

  const tiles = [
    {id:'letters', title:'Letters & Sounds', audience:'Earliest Reader', art:2, tint:'peach', hint:'Two tiny games to listen, look, and play together.', count:getSectionProgress('letters') + getSectionProgress('sounds')},
    {id:'words', title:'Words', audience:'Growing Reader', art:3, tint:'butter', hint:'Four practice words and a final sentence with a parent.', count:practisedWords},
    {id:'stories', title:'Stories', audience:'Growing Reader', art:4, tint:'sage', hint:'Little books and choose-your-own adventures.', count:getSectionProgress('stories')},
    {id:'math', title:'Math', audience:'Number play', art:5, tint:'lilac', hint:'Count, add, and subtract.', count:getSectionProgress('math')},
    {id:'chinese', title:'Chinese', audience:'Chunky Chinese', art:6, tint:'rose', hint:'Five characters. Hear, see, and review.', count:getSectionProgress('chinese')},
    {id:'phonics', title:'Phonics Patterns', audience:'Older reader', art:7, tint:'sage', hint:'Explore letter patterns such as sh, ch, and ai.', count:phonemesLearned},
  ]
  const stepsDone = progress.totalLessonsCompleted % BOX_CADENCE
  const stepsLeft = BOX_CADENCE - stepsDone
  const today = new Date()
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
  const week = Array.from({length:7}, (_,index) => {
    const day = new Date(weekStart); day.setDate(day.getDate()+index)
    const date = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`
    return {date, count:heatmapData.find(d=>d.date===date)?.count || 0, isToday:index===today.getDay()}
  })
  return (
    <section className="warm-home" aria-label="Learning home">
      <header className="warm-heading">
        <HomeArt index={0} />
        <div><h1>Chunky Learner</h1><p>A little learning, a lot of joy.</p></div>
        <span className="warm-streak" aria-label={`${streakInfo.currentStreak} day streak`}><span aria-hidden="true">{streakInfo.currentStreak ? '🔥' : '⭐'}</span> {streakInfo.currentStreak} {streakInfo.currentStreak===1?'day':'days'}</span>
      </header>
      <button type="button" className="warm-resume" onClick={continueState ? onContinue : () => setShowEarlyReading(true)}>
        <span className="warm-resume-copy"><span>{continueState ? 'Resume' : 'Let’s play'}</span><strong>{continueState ? (continueState.label || sectionTitle(continueState.section)) : 'A little adventure'}</strong><small>{continueState ? continueDetail(continueState,greenEggs) : 'Listen, look, and learn together'}</small></span>
        <HomeArt index={1} /><span className="warm-play" aria-hidden="true">▶</span>
      </button>
      <button type="button" className="warm-reward" onClick={onShowCloset}>
        <HomeArt index={8} /><span>{boxCount > 0 ? `${boxCount} Panda ${boxCount===1?'Box is':'Boxes are'} ready to open!` : `${stepsLeft} ${stepsLeft===1?'lesson':'lessons'} to your next Panda Box`}</span>
        <span className="warm-dots" aria-hidden="true">{Array.from({length:BOX_CADENCE},(_,i)=><i key={i} className={i<stepsDone?'done':''}/>)}</span>
      </button>
      <div className="warm-activities"><h2>What shall we play?</h2>
        <div className="warm-grid" aria-label="Choose a learning section">
          {tiles.map(tile=><button type="button" key={tile.id} className={`warm-tile tint-${tile.tint}`} onClick={()=>tile.id==='letters'?setShowEarlyReading(true):tile.id==='phonics'?onChoosePhonemes():onChooseSection(tile.id as SectionId)} aria-describedby={`home-hint-${tile.id}`}>
            <HomeArt index={tile.art}/><span className="warm-tile-copy"><strong>{tile.title}</strong><span>{tile.audience}</span></span>
            <span id={`home-hint-${tile.id}`} className="home-sr-only">{tile.hint}{tile.count>0?` ${tile.count} ${tile.id==='words'?'words practised':'completed'}.`:''}</span>
          </button>)}
        </div>
      </div>
      <details className="warm-week">
        <summary><strong>🗓 <span>This week</span></strong><span className="warm-week-days">{week.map((day,i)=><span key={day.date} aria-label={`${day.date}: ${day.count} activities${day.isToday?', today':''}`}><small>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]}</small><i className={`${day.count?'active':''} ${day.isToday?'today':''}`}/></span>)}</span></summary>
        <p>Your activity over the past 12 weeks. {streakInfo.wordsReadToday > 0 ? `${streakInfo.wordsReadToday} words today.` : ''}</p><StudyHeatmap data={heatmapData}/>
      </details>
      <nav className="warm-utilities" aria-label="More ways to learn and parent tools">
        <button type="button" className="warm-utility tint-lilac" onClick={onChooseFlashcards}><span aria-hidden="true">▤</span><strong>Flashcards</strong><b aria-hidden="true">›</b></button>
        <button type="button" className="warm-utility tint-peach" onClick={onShowCloset}><HomeArt index={8}/><strong>Panda’s Room <small>({boxCount > 0 ? `${boxCount} boxes` : `${ownedCount} items`})</small></strong><b aria-hidden="true">›</b></button>
        <button type="button" className="warm-utility tint-sage" onClick={onShowSettings}><span aria-hidden="true">⚙</span><strong>Parent Settings</strong><b aria-hidden="true">›</b></button>
      </nav>
    </section>
  )
}

function HomeArt({index}:{index:number}) {
  return <span className="warm-art" aria-hidden="true" style={{backgroundImage:`url("${assetUrl('assets/home/panda-grid.webp')}")`,backgroundPosition:`${index%3*50}% ${Math.floor(index/3)*50}%`}}/>
}


function getPhonemeLearnedCount(): number {
  let count = 0
  for (let index = 0; index < progressStorage.length; index += 1) {
    const key = progressStorage.key(index)
    if (!key || !key.startsWith('chunky-reader:older-reader-phonemes:')) continue
    try {
      const parsed = JSON.parse(progressStorage.getItem(key) || '{}')
      if (Array.isArray(parsed.learnedIds)) count += parsed.learnedIds.length
    } catch {
      // Ignore malformed entries; the badge is decorative.
    }
  }
  return count
}

function SectionProgressBadge({ count }: { count: number }) {
  return (
    <div className={`section-progress-badge ${count === 0 ? 'is-new' : ''}`}>
      <span className="section-progress-text">{count === 0 ? 'New!' : `${count} done`}</span>
      <span className="section-progress-bar" aria-hidden="true">
        <span style={{ width: `${(count % 10) * 10}%` }} />
      </span>
    </div>
  )
}

function StudyHeatmap({ data }: { data: Array<{ date: string; count: number; dayOfWeek: number }> }) {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const todayStr = data.at(-1)?.date || ''

  const rows: Array<{ label: string; cells: Array<{ date: string; count: number; isToday: boolean }> }> = []
  for (let day = 0; day < 7; day++) {
    const cells = data.filter(d => d.dayOfWeek === day)
    rows.push({
      label: dayLabels[day],
      cells: cells.map(c => ({ date: c.date, count: c.count, isToday: c.date === todayStr })),
    })
  }

  function intensityClass(count: number): string {
    if (count === 0) return 'heatmap-empty'
    if (count <= 5) return 'heatmap-light'
    if (count <= 15) return 'heatmap-medium'
    return 'heatmap-heavy'
  }

  return (
    <div className="study-heatmap" aria-label="Study activity heatmap">
      <div className="heatmap-grid">
        {rows.map((row) => (
          <div key={row.label} className="heatmap-row">
            <span className="heatmap-day-label">{row.label}</span>
            {row.cells.map((cell) => (
              <div
                key={cell.date}
                className={`heatmap-cell ${intensityClass(cell.count)} ${cell.isToday ? 'heatmap-today' : ''}`}
                title={`${cell.date}: ${cell.count} words`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function sectionTitle(sectionId: SectionId) {
  return LEARNING_SECTIONS.find((section) => section.id === sectionId)?.title || 'Learning'
}

function continueDetail(state: ContinueLearningState, greenEggs?: GreenEggsProgress) {
  if (state.section === 'words' && state.deckId === 'annas-reading-deck') {
    return 'Blends, longer words, and a tiny sentence · about 3–4 minutes'
  }
  if (state.section === 'words' && greenEggs) {
    return `${greenEggs.mastered} of ${greenEggs.total} words to Green Eggs and Ham`
  }
  if (state.section === 'stories' && state.storyId) {
    return `Page ${(state.pageIndex ?? 0) + 1}`
  }
  if (typeof state.cardIndex === 'number') {
    return `Lesson ${Math.floor(state.cardIndex / 5) + 1}`
  }
  return 'Pick up where you left off'
}


type RoomTab = 'room' | 'boxes' | 'collection'

const ROOM_SLOTS: Array<{ slot: RewardSlot; emoji: string; label: string; top: string; left: string }> = [
  { slot: 'window',  emoji: '🪟', label: 'Window',  top: '1%',  left: '1%'  },
  { slot: 'ceiling', emoji: '✨', label: 'Ceiling',  top: '1%',  left: '36%' },
  { slot: 'door',    emoji: '🚪', label: 'Door',     top: '7%',  left: '79%' },
  { slot: 'wall',    emoji: '🖼️', label: 'Wall',     top: '22%', left: '76%' },
  { slot: 'shelf',   emoji: '📚', label: 'Shelf',    top: '38%', left: '69%' },
  { slot: 'cushion', emoji: '🛋️', label: 'Cushion',  top: '54%', left: '1%'  },
  { slot: 'desk',    emoji: '💡', label: 'Desk',     top: '54%', left: '76%' },
  { slot: 'rug',     emoji: '🏠', label: 'Rug',      top: '71%', left: '35%' },
]

export function PandaCloset({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState(() => loadProgress())
  const [tab, setTab] = useState<RoomTab>((progress.unopenedBoxes || 0) > 0 ? 'boxes' : 'room')
  const [result, setResult] = useState<{ drop: RewardDrop; item: RewardItem } | null>(null)
  const owned = getOwnedRewards(progress)
  const ownedBySlot = rewardsBySlot(owned)
  const unopenedBoxes = progress.unopenedBoxes || 0
  const sparkles = progress.sparklePoints || 0

  function persist(nextProgress: typeof progress) {
    setProgress(nextProgress)
    saveProgress(nextProgress)
  }

  function openBox() {
    const opened = openPandaBox(loadProgress())
    persist(opened.progress)
    if (opened.drop && opened.item) {
      setResult({ drop: opened.drop, item: opened.item })
      if (rarityRank(opened.item.rarity) >= rarityRank('rare')) {
        confetti({
          particleCount: opened.item.rarity === 'legendary' ? 120 : 70,
          spread: 70,
          origin: { y: 0.72 },
        })
      }
    }
  }

  function placeItem(item: RewardItem) {
    persist(equipReward(loadProgress(), item.id))
    setResult(null)
    setTab('room')
  }

  function equipItem(item: RewardItem) {
    persist(equipReward(loadProgress(), item.id))
    setTab('room')
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content sticker-book panda-closet">
        <button className="close-button" onClick={onClose}>Close</button>
        <div className="closet-header">
          <span className="prompt-topline">Panda rewards</span>
          <h2>Panda's Room</h2>
          <p>{progress.totalLessonsCompleted} lessons finished · {sparkles} ✨</p>
        </div>

        <div className="closet-tabs" role="tablist" aria-label="Panda Room sections">
          <button type="button" className={tab === 'room' ? 'active' : ''} onClick={() => setTab('room')}>Room</button>
          <button type="button" className={tab === 'boxes' ? 'active' : ''} onClick={() => setTab('boxes')}>Boxes {unopenedBoxes > 0 ? `(${unopenedBoxes})` : ''}</button>
          <button type="button" className={tab === 'collection' ? 'active' : ''} onClick={() => setTab('collection')}>Collection</button>
        </div>

        {result ? (
          <BoxResult
            item={result.item}
            drop={result.drop}
            onPlace={() => placeItem(result.item)}
            onDone={() => setResult(null)}
          />
        ) : tab === 'boxes' ? (
          <BoxesPanel unopenedBoxes={unopenedBoxes} onOpen={openBox} />
        ) : tab === 'collection' ? (
          <CollectionPanel owned={owned} onEquip={equipItem} />
        ) : (
          <RoomPanel progress={progress} ownedBySlot={ownedBySlot} onEquip={equipItem} />
        )}
      </div>
    </div>
  )
}

function BoxesPanel({ unopenedBoxes, onOpen }: { unopenedBoxes: number; onOpen: () => void }) {
  return (
    <div className="closet-panel boxes-panel">
      <div className={`panda-box ${unopenedBoxes > 0 ? 'ready' : ''}`} aria-hidden="true">
        <span>Box</span>
      </div>
      <h3>{unopenedBoxes > 0 ? 'You found a Panda Box!' : 'No Panda Boxes yet'}</h3>
      <p>{unopenedBoxes > 0 ? `${unopenedBoxes} waiting to open.` : 'Finish 3 lessons to find the next one.'}</p>
      <button type="button" className="path-start-button" onClick={onOpen} disabled={unopenedBoxes <= 0}>
        Open Box
      </button>
    </div>
  )
}

function BoxResult({
  item,
  drop,
  onPlace,
  onDone,
}: {
  item: RewardItem
  drop: RewardDrop
  onPlace: () => void
  onDone: () => void
}) {
  return (
    <div className={`box-result rarity-${item.rarity}`}>
      <span className="rarity-pill">{rarityLabel(item.rarity)}</span>
      <RewardBadge item={item} large />
      <h3>{drop.duplicate ? 'Sparkles!' : 'New item!'}</h3>
      <strong>{item.name}</strong>
      <p>{drop.duplicate ? `You found this one again. +${drop.sparklePointsGained} ✨` : item.description}</p>
      <div className="box-result-actions">
        {!drop.duplicate && <button type="button" className="path-start-button" onClick={onPlace}>Place It</button>}
        <button type="button" className="path-start-button secondary" onClick={onDone}>Done</button>
      </div>
    </div>
  )
}

function RoomPanel({
  progress,
  ownedBySlot,
  onEquip,
}: {
  progress: ReturnType<typeof loadProgress>
  ownedBySlot: Record<RewardSlot, RewardItem[]>
  onEquip: (item: RewardItem) => void
}) {
  const owned = getOwnedRewards(progress)
  const equipped = progress.equippedRewards || {}
  const [selectedSlot, setSelectedSlot] = useState<RewardSlot | null>(null)

  if (selectedSlot !== null) {
    const items = owned.filter(item => progress.roomPlacements?.[item.id] === selectedSlot || item.slot === selectedSlot)
    const slotInfo = ROOM_SLOTS.find(s => s.slot === selectedSlot)!
    const equippedId = equipped[selectedSlot]
    return (
      <div className="closet-panel room-slot-picker">
        <button type="button" className="room-back-button" onClick={() => setSelectedSlot(null)}>
          ← Back to Room
        </button>
        <h3>{slotInfo.emoji} {slotInfo.label}</h3>
        {items.length === 0 ? (
          <p className="room-empty-hint">Open Panda Boxes to find {slotInfo.label.toLowerCase()} decorations!</p>
        ) : (
          <div className="room-item-grid">
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                className={`room-item-card rarity-${item.rarity} ${equippedId === item.id ? 'selected' : ''}`}
                onClick={() => { onEquip(item); setSelectedSlot(null); }}
              >
                <RewardBadge item={item} />
                <strong>{item.name}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const equippedWindowId = equipped['window']
  const equippedWindow = equippedWindowId ? getRewardById(equippedWindowId) : undefined
  const bgSrc = equippedWindow?.id === 'garden-background'
    ? assetUrl(`assets/rewards/garden-background.webp`)
    : assetUrl(`assets/panda-room-bg.webp`)
  const equippedCount = Object.keys(progress.roomPlacements || {}).length

  return (
    <div className="room-scene-wrapper">
      <img
        src={bgSrc}
        alt="Panda's cosy room"
        className="room-scene-bg"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
      <div className="room-panda-mascot" aria-hidden="true">
        <img
          src={assetUrl('assets/profiles/anna-red-shirt.png')}
          alt=""
          className="room-panda-sprite"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <img
          src={assetUrl(`assets/profiles/sarah-reading.png`)}
          alt=""
          className="room-panda-sprite"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        {equippedCount >= 6 && <span className="room-panda-sparkle">✨</span>}
      </div>
      {ROOM_SLOTS.map(({ slot, emoji, label, top, left }) => {
        const equippedId = equipped[slot]
        const equippedItem = equippedId ? getRewardById(equippedId) : undefined
        const placedItems = owned.filter(item => progress.roomPlacements?.[item.id] === slot)
        const hasItems = ownedBySlot[slot].length > 0 || placedItems.length > 0
        return (
          <button
            key={slot}
            type="button"
            style={{ top, left }}
            className={`room-spot ${hasItems ? 'has-items' : 'locked'} ${placedItems.length ? 'equipped' : ''}`}
            onClick={() => setSelectedSlot(slot)}
            aria-label={placedItems.length ? `${label}: ${placedItems.map(item => item.name).join(", ")}` : label}
          >
            {placedItems.length > 0 ? (
              <span className="room-placed-items">
                {placedItems.slice(0, 4).map(item => <span key={item.id} title={item.name}><RewardBadge item={item} /></span>)}
                <span className="room-spot-name">{label} · {placedItems.length}</span>
              </span>
            ) : equippedItem ? (
              <>
                <RewardBadge item={equippedItem} />
                <span className="room-spot-name">{equippedItem.name}</span>
              </>
            ) : (
              <>
                <span className="room-spot-emoji" aria-hidden="true">{emoji}</span>
                <span className="room-spot-name">{label}</span>
                {hasItems && <span className="room-spot-dot" />}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

function CollectionPanel({ owned, onEquip }: { owned: RewardItem[]; onEquip: (item: RewardItem) => void }) {
  const rarities: RewardRarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common']
  return (
    <div className="closet-panel collection-panel">
      {owned.length === 0 ? (
        <p>Open Panda Boxes to start the collection.</p>
      ) : rarities.map((rarity) => {
        const items = owned.filter((item) => item.rarity === rarity)
        if (!items.length) return null
        return (
          <section key={rarity} className="collection-rarity-group">
            <h3>{rarityLabel(rarity)}</h3>
            <div className="reward-grid">
              {items.map((item) => (
                <button type="button" key={item.id} className={`reward-card rarity-${item.rarity}`} onClick={() => onEquip(item)}>
                  <RewardBadge item={item} />
                  <strong>{item.name}</strong>
                  <small>{slotLabel(item.slot)}</small>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function RewardBadge({ item, large = false }: { item: RewardItem; large?: boolean }) {
  return (
    <span
      className={`reward-badge rarity-${item.rarity} ${large ? 'large' : ''}`}
      style={{ backgroundColor: item.colorTheme }}
      aria-hidden="true"
    >
      <img src={rewardImageUrl(item)} alt="" onError={hideBrokenRewardImage} />
      <span>{item.badgeText}</span>
    </span>
  )
}

function rewardImageUrl(item: RewardItem) {
  return assetUrl(`assets/rewards/${item.id}.webp`)
}

function hideBrokenRewardImage(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none'
}

function rarityLabel(rarity: RewardRarity) {
  if (rarity === 'common') return 'Common'
  if (rarity === 'uncommon') return 'Uncommon'
  if (rarity === 'rare') return 'Rare'
  if (rarity === 'epic') return 'Epic'
  return 'Legendary'
}

function slotLabel(slot: RewardSlot) {
  const info = ROOM_SLOTS.find(s => s.slot === slot)
  return info ? `${info.emoji} ${info.label}` : slot
}
