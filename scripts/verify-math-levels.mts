import assert from 'node:assert/strict'
import { generateMathCards, MATH_LIMITS } from '../src/mathQuestions.ts'
import { MATH_DIFFICULTIES, type MathOperation } from '../src/mathProgress.ts'

// Seeded randomness makes the checks reproducible; production uses Math.random.
let seed = 817
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 4294967296
}
for (const operation of ['add', 'subtract', 'both'] satisfies MathOperation[]) {
  for (const level of MATH_DIFFICULTIES) {
    const max = MATH_LIMITS[level]
    const samples = Array.from({ length: 20 }, () => generateMathCards('test', operation, level, random)).flat()
    const answers = new Set<number>()
    const operations = new Set<string>()
    const operands = new Set<number>()
    for (const card of samples) {
      const [left, right] = card.mathVisualGroups!
      assert(left >= 0 && left <= max && right >= 0 && right <= max)
      operands.add(left); operands.add(right)
      const expected = card.mathOperation === 'add' ? left + right : left - right
      assert.equal(card.mathAnswer, expected)
      assert(expected >= 0)
      assert.equal(card.mathAnswerOptions!.length, 2)
      assert.equal(new Set(card.mathAnswerOptions).size, 2)
      assert(card.mathAnswerOptions!.includes(expected))
      assert(card.mathAnswerOptions!.every((n) => n >= 0))
      if (operation !== 'both') assert.equal(card.mathOperation, operation)
      answers.add(expected); operations.add(card.mathOperation!)
    }
    assert.equal(operands.size, max + 1, 'The entire operand range should be reachable')
    assert(answers.size > max, 'Answers should cover a broad range')
    if (operation === 'both') assert.equal(operations.size, 2)
    const first = generateMathCards('test', operation, level, random)
    const second = generateMathCards('test', operation, level, random)
    assert.notDeepEqual(first.map(c => c.equation), second.map(c => c.equation))
    for (let i = 1; i < first.length; i++) assert.notEqual(first[i].equation, first[i - 1].equation)
    const values = first.map(c => c.mathAnswer!)
    assert(values.some((n, i) => i > 0 && n < values[i - 1]))
    assert(values.some((n, i) => i > 0 && n > values[i - 1]))
  }
}
console.log('Verified 24,000 randomized problems across all operations and operand limits.')
