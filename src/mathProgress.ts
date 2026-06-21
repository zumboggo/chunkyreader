import type { LearningCard } from './types'

export type MathOperation = 'add' | 'subtract'
export type MathDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard'

export const MATH_DIFFICULTIES: MathDifficulty[] = ['easy', 'medium', 'hard', 'very-hard']

export const MATH_DIFFICULTY_DETAILS: Record<MathDifficulty, { title: string; description: string }> = {
  easy: { title: 'Easy', description: 'Add or take away 0, 1, or 2 with numbers to 6.' },
  medium: { title: 'Medium', description: 'Practice all facts using numbers to 6.' },
  hard: { title: 'Hard', description: 'Practice all facts using numbers to 10.' },
  'very-hard': { title: 'Very Hard', description: 'Practice every fact using numbers to 12.' },
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
  return cards.filter((card) => {
    if (card.mathOperation !== operation) return false
    const operands = mathOperands(card)
    if (!operands) return false
    const [left, right] = operands
    if (operation === 'subtract' && right > left) return false

    if (difficulty === 'easy') {
      return operation === 'add'
        ? left <= 6 && right <= 6 && (left <= 2 || right <= 2)
        : left <= 6 && right <= 2
    }
    if (difficulty === 'medium') return left <= 6 && right <= 6
    if (difficulty === 'hard') return left <= 10 && right <= 10
    return left <= 12 && right <= 12
  })
}

function mathOperands(card: LearningCard): [number, number] | undefined {
  const match = (card.equation || card.displayText).match(/(\d+)\s*[+-]\s*(\d+)/u)
  if (!match) return undefined
  return [Number(match[1]), Number(match[2])]
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
