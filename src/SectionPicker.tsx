import { LEARNING_SECTIONS } from './content/sections'
import { getAllUnlockedRewards } from './rewards'
import { getSectionProgress, loadProgress } from './progress'
import type { AppSettings } from './appSettings'
import type { SectionId } from './types'

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
  onShowCloset,
  onShowSettings,
  onContinue,
  continueState,
  settings,
}: {
  onChooseSection: (id: SectionId) => void
  onShowCloset: () => void
  onShowSettings: () => void
  onContinue: () => void
  continueState?: ContinueLearningState
  settings: AppSettings
}) {
  const progress = loadProgress()
  const unlockedCount = progress.unlockedRewards.length || getAllUnlockedRewards(progress.totalLessonsCompleted).length

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

      <div className="dashboard-parent-actions" aria-label="Parent tools">
        <button type="button" className="sticker-nav-button squish" onClick={onShowCloset}>
          Panda Closet ({unlockedCount})
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

export function PandaCloset({ onClose }: { onClose: () => void }) {
  const progress = loadProgress()
  const unlocked = getAllUnlockedRewards(progress.totalLessonsCompleted)

  return (
    <div className="modal-overlay">
      <div className="modal-content sticker-book">
        <button className="close-button" onClick={onClose}>Close</button>
        <h2>Panda Closet</h2>
        <p>You have completed {progress.totalLessonsCompleted} lessons!</p>
        <div className="sticker-grid">
          {unlocked.map((reward) => (
            <div key={reward.id} className="sticker-item">
              <span className="sticker-emoji">{reward.emoji}</span>
              <strong>{reward.name}</strong>
            </div>
          ))}
          {unlocked.length === 0 && <p>Keep learning to unlock items!</p>}
        </div>
      </div>
    </div>
  )
}
