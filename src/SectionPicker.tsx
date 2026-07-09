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
import { GreenEggsJourney } from './GreenEggsJourney'
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
  const progress = loadProgress()
  const ownedCount = getOwnedRewards(progress).length
  const boxCount = progress.unopenedBoxes || 0
  const streakInfo = getStreakInfo()
  const heatmapData = getHeatmapData()
  const phonemesLearned = getPhonemeLearnedCount()

  return (
    <section className="home-screen">
      <div className="home-copy">
        <div>
          <h1>Chunky Learner</h1>
          <p>What would you like to learn today?</p>
        </div>
      </div>

      <div className={`streak-badge ${streakInfo.currentStreak === 0 ? 'streak-empty' : ''}`}>
        <span className="streak-flame" aria-hidden="true">{streakInfo.currentStreak > 0 ? '🔥' : '⭐'}</span>
        <span className="streak-count">{streakInfo.currentStreak}</span>
        <span className="streak-label">{streakInfo.currentStreak === 1 ? 'day streak' : streakInfo.currentStreak > 0 ? 'day streak' : 'Start your streak!'}</span>
        {streakInfo.wordsReadToday > 0 && (
          <span className="streak-words-today">{streakInfo.wordsReadToday} words today</span>
        )}
      </div>

      <button type="button" className="continue-hero squish" onClick={continueState ? onContinue : () => onChooseSection(LEARNING_SECTIONS[0]?.id ?? 'letters')}>
        {continueState?.section === 'words' ? (
          <img
            className="continue-hero-art"
            src={`${import.meta.env.BASE_URL}assets/green-eggs-goal.png`}
            alt=""
            aria-hidden="true"
          />
        ) : (
          <span className="continue-hero-emoji" aria-hidden="true">{continueState ? '🚀' : '🌟'}</span>
        )}
        <span className="continue-hero-text">
          <span className="continue-hero-label">{continueState ? 'Keep going!' : 'Start learning!'}</span>
          <strong>{continueState ? (continueState.label || sectionTitle(continueState.section)) : 'Tap here to begin'}</strong>
          {continueState && <small>{continueDetail(continueState, greenEggs)}</small>}
        </span>
        <span className="continue-hero-arrow" aria-hidden="true">▶</span>
      </button>

      <PandaBoxPath
        totalLessons={progress.totalLessonsCompleted}
        unopenedBoxes={boxCount}
        onOpenBoxes={onShowCloset}
      />

      <div className="path-grid section-grid" aria-label="Choose a learning section">
        {LEARNING_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className="path-card"
            style={{ backgroundColor: section.color }}
            onClick={() => onChooseSection(section.id)}
          >
            <div className="section-image-container">
              <img className="section-image" src={`${import.meta.env.BASE_URL}${section.image}`} alt="" />
              <span className={`section-visual-badge badge-${section.id}`} aria-hidden="true">
                {sectionBadge(section.id)}
              </span>
            </div>
            <span className="section-audience-pill">{section.eyebrow}</span>
            <strong>{section.title}</strong>
            <small>{section.subtitle}</small>
            <p className="section-helper">{section.helper}</p>
            <div className="section-card-footer">
              <span>{section.pocket}</span>
              <span>{section.cta}</span>
            </div>
            {section.id === 'words' ? (
              <GreenEggsJourney mastered={greenEggs.mastered} total={greenEggs.total} compact />
            ) : (
              <SectionProgressBadge count={getSectionProgress(section.id)} />
            )}
          </button>
        ))}
        <button
          type="button"
          className="path-card phonics-card"
          style={{ backgroundColor: '#e8f4e0' }}
          onClick={onChoosePhonemes}
        >
          <div className="section-image-container">
            <span className="section-visual-badge badge-sounds" aria-hidden="true">th</span>
          </div>
          <span className="section-audience-pill">Older reader</span>
          <strong>Phonics</strong>
          <small>Sounds and spellings</small>
          <p className="section-helper">Practice the sounds inside words.</p>
          <div className="section-card-footer">
            <span>Sound pocket</span>
            <span>Practice</span>
          </div>
          <SectionProgressBadge count={phonemesLearned} />
        </button>
      </div>

      <StudyHeatmap data={heatmapData} />

      <div className="flashcard-shortcut" aria-label="Spaced repetition flashcards">
        <button type="button" className="flashcard-shortcut-button squish" onClick={onChooseFlashcards}>
          <span className="flashcard-icon" aria-hidden="true">Cards</span>
          <div>
            <strong>Flashcards</strong>
            <small>Spaced repetition review</small>
          </div>
        </button>
      </div>

      <div className="dashboard-parent-actions" aria-label="Parent tools">
        <button type="button" className="sticker-nav-button squish" onClick={onShowCloset}>
          Panda's Room ({boxCount > 0 ? `${boxCount} boxes` : `${ownedCount} items`})
        </button>
        <button type="button" className="settings-nav-button squish" onClick={onShowSettings}>
          Parent Settings
        </button>
      </div>
    </section>
  )
}

