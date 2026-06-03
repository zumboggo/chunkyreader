import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const args = process.argv.slice(2)
const dryRun = hasFlag('dry-run')
const force = hasFlag('force')
const limit = readNumberArg('limit')
const sectionFilter = readStringArg('section')
const provider = process.env.IMAGE_PROVIDER || 'replicate'
const model = process.env.IMAGE_MODEL || 'ideogram-ai/ideogram-v3-balanced'
const token = process.env.REPLICATE_API_TOKEN

const style = [
  'Original premium children’s storybook illustration',
  'gentle watercolor and gouache textures',
  'warm cozy lighting',
  'soft rounded shapes',
  'beautiful uncluttered composition for a children’s learning app',
  'text-free app section artwork',
  'leave a clean area for an app-rendered badge overlay',
  'no text, no letters, no numbers, no equations, no symbols, no logo, no watermark, no signature',
].join(', ')

const sections = [
  {
    id: 'letters',
    prompt: `${style}. A friendly panda explores a meadow with blank wooden blocks and blank alphabet-card shapes, flowers and sunshine, joyful letter-learning mood. The blocks and cards must be completely blank with no readable marks.`,
  },
  {
    id: 'sounds',
    prompt: `${style}. A friendly panda listens happily to birds, bells, and soft colorful sound waves floating through a sunny garden. Use abstract sound ribbons and blank speech bubbles only, with no marks inside them.`,
  },
  {
    id: 'words',
    prompt: `${style}. A friendly panda sits at a cozy low table with picture cards showing simple objects like apple, cat, sun, and tree. All cards are image-only and completely blank of words.`,
  },
  {
    id: 'stories',
    prompt: `${style}. A friendly panda opens a glowing storybook in a cozy reading nook, with tiny castles, forests, clouds, and warm light rising from the pages. The book pages contain no writing.`,
  },
  {
    id: 'math',
    prompt: `${style}. A friendly panda counts apples, buttons, and small wooden counters in two neat groups on a soft mat. The blocks and counters contain no numbers, equations, or marks.`,
  },
  {
    id: 'chinese',
    prompt: `${style}. A friendly panda holds a calligraphy brush beside bamboo, lanterns, ink stone, and blank practice cards. The lanterns and cards are completely blank with no Chinese characters or writing.`,
  },
]

if (provider !== 'replicate') {
  console.error(`Unsupported IMAGE_PROVIDER "${provider}". Use "replicate".`)
  process.exit(1)
}

if (!dryRun && !token) {
  console.error('Set REPLICATE_API_TOKEN before generating section images. Dry runs do not need a token.')
  process.exit(1)
}

let selected = sections
if (sectionFilter) selected = selected.filter((section) => section.id === sectionFilter)
if (Number.isFinite(limit)) selected = selected.slice(0, Math.max(0, limit))

const outDir = path.join(root, 'public', 'assets', 'sections')
await fs.mkdir(outDir, { recursive: true })

console.log('Section image generation')
console.log(`Model: ${model}`)
console.log(`Sections selected: ${selected.length} of ${sections.length}`)
if (dryRun) console.log('Dry run: no images will be generated.\n')

let generated = 0
let skipped = 0

for (const section of selected) {
  const outPath = path.join(outDir, `${section.id}.webp`)
  const existsAlready = await exists(outPath)

  if (dryRun) {
    console.log(`${section.id}: ${section.prompt}\n`)
    continue
  }

  if (existsAlready && !force) {
    console.log(`Skipping existing image: ${path.relative(root, outPath)}`)
    skipped += 1
    continue
  }

  console.log(`Generating ${section.id}...`)
  const imageUrl = await createPrediction(section.prompt)
  await downloadImage(imageUrl, outPath)
  console.log(`Saved ${path.relative(root, outPath)}`)
  generated += 1
}

console.log(`Done. Generated ${generated}, skipped ${skipped}.`)

async function createPrediction(prompt) {
  const isIdeogram = model.includes('ideogram-ai/')
  const input = isIdeogram
    ? {
        prompt,
        aspect_ratio: '1:1',
        magic_prompt_option: 'Off',
      }
    : {
        prompt,
        aspect_ratio: '1:1',
        output_format: 'webp',
        output_quality: 90,
        num_outputs: 1,
      }

  try {
    return await runPrediction(input)
  } catch (error) {
    if (!isIdeogram || !/magic_prompt_option|invalid|schema|input/iu.test(String(error?.message))) throw error
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
  if (!response.ok) throw new Error(`Replicate request failed: ${prediction.detail || response.status}`)
  const finished = ['starting', 'processing'].includes(prediction.status) ? await pollPrediction(prediction) : prediction
  if (finished.status === 'failed' || finished.error) {
    throw new Error(`Replicate prediction failed: ${finished.error || 'unknown error'}`)
  }
  return extractImageUrl(finished.output)
}

async function pollPrediction(prediction) {
  const getUrl = prediction.urls?.get
  if (!getUrl) return prediction
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const response = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } })
    const next = await response.json()
    if (!response.ok) throw new Error(`Replicate polling failed: ${next.detail || response.status}`)
    if (!['starting', 'processing'].includes(next.status)) return next
  }
  throw new Error('Replicate prediction timed out.')
}

function extractImageUrl(output) {
  const first = Array.isArray(output) ? output[0] : output
  if (typeof first === 'string') return first
  if (first && typeof first.url === 'function') return first.url()
  if (first && typeof first.url === 'string') return first.url
  throw new Error('Replicate prediction did not return an image URL.')
}

async function downloadImage(url, outPath) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download image: ${response.status}`)
  const input = Buffer.from(await response.arrayBuffer())
  await sharp(input).resize(1024, 1024, { fit: 'cover' }).webp({ quality: 90 }).toFile(outPath)
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
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
  if (value === undefined) return Number.NaN
  const number = Number(value)
  return Number.isFinite(number) ? number : Number.NaN
}
