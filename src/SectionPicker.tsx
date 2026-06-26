import { useState } from 'react'
import confetti from 'canvas-confetti'
import { LEARNING_SECTIONS } from './content/sections'
import {
  equipReward,
  getOwnedRewards,
  getRewardById,
  openPandaBox,
  rarityRank,
  rewardsBySlot,
} from './rewards'
import { getSectionProgress, loadProgress, saveProgress, getStreakInfo, getHeatmapData } from './progress'
import type { AppSettings } from './appSettings'
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
  onChooseFlashcards,
  onShowCloset,
  onShowSettings,
  onContinue,
  continueState,
  settings,
}: {
  onChooseSection: (id: SectionId) => void
  onChooseFlashcards: () => void
  onShowCloset: () => void
  onShowSettings: () => void
  onContinue: () => void
  continueState?: ContinueLearningState
  settings: AppSettings
}) {
  const progress = loadProgress()
  const ownedCount = getOwnedRewards(progress).length
  const boxCount = progress.unopenedBoxes || 0
  const streakInfo = getStreakInfo()
  const heatmapData = getHeatmapData()

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

      {continueState && (
        <button type="button" className="continue-card squish" onClick={onContinue}>
          <span className="continue-label">Continue</span>
          <strong>{continueState.label || sectionTitle(continueState.section)}</strong>
          <small>{continueDetail(continueState)}</small>
        </button>
      )}

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
            <strong>{section.title}</strong>
            <small>{section.subtitle}</small>
            {settings.showProgress && (
              <div className="section-progress-badge">
                {progressLabel(getSectionProgress(section.id))}
              </div>
            )}
          </button>
        ))}
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
  if (sectionId === 'sounds') return 'Sound'
  if (sectionId === 'words') return 'W'
  if (sectionId === 'stories') return 'Book'
  if (sectionId === 'math') return '2 + 3'
  if (sectionId === 'chinese') return '人'
  return ''
}

function sectionTitle(sectionId: SectionId) {
  return LEARNING_SECTIONS.find((section) => section.id === sectionId)?.title || 'Learning'
}

function continueDetail(state: ContinueLearningState) {
  if (state.section === 'stories' && state.storyId) {
    return `Page ${(state.pageIndex ?? 0) + 1}`
  }
  if (typeof state.cardIndex === 'number') {
    return `Lesson ${Math.floor(state.cardIndex / 5) + 1}`
  }
  return 'Pick up where you left off'
}

function progressLabel(count: number) {
  if (count === 0) return 'New'
  const stars = Math.min(5, Math.ceil(count / 3))
  return '⭐'.repeat(stars)
}

type RoomTab = 'room' | 'boxes' | 'collection'

const ROOM_SLOTS: Array<{ slot: RewardSlot; emoji: string; label: string }> = [
  { slot: 'window',  emoji: '🪟', label: 'Window'  },
  { slot: 'ceiling', emoji: '✨', label: 'Ceiling'  },
  { slot: 'wall',    emoji: '🖼️', label: 'Wall'     },
  { slot: 'shelf',   emoji: '📚', label: 'Shelf'    },
  { slot: 'cushion', emoji: '🛋️', label: 'Cushion'  },
  { slot: 'desk',    emoji: '💡', label: 'Desk'     },
  { slot: 'rug',     emoji: '🏠', label: 'Rug'      },
  { slot: 'door',    emoji: '🚪', label: 'Door'     },
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
          <p className="room-empty-hint">Open Panda Boxes to find {slotInfo.label.toLowerCase()} decorations.</p>
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
    <div className="closet-panel room-panel">
      <div className="room-panda-banner">
        <img
          src={`${import.meta.env.BASE_URL}assets/mascots/mascot-reading.png`}
          alt="Panda in their room"
          className="room-panda-img"
        />
        <p>Tap a spot to decorate Panda's room!</p>
      </div>
      <div className="room-grid">
        {ROOM_SLOTS.map(({ slot, emoji, label }) => {
          const equippedId = equipped[slot]
          const equippedItem = equippedId ? getRewardById(equippedId) : undefined
          const hasItems = ownedBySlot[slot].length > 0
          return (
            <button
              key={slot}
              type="button"
              className={`room-slot-tile ${hasItems ? 'has-items' : 'locked'} ${equippedItem ? 'equipped' : ''}`}
              onClick={() => setSelectedSlot(slot)}
            >
              {equippedItem ? (
                <>
                  <RewardBadge item={equippedItem} />
                  <span className="room-slot-name">{equippedItem.name}</span>
                </>
              ) : (
                <>
                  <span className="room-slot-emoji" aria-hidden="true">{emoji}</span>
                  <span className="room-slot-name">{label}</span>
                  {hasItems && <span className="room-slot-dot" aria-label="items available" />}
                </>
              )}
            </button>
          )
        })}
      </div>
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
