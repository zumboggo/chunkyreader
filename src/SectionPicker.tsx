
import { LEARNING_SECTIONS } from './content/sections'
import { loadProgress, getSectionProgress } from './progress'
import { getAllUnlockedRewards } from './rewards'
import type { SectionId } from './types'

export function SectionPicker({
  onChooseSection,
  onShowCloset
}: {
  onChooseSection: (id: SectionId) => void
  onShowCloset: () => void
}) {
  const progress = loadProgress()

  return (
    <section className="home-screen">
      <div className="home-copy">
        <div>
          <h1>Chunky Learner</h1>
          <p>What would you like to learn today?</p>
        </div>
      </div>
      <div className="path-grid section-grid" aria-label="Choose a learning section">
        {LEARNING_SECTIONS.map(section => (
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
            <div className="section-progress-badge">
              {getSectionProgress(section.id)} lessons completed
            </div>
          </button>
        ))}
      </div>
      <div style={{display: 'flex', justifyContent: 'center', marginTop: '1rem'}}>
        <button className="sticker-nav-button squish" style={{fontSize: '1.2rem', padding: '0.75rem 1.5rem'}} onClick={onShowCloset}>
          🎒 Panda Closet ({progress.unlockedRewards.length || getAllUnlockedRewards(progress.totalLessonsCompleted).length} unlocked)
        </button>
      </div>
    </section>
  )
}

function sectionBadge(sectionId: SectionId) {
  if (sectionId === 'letters') return 'Aa'
  if (sectionId === 'sounds') return ')))'
  if (sectionId === 'words') return '▣'
  if (sectionId === 'stories') return '▰'
  if (sectionId === 'math') return '2 + 3'
  if (sectionId === 'chinese') return '人'
  return ''
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
        <div className="sticker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
          {unlocked.map(reward => (
            <div key={reward.id} className="sticker-item" style={{ padding: '1rem', background: '#f0f0f0', borderRadius: '12px', textAlign: 'center' }}>
              <span className="sticker-emoji" style={{ fontSize: '2rem' }}>{reward.emoji}</span>
              <strong style={{ display: 'block', marginTop: '0.5rem' }}>{reward.name}</strong>
            </div>
          ))}
          {unlocked.length === 0 && <p>Keep learning to unlock items!</p>}
        </div>
      </div>
    </div>
  )
}
