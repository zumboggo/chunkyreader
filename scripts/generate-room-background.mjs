/**
 * Generates the Panda's Room background illustration using FLUX via Replicate.
 * Output: public/assets/panda-room-bg.webp  (1280 × 854, 3:2 landscape)
 *
 * Usage:
 *   node --env-file=.env scripts/generate-room-background.mjs
 *   node --env-file=.env scripts/generate-room-background.mjs --force
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const force = process.argv.includes('--force')
const token = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY
const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-dev'
const outputPath = path.join(root, 'public', 'assets', 'panda-room-bg.webp')

if (!token) {
  console.error('Set REPLICATE_API_KEY in .env before running this script.')
  process.exit(1)
}

if (!force && await exists(outputPath)) {
  console.log('Room background already exists. Use --force to regenerate.')
  process.exit(0)
}

const prompt = [
  'A cosy panda cub bedroom, wide landscape view, gentle bird\'s-eye tilt.',
  'Children\'s picture-book illustration style, premium gouache and watercolour texture, soft rounded shapes, warm pastel palette.',
  'Room features arranged naturally in the scene:',
  'Upper-left: a tall arched window with ruffled peach-cream curtains tied back, soft garden light visible outside through sheer glass.',
  'Upper-center ceiling: a small painted wooden ceiling hook (hook only, nothing hanging from it yet), surrounded by a subtle ceiling rose.',
  'Upper-right wall: two empty rounded wooden picture frames side by side, the frames are clearly visible but interiors blank.',
  'Middle-right: a short wooden shelf bracket with a clear empty surface, space for small objects.',
  'Lower-left: a plump round armchair in warm blush fabric with a flattened empty seat, next to a tiny wicker side-table.',
  'Lower-center: a small child-sized wooden desk with a clear uncluttered desktop surface and a little wooden stool tucked beneath.',
  'Floor center: a soft circular blush-pink rug, plain and empty, warm wooden plank flooring visible around it.',
  'Middle-right edge: a smooth rounded wooden door, slightly ajar showing a thin sliver of a bright hallway, a small hook on the wall beside it.',
  'Room center is open floor — no furniture in the middle.',
  'Lighting: warm diffused light from the left window, gentle shadows, no harsh contrast.',
  'Mood: magical, inviting, safe, cosy — like a fairytale bedroom for a tiny animal.',
  'No characters, no people, no animals, no panda, no text, no numbers, no letters, no watermarks, no border.',
].join(' ')

console.log('Generating Panda\'s Room background via FLUX…')
console.log(`Model: ${model}`)

try {
  const imageUrl = await createPrediction(prompt)
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await sharp(buffer)
    .resize(1280, 854, { fit: 'cover', position: 'center' })
    .webp({ quality: 88 })
    .toFile(outputPath)
  console.log('Saved: public/assets/panda-room-bg.webp')
} catch (error) {
  console.error('Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
}

async function createPrediction(promptText) {
  const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt: `${promptText} No text, no letters, no labels, no watermark.`,
        aspect_ratio: '3:2',
        output_format: 'webp',
        output_quality: 88,
        num_outputs: 1,
        guidance: 3.5,
        num_inference_steps: 28,
      },
    }),
  })

  const prediction = await response.json()
  if (!response.ok) throw new Error(`Replicate request failed: ${prediction.detail || response.status}`)
  if (prediction.error) throw new Error(`Prediction failed: ${prediction.error}`)

  const finished = ['starting', 'processing'].includes(prediction.status)
    ? await pollPrediction(prediction)
    : prediction

  if (finished.error) throw new Error(`Prediction failed: ${finished.error}`)
  const url = Array.isArray(finished.output) ? finished.output[0] : finished.output
  if (!url) throw new Error('No output URL in prediction response.')
  return url
}

async function pollPrediction(prediction) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const r = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const p = await r.json()
    if (p.status === 'succeeded') return p
    if (p.status === 'failed') throw new Error(`Prediction failed: ${p.error}`)
  }
  throw new Error('Prediction timed out.')
}

async function exists(p) {
  try { await fs.access(p); return true } catch { return false }
}
