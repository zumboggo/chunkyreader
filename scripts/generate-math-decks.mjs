import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OBJECTS = ['apples', 'stars', 'buttons', 'berries', 'shells', 'blocks']
const ADD_STORIES = [
  ({ a, b, object }) => `Panda has ${a} ${object}. A friend brings ${b} more. How many now?`,
  ({ a, b, object }) => `There are ${a} ${object} in one basket and ${b} in another. How many altogether?`,
  ({ a, b, object }) => `Panda counts ${a} ${object}, then finds ${b} more. How many does Panda count?`,
]
const SUB_STORIES = [
  ({ a, b, object }) => `Panda has ${a} ${object}. ${b} are eaten. How many are left?`,
  ({ a, b, object }) => `There are ${a} ${object}. ${b} roll away. How many stay?`,
  ({ a, b, object }) => `Panda sees ${a} ${object}. ${b} are taken away. How many remain?`,
]

// Simple random generator for generating somewhat consistent wrong answers
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function generateAdditionDeck() {
  const cards = []

  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      const answer = a + b
      const rng = mulberry32(a * 100 + b)
      const object = OBJECTS[(a + b) % OBJECTS.length]
      const kindCycle = (a + (b * 2)) % 4
      const questionKind = kindCycle === 0 ? 'equation' : kindCycle === 1 ? 'picture-add' : 'story-add'
      const story = ADD_STORIES[(a + b) % ADD_STORIES.length]({ a, b, object })
      let wrongAnswer = answer + (rng() > 0.5 ? 1 : -1)
      if (wrongAnswer < 0) wrongAnswer = answer + 1
      if (wrongAnswer === answer) wrongAnswer = answer + 2

      cards.push({
        id: `math-add-${a}-${b}`,
        type: 'math',
        displayText: `${a} + ${b} = ?`,
        equation: `${a} + ${b} = ?`,
        mathOperation: 'add',
        mathAnswer: answer,
        mathAnswerOptions: [answer, wrongAnswer].sort(() => rng() - 0.5),
        mathVisualGroups: [a, b],
        mathQuestionKind: questionKind,
        mathPrompt: questionKind === 'equation'
          ? `What is ${a} plus ${b}?`
          : questionKind === 'picture-add'
            ? `Count the ${object}. How many altogether?`
            : story,
        mathObject: object,
        mathStoryText: questionKind === 'story-add' ? story : '',
        speechCue: questionKind === 'equation'
          ? `What is ${a} plus ${b}?`
          : questionKind === 'picture-add'
            ? `Count the ${object}. ${a} plus ${b}. How many altogether?`
            : story,
        audio: `audio/math-addition/child-instructions-v1/add-${a}-${b}.mp3`,
        difficulty: Math.max(1, Math.ceil((a + b) / 3)),
        category: 'addition'
      })
    }
  }

  // Sort by difficulty roughly
  cards.sort((a, b) => a.difficulty - b.difficulty)
  return cards
}

function generateSubtractionDeck() {
  const cards = []
  
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= a; b++) {
      const answer = a - b
      const rng = mulberry32(a * 100 + b)
      const object = OBJECTS[(a + b + 2) % OBJECTS.length]
      const kindCycle = (a + (b * 3)) % 4
      const questionKind = kindCycle === 0 ? 'equation' : kindCycle === 1 ? 'picture-subtract' : 'story-subtract'
      const story = SUB_STORIES[(a + b) % SUB_STORIES.length]({ a, b, object })
      let wrongAnswer = answer + (rng() > 0.5 ? 1 : -1)
      if (wrongAnswer < 0) wrongAnswer = answer + 1
      if (wrongAnswer === answer) wrongAnswer = answer + 2

      cards.push({
        id: `math-sub-${a}-${b}`,
        type: 'math',
        displayText: `${a} - ${b} = ?`,
        equation: `${a} - ${b} = ?`,
        mathOperation: 'subtract',
        mathAnswer: answer,
        mathAnswerOptions: [answer, wrongAnswer].sort(() => rng() - 0.5),
        mathVisualCount: a,
        mathRemovedCount: b,
        mathQuestionKind: questionKind,
        mathPrompt: questionKind === 'equation'
          ? `What is ${a} minus ${b}?`
          : questionKind === 'picture-subtract'
            ? `${b} ${object} go away. How many are left?`
            : story,
        mathObject: object,
        mathStoryText: questionKind === 'story-subtract' ? story : '',
        speechCue: questionKind === 'equation'
          ? `What is ${a} minus ${b}?`
          : questionKind === 'picture-subtract'
            ? `${b} ${object} go away. How many are left?`
            : story,
        audio: `audio/math-subtraction/child-instructions-v1/sub-${a}-${b}.mp3`,
        difficulty: Math.max(1, Math.ceil(a / 2)),
        category: 'subtraction'
      })
    }
  }

  // Sort by difficulty roughly
  cards.sort((a, b) => a.difficulty - b.difficulty)
  return cards
}

async function main() {
  const addCards = generateAdditionDeck()
  const subCards = generateSubtractionDeck()

  const addDeck = {
    id: "math-addition-0-12",
    title: "Addition 0-12",
    description: "Learn to add numbers from 0 to 12.",
    type: "math",
    profile: "library",
    cards: addCards
  }

  const subDeck = {
    id: "math-subtraction-0-12",
    title: "Subtraction 0-12",
    description: "Learn to subtract numbers from 0 to 12.",
    type: "math",
    profile: "library",
    cards: subCards
  }

  const outAddPath = path.join(ROOT, 'public', 'decks', 'math-addition-0-12.json')
  const outSubPath = path.join(ROOT, 'public', 'decks', 'math-subtraction-0-12.json')

  await fs.writeFile(outAddPath, JSON.stringify(addDeck, null, 2), 'utf-8')
  await fs.writeFile(outSubPath, JSON.stringify(subDeck, null, 2), 'utf-8')

  console.log(`Generated ${addCards.length} addition facts to ${outAddPath}`)
  console.log(`Generated ${subCards.length} subtraction facts to ${outSubPath}`)
}

main().catch(console.error)
