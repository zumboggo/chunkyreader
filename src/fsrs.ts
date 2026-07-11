export type CardState = 'new' | 'learning' | 'review' | 'relearning'
export type Rating = 1 | 2 | 3 | 4

export interface FlashcardState {
  cardId: string
  deckId: string
  state: CardState
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  last_review?: number
}

export interface SchedulingResult {
  card: FlashcardState
  interval: number
}

const DEFAULT_PARAMS = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61,
]

const REQUEST_RETENTION = 0.9
const MAXIMUM_INTERVAL = 36500

export function createNewCard(cardId: string, deckId: string): FlashcardState {
  return {
    cardId,
    deckId,
    state: 'new',
    due: Date.now(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
  }
}

export function scheduleCard(card: FlashcardState, rating: Rating, now = Date.now()): SchedulingResult {
  const elapsed_days = card.last_review ? (now - card.last_review) / (24 * 60 * 60 * 1000) : 0
  const new_state = { ...card, elapsed_days, last_review: now }

  if (card.state === 'new') {
    return scheduleNew(new_state, rating, now)
  }
  if (card.state === 'learning' || card.state === 'relearning') {
    return scheduleLearning(new_state, rating, now)
  }
  return scheduleReview(new_state, rating, now)
}

function scheduleNew(card: FlashcardState, rating: Rating, now: number): SchedulingResult {
  const difficulty = initDifficulty(rating)
  const stability = initStability(rating)

  if (rating === 1) {
    return {
      card: {
        ...card,
        state: 'learning',
        due: now + 60 * 1000,
        stability,
        difficulty,
        scheduled_days: 0,
        reps: card.reps + 1,
      },
      interval: 1,
    }
  }

  if (rating === 4) {
    const interval = nextInterval(stability)
    return {
      card: {
        ...card,
        state: 'review',
        due: now + interval * 24 * 60 * 60 * 1000,
        stability,
        difficulty,
        scheduled_days: interval,
        reps: card.reps + 1,
      },
      interval,
    }
  }

  return {
    card: {
      ...card,
      state: 'learning',
      due: now + 10 * 60 * 1000,
      stability,
      difficulty,
      scheduled_days: 0,
      reps: card.reps + 1,
    },
    interval: 1,
  }
}

function scheduleLearning(card: FlashcardState, rating: Rating, now: number): SchedulingResult {
  const difficulty = nextDifficulty(card.difficulty, rating)
  const stability = nextStability(card.stability, card.difficulty, card.elapsed_days, rating, card.state === 'relearning')

  if (rating === 1) {
    return {
      card: {
        ...card,
        state: card.state === 'learning' ? 'learning' : 'relearning',
        due: now + 60 * 1000,
        stability,
        difficulty,
        scheduled_days: 0,
        reps: card.reps + 1,
        lapses: card.lapses + (card.state === 'review' ? 1 : 0),
      },
      interval: 1,
    }
  }

  if (rating === 4) {
    const interval = nextInterval(stability)
    return {
      card: {
        ...card,
        state: 'review',
        due: now + interval * 24 * 60 * 60 * 1000,
        stability,
        difficulty,
        scheduled_days: interval,
        reps: card.reps + 1,
      },
      interval,
    }
  }

  const interval = rating === 3 ? Math.max(1, Math.round(stability)) : 1
  return {
    card: {
      ...card,
      state: 'learning',
      due: now + interval * 24 * 60 * 60 * 1000,
      stability,
      difficulty,
      scheduled_days: interval,
      reps: card.reps + 1,
    },
    interval,
  }
}

function scheduleReview(card: FlashcardState, rating: Rating, now: number): SchedulingResult {
  const difficulty = nextDifficulty(card.difficulty, rating)
  const stability = nextStability(card.stability, card.difficulty, card.elapsed_days, rating, false)

  if (rating === 1) {
    return {
      card: {
        ...card,
        state: 'relearning',
        due: now + 10 * 60 * 1000,
        stability,
        difficulty,
        scheduled_days: 0,
        reps: card.reps + 1,
        lapses: card.lapses + 1,
      },
      interval: 1,
    }
  }

  const interval = nextInterval(stability, rating)
  return {
    card: {
      ...card,
      state: 'review',
      due: now + interval * 24 * 60 * 60 * 1000,
      stability,
      difficulty,
      scheduled_days: interval,
      reps: card.reps + 1,
    },
    interval,
  }
}

function initDifficulty(rating: Rating): number {
  return DEFAULT_PARAMS[4] - Math.exp(DEFAULT_PARAMS[5] * (rating - 1)) + 1
}

function initStability(rating: Rating): number {
  return Math.max(0.1, DEFAULT_PARAMS[rating - 1])
}

function nextDifficulty(d: number, rating: Rating): number {
  const delta_d = -DEFAULT_PARAMS[6] * (rating - 3)
  const new_d = d + delta_d * (10 - d) / 9
  return Math.min(Math.max(new_d, 1), 10)
}

function nextStability(s: number, d: number, elapsed_days: number, rating: Rating, is_relearning: boolean): number {
  if (rating === 1) {
    return recallPenalty(s, d, elapsed_days)
  }
  if (is_relearning) {
    return relearningStability(s, d, elapsed_days)
  }
  return recallStability(s, d, elapsed_days, rating)
}

function recallStability(s: number, d: number, elapsed_days: number, rating: Rating): number {
  const hard_penalty = rating === 2 ? DEFAULT_PARAMS[15] : 1
  const easy_bonus = rating === 4 ? DEFAULT_PARAMS[16] : 1
  return s * (1 + Math.exp(DEFAULT_PARAMS[8]) * (11 - d) * Math.pow(s, -DEFAULT_PARAMS[9]) * (Math.exp((1 - REQUEST_RETENTION) * elapsed_days / s) - 1) * hard_penalty * easy_bonus)
}

function recallPenalty(s: number, d: number, elapsed_days: number): number {
  return Math.max(0.1, DEFAULT_PARAMS[11] * Math.pow(d, -DEFAULT_PARAMS[12]) * (Math.pow(s + 1, DEFAULT_PARAMS[13]) - 1) * Math.exp((1 - REQUEST_RETENTION) * elapsed_days / s))
}

function relearningStability(s: number, d: number, elapsed_days: number): number {
  return Math.max(0.1, DEFAULT_PARAMS[11] * Math.pow(d, -DEFAULT_PARAMS[12]) * (Math.pow(s + 1, DEFAULT_PARAMS[13]) - 1) * Math.exp((1 - REQUEST_RETENTION) * elapsed_days / s))
}

function nextInterval(stability: number, rating?: Rating): number {
  const interval = Math.round((stability / REQUEST_RETENTION - stability) * Math.log(REQUEST_RETENTION))
  const hard_cap = rating === 2 ? 1 : Infinity
  return Math.min(Math.max(1, Math.round(interval)), MAXIMUM_INTERVAL, hard_cap)
}

export function isCardDue(card: FlashcardState, now = Date.now()): boolean {
  return card.due <= now
}

export function sortCardsByDue(cards: FlashcardState[]): FlashcardState[] {
  return [...cards].sort((a, b) => {
    if (a.state === 'new' && b.state !== 'new') return 1
    if (b.state === 'new' && a.state !== 'new') return -1
    return a.due - b.due
  })
}

export function getDueCards(cards: FlashcardState[], now = Date.now()): FlashcardState[] {
  return cards.filter((card) => isCardDue(card, now))
}