function getPhonemeLearnedCount(): number {
  let count = 0
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || !key.startsWith('chunky-reader:older-reader-phonemes:')) continue
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}')
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

function PandaBoxPath({
  totalLessons,
  unopenedBoxes,
  onOpenBoxes,
}: {
  totalLessons: number
  unopenedBoxes: number
  onOpenBoxes: () => void
}) {
  const stepsDone = totalLessons % BOX_CADENCE
  const stepsLeft = BOX_CADENCE - stepsDone
  return (
    <button type="button" className="box-path-strip squish" onClick={onOpenBoxes} aria-label={unopenedBoxes > 0 ? `${unopenedBoxes} Panda Boxes ready to open` : `${stepsLeft} more lessons until the next Panda Box`}>
      <span className="box-path-steps" aria-hidden="true">
        {Array.from({ length: BOX_CADENCE }, (_, index) => (
          <span key={index} className={`box-path-paw ${index < stepsDone ? 'done' : ''}`}>
            🐾
          </span>
        ))}
        <span className={`box-path-box ${unopenedBoxes > 0 ? 'ready' : ''}`}>🎁</span>
      </span>
      <span className="box-path-text">
        {unopenedBoxes > 0
          ? `${unopenedBoxes > 1 ? `${unopenedBoxes} Panda Boxes are` : 'A Panda Box is'} waiting — tap to open!`
          : `${stepsLeft} more ${stepsLeft === 1 ? 'lesson' : 'lessons'} to your next Panda Box`}
      </span>
    </button>
  )
}

function StudyHeatmap({ data }: { data: Array<{ date: string; count: number; dayOfWeek: number }> }) {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const todayStr = new Date().toISOString().slice(0, 10)

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

function sectionBadge(sectionId: SectionId) {
  if (sectionId === 'letters') return 'Aa'
  if (sectionId === 'sounds') return 'sh'
  if (sectionId === 'words') return 'W'
  if (sectionId === 'stories') return 'Book'
  if (sectionId === 'math') return '1+2'
  if (sectionId === 'chinese') return 'Ren'
  return ''
}

function sectionTitle(sectionId: SectionId) {
  return LEARNING_SECTIONS.find((section) => section.id === sectionId)?.title || 'Learning'
}

function continueDetail(state: ContinueLearningState, greenEggs?: GreenEggsProgress) {
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
    const opened = openPandaBox(progress)
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
    persist(equipReward(progress, item.id))
    setResult(null)
    setTab('room')
  }

  function equipItem(item: RewardItem) {
    persist(equipReward(progress, item.id))
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
  const equipped = progress.equippedRewards || {}
  const [selectedSlot, setSelectedSlot] = useState<RewardSlot | null>(null)

  if (selectedSlot !== null) {
    const items = ownedBySlot[selectedSlot]
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

  return (
    <div className="room-scene-wrapper">
      <img
        src={`${import.meta.env.BASE_URL}assets/panda-room-bg.webp`}
        alt="Panda's cosy room"
        className="room-scene-bg"
      />
      {ROOM_SLOTS.map(({ slot, emoji, label, top, left }) => {
        const equippedId = equipped[slot]
        const equippedItem = equippedId ? getRewardById(equippedId) : undefined
        const hasItems = ownedBySlot[slot].length > 0
        return (
          <button
            key={slot}
            type="button"
            style={{ top, left }}
            className={`room-spot ${hasItems ? 'has-items' : 'locked'} ${equippedItem ? 'equipped' : ''}`}
            onClick={() => setSelectedSlot(slot)}
            aria-label={equippedItem ? `${label}: ${equippedItem.name}` : label}
          >
            {equippedItem ? (
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
  return `${import.meta.env.BASE_URL}assets/rewards/${item.id}.webp`
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
