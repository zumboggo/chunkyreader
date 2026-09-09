export type MathOperation = 'add' | 'subtract' | 'both'
export type MathDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard'

export const MATH_DIFFICULTIES: MathDifficulty[] = ['easy', 'medium', 'hard', 'very-hard']

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
      operation: parsed.operation === 'subtract' || parsed.operation === 'both' ? parsed.operation : 'add',
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
