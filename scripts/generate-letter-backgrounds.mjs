import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const dataPath = path.join(root, 'public', 'decks', 'sarah-letter-images.json')
const args = process.argv.slice(2)
const dryRun = hasFlag('dry-run')
const force = hasFlag('force')
const limit = readNumberArg('limit')
const letterFilter = readStringArg('letter')?.toUpperCase()
const provider = process.env.IMAGE_PROVIDER || 'replicate'
const model = process.env.IMAGE_MODEL || 'ideogram-ai/ideogram-v3-balanced'
const token = process.env.REPLICATE_API_TOKEN

if (provider !== 'replicate') {
  console.error(`Unsupported IMAGE_PROVIDER "${provider}". This script currently supports "replicate".`)
  process.exit(1)
}

if (!dryRun && !token) {
  console.error('Set REPLICATE_API_TOKEN before generating letter backgrounds. Dry runs do not need a token.')
  process.exit(1)
}

const data = JSON.parse(await fs.readFile(dataPath, 'utf8'))
const allCards = (data.cards ?? []).filter((card) => !letterFilter || card.letter === letterFilter)
const cards = Number.isFinite(limit) ? allCards.slice(0, Math.max(0, limit)) : allCards

let generated = 0
let skipped = 0

console.log('Sarah letter background generation')
console.log(`Model: ${model}`)
console.log(`Cards selected: ${cards.length} of ${(data.cards ?? []).length}`)
if (dryRun) console.log('Dry run: no images will be generated.\n')

for (const card of cards) {
  const appPath = card.backgroundImage
  const outputPath = path.join(root, 'public', appPath)

  if (dryRun) {
    console.log(`${card.letter} - ${card.keyword}`)
    console.log(`  path: ${appPath}`)
    console.log(`  prompt: ${card.imagePrompt}`)
    if (card.negativePrompt) console.log(`  negative: ${card.negativePrompt}`)
    console.log('')
    continue
  }

  if ((await exists(outputPath)) && !force) {
    console.log(`Skipping existing background: ${appPath}`)
    skipped += 1
    continue
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  console.log(`Generating ${card.letter} - ${card.keyword}...`)
  const imageUrl = await createPrediction(card)
  await downloadAndConvertImage(imageUrl, outputPath)
  console.log(`Saved ${appPath}`)
  generated += 1
}

console.log(`Done. Generated ${generated}, skipped ${skipped}.`)

async function createPrediction(card) {
  const prompt = withNegativePrompt(card.imagePrompt, card.negativePrompt)
  const primaryInput = {
    prompt,
    aspect_ratio: '1:1',
    magic_prompt_option: 'Off',
  }

  try {
    return await runPrediction(primaryInput)
  } catch (error) {
    if (!/magic_prompt_option|invalid|schema|input/iu.test(String(error?.message))) throw error
    console.warn('Retrying with minimal Ideogram input after schema rejection.')
    return runPrediction({ prompt, aspect_ratio: '1:1' })
  }
}

async function runPrediction(input) {
  const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ input }),
  })

  const prediction = await response.json()
  if (!response.ok) {
    throw new Error(`Replicate request failed: ${prediction.detail || response.status}`)
  }

  const finished = ['starting', 'processing'].includes(prediction.status)
    ? await pollPrediction(prediction)
    : prediction

  if (finished.status === 'failed' || finished.error) {
    throw new Error(`Replicate prediction failed: ${finished.error || 'unknown error'}`)
  }

  return extractImageUrl(finished.output)
}

async function pollPrediction(prediction) {
  const getUrl = prediction.urls?.get
  if (!getUrl) return prediction
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const response = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const next = await response.json()
    if (!response.ok) throw new Error(`Replicate polling failed: ${next.detail || response.status}`)
    if (!['starting', 'processing'].includes(next.status)) return next
  }
  throw new Error('Replicate prediction timed out.')
}

function extractImageUrl(output) {
  const first = Array.isArray(output) ? output[0] : output
  if (typeof first === 'string') return first
  if (first && typeof first.url === 'string') return first.url
  throw new Error('Replicate prediction did not return an image URL.')
}

async function downloadAndConvertImage(url, outputPath) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download generated image: ${response.status}`)
  const input = Buffer.from(await response.arrayBuffer())
  const sharp = (await import('sharp')).default
  await sharp(input).resize(1024, 1024, { fit: 'cover' }).webp({ quality: 88 }).toFile(outputPath)
}

function withNegativePrompt(prompt, negativePrompt) {
  if (!negativePrompt) return prompt
  return `${prompt} Avoid: ${negativePrompt}.`
}

function hasFlag(name) {
  return args.includes(`--${name}`)
}

function readStringArg(name) {
  const equalsArg = args.find((arg) => arg.startsWith(`--${name}=`))
  if (equalsArg) return equalsArg.split('=').slice(1).join('=')
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

function readNumberArg(name) {
  const value = readStringArg(name)
  return value ? Number(value) : Number.NaN
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
