import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outDir = path.join(root, 'public', 'math-objects')
const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell'
const token = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const force = args.has('--force')
const DELAY_MS = 8_000

if (!token && !dryRun) {
  console.error('Set REPLICATE_API_TOKEN or REPLICATE_API_KEY in .env before generating math images.')
  process.exit(1)
}

const MATH_OBJECTS = [
  {
    name: 'apples',
    prompt: 'Three shiny red apples with a green leaf on a clean white background. Soft watercolor storybook illustration, warm lighting, child-friendly, centered square composition.',
  },
  {
    name: 'berries',
    prompt: 'A small cluster of plump blueberries with short stems on a clean white background. Soft watercolor storybook illustration, warm lighting, child-friendly, centered square composition.',
  },
  {
    name: 'blocks',
    prompt: 'Three colorful wooden toy building blocks (red, blue, yellow) on a clean white background. Soft watercolor storybook illustration, warm lighting, child-friendly, centered square composition.',
  },
  {
    name: 'buttons',
    prompt: 'Four cute round sewing buttons in different cheerful colors on a clean white background. Soft watercolor storybook illustration, warm lighting, child-friendly, centered square composition.',
  },
  {
    name: 'shells',
    prompt: 'A pretty spiral seashell with soft sandy and pink tones on a clean white background. Soft watercolor storybook illustration, warm lighting, child-friendly, centered square composition.',
  },
  {
    name: 'stars',
    prompt: 'Three golden glowing stars on a clean white background. Soft watercolor storybook illustration, warm lighting, child-friendly, centered square composition.',
  },
]

await fs.mkdir(outDir, { recursive: true })

console.log('Math object image generation (FLUX Schnell via Replicate)')
console.log(`Model: ${model}`)
console.log(`Objects: ${MATH_OBJECTS.length}`)
if (dryRun) console.log('Dry run: no API calls or files will be written.\n')

let generated = 0
let skipped = 0
const failed = []

for (const obj of MATH_OBJECTS) {
  const outputPath = path.join(outDir, `${obj.name}.png`)

  if (!force && await exists(outputPath)) {
    console.log(`Skipping existing: ${obj.name}.png`)
    skipped += 1
    continue
  }

  if (dryRun) {
    console.log(`Would generate ${obj.name}: public/math-objects/${obj.name}.png`)
    console.log(`  ${obj.prompt}\n`)
    continue
  }

  if (generated > 0) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
  }

  console.log(`Generating ${obj.name} (${generated + 1}/${MATH_OBJECTS.length - skipped})...`)
  try {
    const imageUrl = await createPrediction(obj.prompt)
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await sharp(buffer)
      .resize(512, 512, { fit: 'cover' })
      .png({ quality: 92 })
      .toFile(outputPath)
    console.log(`  Saved public/math-objects/${obj.name}.png`)
    generated += 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`  Failed ${obj.name}: ${message}`)
    failed.push(obj.name)
  }
}

console.log(`\nDone. Generated ${generated}, skipped ${skipped}, failed ${failed.length}.`)
if (failed.length) {
  console.log(`Failed: ${failed.join(', ')}`)
  process.exitCode = 1
}

async function createPrediction(prompt) {
  const fullPrompt = `${prompt} No text, no letters, no labels, no watermark.`
  const response = await fetch(
    `https://api.replicate.com/v1/models/${model}/predictions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt: fullPrompt,
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 92,
          num_outputs: 1,
          go_fast: true,
          num_inference_steps: 4,
        },
      }),
    },
  )

  const prediction = await response.json()
  if (!response.ok) {
    throw new Error(`Replicate request failed: ${prediction.detail || response.status}`)
  }
  if (prediction.status === 'failed' || prediction.error) {
    throw new Error(`Prediction failed: ${prediction.error || 'unknown error'}`)
  }

  const finished = ['starting', 'processing'].includes(prediction.status)
    ? await pollPrediction(prediction)
    : prediction

  if (finished.status === 'failed' || finished.error) {
    throw new Error(`Prediction failed: ${finished.error || 'unknown error'}`)
  }

  const output = Array.isArray(finished.output) ? finished.output[0] : finished.output
  if (typeof output === 'string') return output
  if (output && typeof output.url === 'string') return output.url
  throw new Error(`No image URL in response. Status: ${finished.status}`)
}

async function pollPrediction(prediction) {
  let result = prediction
  while (['starting', 'processing'].includes(result.status)) {
    await new Promise((resolve) => setTimeout(resolve, 2_000))
    const response = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    result = await response.json()
  }
  return result
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
