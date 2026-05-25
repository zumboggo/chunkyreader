import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const deckPath = path.join(root, 'public', 'decks', 'sarah-letters-level-1.json')
const defaultOutDir = path.join(root, 'public', 'decks', 'sarah-levels', 'images')
const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell'
const token = process.env.REPLICATE_API_TOKEN
const force = process.argv.includes('--force') || process.env.FORCE_IMAGE_GENERATION === 'true'

if (!token) {
  console.error('Set REPLICATE_API_TOKEN before running this script.')
  process.exit(1)
}

const deck = JSON.parse(await fs.readFile(deckPath, 'utf8'))
const countArg = process.argv.find((arg) => arg.startsWith('--count='))?.split('=')[1]
const count = countArg || process.env.LETTER_IMAGE_COUNT ? Number(countArg || process.env.LETTER_IMAGE_COUNT) : deck.cards.length
const cards = deck.cards.slice(0, count)
await fs.mkdir(defaultOutDir, { recursive: true })

const results = []
for (const card of cards) {
  const word = card.exampleWord
  const letter = card.lowercase
  const outputFile = path.join(defaultOutDir, `${slug(word)}.png`)
  const prompt = [
    `A cute kawaii toddler reading app sticker illustration.`,
    `In the foreground, there is a large, bold, clean, solid black lowercase letter '${letter}'.`,
    `In the background, directly behind the letter, there is ${subjectFor(card)}.`,
    `The background illustration's shape matches and flows along the exact curves of the foreground black letter '${letter}'.`,
    `Soft pastel colors, rounded shapes, plain clean solid white background, toddler-friendly, simple icon composition, high clarity.`,
    `No other text or words, no captions, no labels.`,
  ].join(' ')

  if (force || !(await exists(outputFile))) {
    console.log(`Generating ${word} for letter '${letter}'...`)
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
      style: 'cute kawaii chibi toddler reading app flashcard with bold letter overlay',
      images: results,
    },
    null,
    2,
  ) + '\n',
)

console.log(`Generated ${results.length} images in ${path.relative(root, defaultOutDir)}.`);

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

function subjectFor(card) {
  const word = card.exampleWord
  const letter = card.lowercase
  
  const descriptions = {
    'm': 'a green mountain range with dual peaks that curve like the arches of a lowercase m',
    's': 'a cute green snake coiling and curving along the exact curves of a lowercase s',
    'a': 'a stylized red arrow looping around to form the circular body and stem of a lowercase a',
    't': 'a tall tree with a straight brown trunk and a horizontal green branch forming a crossbar, shaped like a lowercase t',
    'p': 'a friendly pelican with a round head and a long beak pointing right, with a straight vertical body, shaped like a lowercase p',
    'c': 'a fuzzy green caterpillar curved in a semi-circle shape like a lowercase c',
    'r': 'a shiny red ribbon curving up and arching to the right like a lowercase r',
    'n': 'a pearl necklace dangling in a single arch like a lowercase n',
    'd': 'a cute long-necked dinosaur with a round body on the left and a tall vertical neck on the right, shaped like a lowercase d',
    'i': 'a tiny green inchworm standing straight with a single round leaf floating above it, shaped like a lowercase i',
    'f': 'a graceful pink flamingo with a curved neck bending forward and a horizontal wing, shaped like a lowercase f',
    'b': 'a cute butterfly with a straight vertical body on the left and rounded wings on the right, shaped like a lowercase b',
    'h': 'a friendly horse standing with a straight front leg and a curved back arching down, shaped like a lowercase h',
    'g': 'a white goose with a round head, curved neck, and a loop below forming the tail, shaped like a lowercase g',
    'o': 'a round bright orange fruit forming a perfect circle like a lowercase o',
    'l': 'a long green lizard standing straight vertically like a lowercase l',
    'k': 'a cute kangaroo with a straight vertical back and legs branching out, shaped like a lowercase k',
    'e': 'a slippery blue eel coiled in a loop with its head crossing over, shaped like a lowercase e',
    'u': 'a cup-like open umbrella forming the deep curve of a lowercase u',
    'w': 'a long pink worm wiggling up and down to form the double-curves of a lowercase w',
    'j': 'a colorful jellyfish with a curved hook-like body and tentacles, shaped like a lowercase j',
    'y': 'a cute yak with a v-shaped head and a long tail extending down to the right, shaped like a lowercase y',
    'v': 'a green mountain valley dipping down to a sharp point in the center like a lowercase v',
    'z': 'a striped zebra zigzagging to form the sharp corners of a lowercase z',
    'q': 'a cute round quail with a small topknot feather on its head, standing on the left of a straight vertical line, shaped like a lowercase q',
    'x': 'two crossed wooden mallets forming the diagonal lines of a lowercase x'
  }
  
  return descriptions[letter] || `a cute ${word} whose shape explicitly forms the letter ${letter}`
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
