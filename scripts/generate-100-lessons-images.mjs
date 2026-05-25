import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const lessonsDir = path.join(root, 'public', '100-lessons')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const format = 'webp'
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

const files = await fs.readdir(lessonsDir)
const jsonFiles = files.filter(f => f.startsWith('lesson-') && f.endsWith('.json'))

let skipped = 0
let generated = 0

console.log(`100 Lessons image generation`)
console.log(`Model: ${model}`)
if (dryRun) console.log('Dry run: no images will be generated.\n')

for (const file of jsonFiles) {
  const filePath = path.join(lessonsDir, file)
  const content = JSON.parse(await fs.readFile(filePath, 'utf8'))

  for (const chunk of content.chunks) {
    if (chunk.type === 'story-gauntlet' && chunk.imagePrompt) {
      const appPath = `100-lessons/${chunk.imagePath}`
      const outputPath = path.join(root, 'public', appPath)
      const existsAlready = await exists(outputPath)

      if (dryRun) {
        console.log(`Lesson ${content.lessonNumber}`)
        console.log(`  path: ${appPath}`)
        console.log(`  prompt: ${chunk.imagePrompt}`)
        console.log('')
        continue
      }

      if (existsAlready && !force) {
        console.log(`Skipping existing image: ${appPath}`)
        skipped += 1
        continue
      }

      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      console.log(`Generating image for Lesson ${content.lessonNumber}...`)
      try {
        const imageUrl = await createPrediction(chunk.imagePrompt)
        await downloadImage(imageUrl, outputPath)
        console.log(`Saved ${appPath}`)
        generated += 1
      } catch (e) {
        console.error(`Failed to generate image for Lesson ${content.lessonNumber}: ${e.message}`)
      }
    }
  }
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

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
