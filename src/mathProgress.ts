import type { LearningCard } from './types'

export type MathOperation = 'add' | 'subtract'
export type MathDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard'

export const MATH_DIFFICULTIES: MathDifficulty[] = ['easy', 'medium', 'hard', 'very-hard']

export const MATH_DIFFICULTY_DETAILS: Record<
  MathDifficulty,
  { title: string; icon: string; shortName: string; descriptions: Record<MathOperation, string> }
> = {
  easy: {
    title: 'Beginner',
    icon: '🟢',
    shortName: 'Green',
    descriptions: {
      add: 'Count and add two small groups up to 6.',
      subtract: 'Take away 1 or 2 from small numbers.',
    },
  },
  medium: {
    title: 'Intermediate',
    icon: '🟦',
    shortName: 'Blue',
    descriptions: {
      add: 'Add numbers with totals from 7 to 10.',
      subtract: 'Take 2 or more away from numbers 6 to 8.',
    },
  },
  hard: {
    title: 'Advanced',
    icon: '♦',
    shortName: 'Diamond',
    descriptions: {
      add: 'Cross 10 — totals from 11 to 18.',
      subtract: 'Take 3 or more away from 9 and 10.',
    },
  },
  'very-hard': {
    title: 'Expert',
    icon: '♦♦',
    shortName: 'Double',
    descriptions: {
      add: 'Large numbers — totals from 19 to 24.',
      subtract: 'Take 4 or more away from 11 and 12.',
    },
  },
}

interface MathProgress {
  version: 1
  operation: MathOperation
  difficulty: MathDifficulty
  indexes: Record<string, number>
}

const STORAGE_KEY = 'chunky-learner:math-progress:v1'

const DEFAULT_PROGRESS: MathProgress = {
  version: 1,
  operation: 'add',
  difficulty: 'easy',
  indexes: {},
}

export function loadMathProgress(): MathProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROGRESS, indexes: {} }
    const parsed = JSON.parse(raw) as Partial<MathProgress>
    return {
      version: 1,
      operation: parsed.operation === 'subtract' ? 'subtract' : 'add',
      difficulty: MATH_DIFFICULTIES.includes(parsed.difficulty as MathDifficulty)
        ? parsed.difficulty as MathDifficulty
        : 'easy',
      indexes: parsed.indexes && typeof parsed.indexes === 'object' ? parsed.indexes : {},
    }
  } catch {
    return { ...DEFAULT_PROGRESS, indexes: {} }
  }
}

export function saveMathSelection(operation: MathOperation, difficulty: MathDifficulty) {
  const progress = loadMathProgress()
  progress.operation = operation
  progress.difficulty = difficulty
  saveMathProgress(progress)
}

export function loadMathIndex(operation: MathOperation, difficulty: MathDifficulty, poolSize: number): number {
  if (poolSize <= 0) return 0
  const stored = loadMathProgress().indexes[mathProgressKey(operation, difficulty)] ?? 0
  return Math.max(0, Math.min(stored, poolSize - 1))
}

export function saveMathIndex(operation: MathOperation, difficulty: MathDifficulty, index: number) {
  const progress = loadMathProgress()
  progress.operation = operation
  progress.difficulty = difficulty
  progress.indexes[mathProgressKey(operation, difficulty)] = Math.max(0, index)
  saveMathProgress(progress)
}

export function filterMathCards(
  cards: LearningCard[],
  operation: MathOperation,
  difficulty: MathDifficulty,
): LearningCard[] {
  return cards
    .filter((card) => {
      if (card.mathOperation !== operation) return false
      const operands = mathOperands(card)
      return operands ? matchesMathDifficulty(operation, difficulty, operands) : false
    })
    .sort((leftCard, rightCard) => compareMathCards(leftCard, rightCard, operation))
}

function mathOperands(card: LearningCard): [number, number] | undefined {
  const match = (card.equation || card.displayText).match(/(\d+)\s*[+-]\s*(\d+)/u)
  if (!match) return undefined
  return [Number(match[1]), Number(match[2])]
}

function matchesMathDifficulty(
  operation: MathOperation,
  difficulty: MathDifficulty,
  [left, right]: [number, number],
) {
  if (operation === 'subtract') {
    if (right > left) return false
    if (difficulty === 'easy') {
      return left >= 2 && left <= 6 && right >= 1 && (right <= 2 || right === left)
    }
    if (difficulty === 'medium') {
      return left >= 6 && left <= 8 && right >= 2 && right <= left - 2
    }
    if (difficulty === 'hard') {
      return left >= 9 && left <= 10 && right >= 3 && right < left
    }
    return left >= 11 && left <= 12 && right >= 4
  }

  const total = left + right
  if (difficulty === 'easy') {
    return left >= 1 && right >= 1 && total <= 6
  }
  if (difficulty === 'medium') {
    return left >= 2 && right >= 2 && total >= 7 && total <= 10
  }
  if (difficulty === 'hard') {
    return left >= 3 && right >= 3 && left <= 10 && right <= 10 && total >= 11 && total <= 18
  }
  return left >= 7 && right >= 7 && total >= 19 && total <= 24
}

function compareMathCards(leftCard: LearningCard, rightCard: LearningCard, operation: MathOperation) {
  const leftOperands = mathOperands(leftCard)
  const rightOperands = mathOperands(rightCard)
  if (!leftOperands || !rightOperands) return 0

  const [leftA, leftB] = leftOperands
  const [rightA, rightB] = rightOperands

  if (operation === 'subtract') {
    const leftMakesZero = Number(leftA === leftB)
    const rightMakesZero = Number(rightA === rightB)
    return leftMakesZero - rightMakesZero || leftA - rightA || leftB - rightB
  }

  return (leftA + leftB) - (rightA + rightB)
    || Math.abs(leftA - leftB) - Math.abs(rightA - rightB)
    || leftA - rightA
}

function mathProgressKey(operation: MathOperation, difficulty: MathDifficulty) {
  return `${operation}:${difficulty}`
}

function saveMathProgress(progress: MathProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    window.dispatchEvent(new CustomEvent('chunkyReaderProgressChanged', { detail: { changedAt: Date.now() } }))
  } catch {
    // Math lessons remain usable when storage is unavailable.
  }
}
