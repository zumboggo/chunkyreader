const MILESTONE_STEP = 10

/**
 * The one progress visual for the Words section: a panda walks a path toward
 * the Green Eggs and Ham book. `compact` renders the strip-only variant used
 * on the home Words card; the full variant adds heading and counts.
 */
export function GreenEggsJourney({
  mastered,
  total,
  compact = false,
}: {
  mastered: number
  total: number
  compact?: boolean
}) {
  const safeTotal = Math.max(1, total)
  const progress = Math.min(1, Math.max(0, mastered / safeTotal))
  const frame = (mastered % 3) + 1
  const complete = mastered >= safeTotal
  const milestones: number[] = []
  for (let value = MILESTONE_STEP; value < safeTotal; value += MILESTONE_STEP) {
    milestones.push(value)
  }

  return (
    <div
      className={`green-eggs-journey ${compact ? 'compact' : ''} ${complete ? 'complete' : ''}`}
      aria-label={complete
        ? 'All book words learned — ready to read Green Eggs and Ham!'
        : `${mastered} of ${safeTotal} Green Eggs and Ham words learned`}
    >
      {!compact && (
        <div className="green-eggs-heading">
          <strong>{complete ? 'You can read Green Eggs and Ham!' : 'Road to Green Eggs and Ham'}</strong>
          <span>{mastered} / {safeTotal} words</span>
        </div>
      )}
      <div className="green-eggs-path" aria-hidden="true">
        <span className="green-eggs-path-line" />
        <span className="green-eggs-path-fill" style={{ width: `${progress * 100}%` }} />
        {milestones.map((value) => (
          <span
            key={value}
            className={`green-eggs-milestone ${mastered >= value ? 'reached' : ''}`}
            style={{ left: `${(value / safeTotal) * 100}%` }}
          >
            {mastered >= value ? '⭐' : '·'}
          </span>
        ))}
        <img
          src={`${import.meta.env.BASE_URL}assets/100-lessons/panda-walk-${frame}.png`}
          alt=""
          className="green-eggs-walker"
          style={{ left: `${progress * 100}%` }}
        />
        <img
          src={`${import.meta.env.BASE_URL}assets/green-eggs-goal.png`}
          alt=""
          className="green-eggs-goal-img"
        />
      </div>
      {compact && (
        <span className="green-eggs-compact-count">
          {complete ? 'Ready to read the book!' : `${mastered}/${safeTotal} book words`}
        </span>
      )}
    </div>
  )
}
