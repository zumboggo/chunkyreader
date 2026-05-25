import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const deckPath = path.join(root, 'public', 'decks', 'sarah-letters-level-1.json')
const defaultOutDir = path.join(root, 'public', 'decks', 'sarah-levels', 'images')
const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell'
const token = process.env.REPLICATE_API_TOKEN
const count = Number(process.env.LETTER_IMAGE_COUNT || process.argv.find((arg) => arg.startsWith('--count='))?.split('=')[1] || 10)
const force = process.argv.includes('--force') || process.env.FORCE_IMAGE_GENERATION === 'true'

if (!token) {
  console.error('Set REPLICATE_API_TOKEN before running this script.')
  process.exit(1)
}

const deck = JSON.parse(await fs.readFile(deckPath, 'utf8'))
const cards = deck.cards.slice(0, count)
await fs.mkdir(defaultOutDir, { recursive: true })

const results = []
for (const card of cards) {
  const word = card.exampleWord
  const outputFile = path.join(defaultOutDir, `${slug(word)}.png`)
  const prompt = [
    `A cute kawaii sticker illustration of ${subjectFor(card)}.`,
    'One centered object only, soft pastel colors, rounded shapes, joyful friendly expression, plain clean background.',
    'Toddler reading app asset, high clarity, simple icon composition.',
    'No text anywhere, no words, no captions, no labels, no spelling, no watermark, no poster, no flashcard border.',
  ].join(' ')

  if (force || !(await exists(outputFile))) {
    console.log(`Generating ${word}...`)
    const imageUrl = await createPrediction(prompt)
    const image = await fetch(imageUrl)
    if (!image.ok) throw new Error(`Could not download ${word}: ${image.status}`)
    await fs.writeFile(outputFile, Buffer.from(await image.arrayBuffer()))
  } else {
    console.log(`Keeping ${word}...`)
  }
  results.push({
    id: card.id,
    word,
    prompt,
    image: path.relative(path.join(root, 'public'), outputFile).replaceAll(path.sep, '/'),
  })
}

await fs.writeFile(
  path.join(defaultOutDir, 'replicate-flux-schnell-test-manifest.json'),
  JSON.stringify(
    {
      model,
      createdAt: new Date().toISOString(),
      count: results.length,
      style: 'cute kawaii chibi toddler reading app flashcard',
      images: results,
    },
    null,
    2,
  ) + '\n',
)

console.log(`Generated ${results.length} images in ${path.relative(root, defaultOutDir)}.`)

async function createPrediction(prompt) {
  const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: '1:1',
        output_format: 'png',
        output_quality: 90,
        num_outputs: 1,
        go_fast: true,
        num_inference_steps: 4,
      },
    }),
  })

  const prediction = await response.json()
  if (!response.ok) {
    throw new Error(`Replicate request failed: ${prediction.detail || response.status}`)
  }

  if (prediction.status === 'failed' || prediction.error) {
    throw new Error(`Replicate prediction failed: ${prediction.error || 'unknown error'}`)
  }

  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
  if (typeof output === 'string') return output

  throw new Error(`Replicate prediction did not return an image URL. Status: ${prediction.status}`)
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function article(value) {
  return /^[aeiou]/i.test(value) ? 'an' : 'a'
}

function subjectFor(card) {
  const word = card.exampleWord
  const letter = card.uppercase
  
  // Custom subjects for tricky words
  if (word === 'jam') return `an open glass jar filled with red strawberry jam, whose shape explicitly forms the letter ${letter}`
  if (word === 'hat') return `a soft winter hat, whose shape explicitly forms the letter ${letter}`
  if (word === 'queen') return `a smiling queen character with a tiny crown and a plain dress, whose shape explicitly forms the letter ${letter}`
  if (word === 'umbrella') return `a cheerful open umbrella with a smiling face, whose shape explicitly forms the letter ${letter}`
  if (word === 'van') return `a small rounded toy van, whose shape explicitly forms the letter ${letter}`
  if (word === 'fox') return `a friendly orange fox, whose shape explicitly forms the letter ${letter}`
  if (word === 'yak') return `a cute fluffy yak, whose shape explicitly forms the letter ${letter}`
  
  return `${article(word)} ${word}, whose shape explicitly forms the letter ${letter}`
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
