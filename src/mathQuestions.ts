import type { LearningCard } from './types'
import type { MathDifficulty, MathOperation } from './mathProgress'

export const MATH_LIMITS: Record<MathDifficulty, number> = {
  easy: 5, medium: 10, hard: 15, 'very-hard': 20,
}

/** Generate fresh problems locally, without stored question decks or an account. */
export function generateMathCards(
  deckId: string,
  operation: MathOperation,
  difficulty: MathDifficulty,
  random: () => number = Math.random,
): LearningCard[] {
  const max = MATH_LIMITS[difficulty]
  const integer = (limit: number) => Math.floor(random() * limit)
  const candidates = { add: [] as [number, number][], subtract: [] as [number, number][] }
  for (let left = 0; left <= max; left++) {
    for (let right = 0; right <= max; right++) {
      candidates.add.push([left, right])
      if (left >= right) candidates.subtract.push([left, right])
    }
  }
  let previous = ''
  // A multiple of five preserves the existing lesson boundaries.
  return Array.from({ length: 100 }, (_, index) => {
    const op = operation === 'both' ? (random() < 0.5 ? 'add' : 'subtract') : operation
    const pool = candidates[op].filter(([a, b]) => `${op}:${a}:${b}` !== previous)
    const [left, right] = pool[integer(pool.length)]
    previous = `${op}:${left}:${right}`
    const answer = op === 'add' ? left + right : left - right
    const equation = `${left} ${op === 'add' ? '+' : '-'} ${right} = ?`
    const prompt = `${left} ${op === 'add' ? 'plus' : 'minus'} ${right}`
    const alternatives = Array.from({ length: (op === 'add' ? max * 2 : max) + 1 }, (_, n) => n)
      .filter((n) => n !== answer && Math.abs(n - answer) <= 5)
    const wrong = alternatives[integer(alternatives.length)]
    return {
      id: `random-math:${difficulty}:${index}:${previous}`,
      deckId, type: 'math', displayText: equation, equation,
      mathOperation: op, mathAnswer: answer,
      mathAnswerOptions: random() < 0.5 ? [answer, wrong] : [wrong, answer],
      mathPrompt: `What is ${prompt}?`, ttsText: `What is ${prompt}?`,
      mathQuestionKind: 'equation',
      mathVisualGroups: [left, right], mathVisualCount: left,
      mathRemovedCount: op === 'subtract' ? right : 0, mathObject: 'apple',
    }
  })
}
