import fs from 'node:fs'
import path from 'node:path'
import {
  filterMathCards,
  MATH_DIFFICULTIES,
  type MathDifficulty,
  type MathOperation,
} from '../src/mathProgress.ts'
import type { LearningCard } from '../src/types.ts'

const root = process.cwd()

const decks: Record<MathOperation, LearningCard[]> = {
  add: readCards('math-addition-0-12.json'),
  subtract: readCards('math-subtraction-0-12.json'),
}

const expectedFirstLessons: Record<MathOperation, Record<MathDifficulty, string[]>> = {
  add: {
    easy: ['1 + 1 = ?', '1 + 2 = ?', '2 + 1 = ?', '2 + 2 = ?', '1 + 3 = ?'],
    medium: ['3 + 4 = ?', '4 + 3 = ?', '2 + 5 = ?', '5 + 2 = ?', '4 + 4 = ?'],
    hard: ['5 + 6 = ?', '6 + 5 = ?', '4 + 7 = ?', '7 + 4 = ?', '3 + 8 = ?'],
    'very-hard': ['9 + 10 = ?', '10 + 9 = ?', '8 + 11 = ?', '11 + 8 = ?', '7 + 12 = ?'],
  },
  subtract: {
    easy: ['2 - 1 = ?', '3 - 1 = ?', '3 - 2 = ?', '4 - 1 = ?', '4 - 2 = ?'],
    medium: ['6 - 2 = ?', '6 - 3 = ?', '6 - 4 = ?', '7 - 2 = ?', '7 - 3 = ?'],
    hard: ['9 - 3 = ?', '9 - 4 = ?', '9 - 5 = ?', '9 - 6 = ?', '9 - 7 = ?'],
    'very-hard': ['11 - 4 = ?', '11 - 5 = ?', '11 - 6 = ?', '11 - 7 = ?', '11 - 8 = ?'],
  },
}

const errors: string[] = []

for (const operation of ['add', 'subtract'] satisfies MathOperation[]) {
  for (const difficulty of MATH_DIFFICULTIES) {
    const pool = filterMathCards(decks[operation], operation, difficulty)
    const firstLesson = pool.slice(0, 5).map((card) => card.equation)
    const expected = expectedFirstLessons[operation][difficulty]

    if (pool.length < 10) {
      errors.push(`${operation} ${difficulty}: expected at least two full lessons, found ${pool.length} cards`)
    }
    if (JSON.stringify(firstLesson) !== JSON.stringify(expected)) {
      errors.push(
        `${operation} ${difficulty}: first lesson was ${JSON.stringify(firstLesson)}, expected ${JSON.stringify(expected)}`,
      )
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Verified four distinct math levels and their first lessons.')

function readCards(fileName: string): LearningCard[] {
  const deckPath = path.join(root, 'public', 'decks', fileName)
  return JSON.parse(fs.readFileSync(deckPath, 'utf8')).cards as LearningCard[]
}
