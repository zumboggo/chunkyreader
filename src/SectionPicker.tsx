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
import { getSectionProgress, loadProgress, saveProgress } from './progress'
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

  return (
    <section className="home-screen">
      <div className="home-copy">
        <div>
          <h1>Chunky Learner</h1>
          <p>What would you like to learn today?</p>
        </div>
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
          Panda Closet ({boxCount > 0 ? `${boxCount} boxes` : `${ownedCount} items`})
        </button>
        <button type="button" className="settings-nav-button squish" onClick={onShowSettings}>
          Parent Settings
        </button>
      </div>
    </section>
  )
}

function sectionBadge(sectionId: SectionId) {
  if (sectionId === 'letters') return 'Aa'
  if (sectionId === 'sounds') return 'Sound'
  if (sectionId === 'words') return 'W'
  if (sectionId === 'stories') return 'Book'
  if (sectionId === 'math') return '2 + 3'
  if (sectionId === 'chinese') return '\u4eba'
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
  if (count === 1) return '1 lesson'
  return `${count} lessons`
}

type ClosetTab = 'outfit' | 'boxes' | 'collection'

export function PandaCloset({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState(() => loadProgress())
  const [tab, setTab] = useState<ClosetTab>((progress.unopenedBoxes || 0) > 0 ? 'boxes' : 'outfit')
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

  function wearItem(item: RewardItem) {
    persist(equipReward(progress, item.id))
    setResult(null)
    setTab('outfit')
  }

  function equipItem(item: RewardItem) {
    persist(equipReward(progress, item.id))
    setTab('outfit')
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content sticker-book panda-closet">
        <button className="close-button" onClick={onClose}>Close</button>
        <div className="closet-header">
          <span className="prompt-topline">Panda rewards</span>
          <h2>Panda Closet</h2>
          <p>{progress.totalLessonsCompleted} lessons finished · {sparkles} Sparkles</p>
        </div>

        <div className="closet-tabs" role="tablist" aria-label="Panda Closet sections">
          <button type="button" className={tab === 'outfit' ? 'active' : ''} onClick={() => setTab('outfit')}>Outfit</button>
          <button type="button" className={tab === 'boxes' ? 'active' : ''} onClick={() => setTab('boxes')}>Boxes {unopenedBoxes > 0 ? `(${unopenedBoxes})` : ''}</button>
          <button type="button" className={tab === 'collection' ? 'active' : ''} onClick={() => setTab('collection')}>Collection</button>
        </div>

        {result ? (
          <BoxResult
            item={result.item}
            drop={result.drop}
            onWear={() => wearItem(result.item)}
            onDone={() => setResult(null)}
          />
        ) : tab === 'boxes' ? (
          <BoxesPanel unopenedBoxes={unopenedBoxes} onOpen={openBox} />
        ) : tab === 'collection' ? (
          <CollectionPanel owned={owned} onEquip={equipItem} />
        ) : (
          <OutfitPanel progress={progress} ownedBySlot={ownedBySlot} onEquip={equipItem} />
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
  onWear,
  onDone,
}: {
  item: RewardItem
  drop: RewardDrop
  onWear: () => void
  onDone: () => void
}) {
  return (
    <div className={`box-result rarity-${item.rarity}`}>
      <span className="rarity-pill">{rarityLabel(item.rarity)}</span>
      <RewardBadge item={item} large />
      <h3>{drop.duplicate ? 'Sparkles!' : 'New item!'}</h3>
      <strong>{item.name}</strong>
      <p>{drop.duplicate ? `You found this one again. +${drop.sparklePointsGained} Sparkles!` : item.description}</p>
      <div className="box-result-actions">
        {!drop.duplicate && <button type="button" className="path-start-button" onClick={onWear}>Wear It</button>}
        <button type="button" className="path-start-button secondary" onClick={onDone}>Done</button>
      </div>
    </div>
  )
}

function OutfitPanel({
  progress,
  ownedBySlot,
  onEquip,
}: {
  progress: ReturnType<typeof loadProgress>
  ownedBySlot: Record<RewardSlot, RewardItem[]>
  onEquip: (item: RewardItem) => void
}) {
  const equipped = progress.equippedRewards || {}
  const equippedItems = Object.values(equipped).map((id) => getRewardById(id)).filter(Boolean) as RewardItem[]

  return (
    <div className="closet-panel outfit-panel">
      <div className="panda-preview-card">
        <div className="panda-preview-stage">
          {equippedItems.filter((item) => item.slot === 'background').map((item) => (
            <span key={item.id} className="preview-background" style={{ backgroundColor: item.colorTheme }} />
          ))}
          <img src={`${import.meta.env.BASE_URL}assets/mascots/mascot-reading.png`} alt="Panda wearing rewards" />
          {equippedItems.filter((item) => item.slot !== 'background').map((item) => (
            <span
              key={item.id}
              className={`preview-accessory slot-${item.slot} rarity-${item.rarity}`}
              style={{ backgroundColor: item.colorTheme }}
            >
              {item.badgeText}
            </span>
          ))}
        </div>
        <p>{equippedItems.length ? 'Panda is ready to learn!' : 'Choose an item for Panda to wear.'}</p>
      </div>

      <div className="outfit-slot-list">
        {(Object.keys(ownedBySlot) as RewardSlot[]).map((slot) => (
          <div className="outfit-slot" key={slot}>
            <strong>{slotLabel(slot)}</strong>
            <div className="mini-reward-row">
              {ownedBySlot[slot].length ? ownedBySlot[slot].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`mini-reward ${equipped[slot] === item.id ? 'selected' : ''}`}
                  onClick={() => onEquip(item)}
                  title={item.name}
                >
                  {item.badgeText}
                </button>
              )) : <small>Find a {slotLabel(slot).toLowerCase()} item.</small>}
            </div>
          </div>
        ))}
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
      {item.badgeText}
    </span>
  )
}

function rarityLabel(rarity: RewardRarity) {
  if (rarity === 'common') return 'Common'
  if (rarity === 'uncommon') return 'Uncommon'
  if (rarity === 'rare') return 'Rare'
  if (rarity === 'epic') return 'Epic'
  return 'Legendary'
}

function slotLabel(slot: RewardSlot) {
  if (slot === 'head') return 'Head'
  if (slot === 'face') return 'Face'
  if (slot === 'neck') return 'Neck'
  if (slot === 'body') return 'Body'
  if (slot === 'back') return 'Back'
  if (slot === 'hand') return 'Charm'
  if (slot === 'sticker') return 'Sticker'
  return 'Background'
}
