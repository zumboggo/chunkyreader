import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const storyFile = path.join(root, 'public', 'stories', 'anne-stories.json')
const args = process.argv.slice(2)
const dryRun = hasFlag('dry-run')
const force = hasFlag('force')
const limit = readNumberArg('limit')
const storyFilter = readStringArg('story')
const format = readStringArg('format') || 'webp'
const provider = process.env.IMAGE_PROVIDER || 'replicate'
const model = process.env.IMAGE_MODEL || 'black-forest-labs/flux-schnell'
const token = process.env.REPLICATE_API_TOKEN

if (provider !== 'replicate') {
  console.error(`Unsupported IMAGE_PROVIDER "${provider}". This script currently supports "replicate".`)
  process.exit(1)
}

if (!dryRun && !token) {
  console.error('Set REPLICATE_API_TOKEN before generating story images. Dry runs do not need a token.')
  process.exit(1)
}

const stories = JSON.parse(await fs.readFile(storyFile, 'utf8'))
const pages = []
let changed = false

for (const story of stories) {
  if (storyFilter && story.id !== storyFilter) continue
  for (const page of story.pages ?? []) {
    if (!page.imagePrompt) continue
    const appPath = `stories/anne/images/${story.id}-page-${page.pageNumber}.${format}`
    if (page.image !== appPath) {
      page.image = appPath
      changed = true
    }
    pages.push({ story, page, appPath, outputPath: path.join(root, 'public', appPath) })
  }
}

const selectedPages = Number.isFinite(limit) ? pages.slice(0, Math.max(0, limit)) : pages
let skipped = 0
let generated = 0

console.log(`Story image generation`)
console.log(`Model: ${model}`)
console.log(`Pages selected: ${selectedPages.length} of ${pages.length}`)
if (dryRun) console.log('Dry run: no images will be generated.\n')

for (const item of selectedPages) {
  const { story, page, appPath, outputPath } = item
  const existsAlready = await exists(outputPath)

  if (dryRun) {
    console.log(`${story.title} - page ${page.pageNumber}`)
    console.log(`  path: ${appPath}`)
    console.log(`  prompt: ${page.imagePrompt}`)
    if (page.negativePrompt) console.log(`  negative: ${page.negativePrompt}`)
    console.log('')
    continue
  }

  if (existsAlready && !force) {
    console.log(`Skipping existing image: ${appPath}`)
    skipped += 1
    continue
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  console.log(`Generating ${story.id} page ${page.pageNumber}...`)
  const imageUrl = await createPrediction(page.imagePrompt)
  await downloadImage(imageUrl, outputPath)
  console.log(`Saved ${appPath}`)
  generated += 1
}

if (changed && !dryRun) {
  await fs.writeFile(storyFile, `${JSON.stringify(stories, null, 2)}\n`)
  console.log('Updated story image paths in public/stories/anne-stories.json.')
}

console.log(`Done. Generated ${generated}, skipped ${skipped}.`)

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
        aspect_ratio: '4:3',
        output_format: format,
        output_quality: 82,
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

  const finished = prediction.status === 'starting' || prediction.status === 'processing'
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
  for (let attempt = 0; attempt < 18; attempt += 1) {
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

async function downloadImage(url, outputPath) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download generated image: ${response.status}`)
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
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
