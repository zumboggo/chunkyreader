/**
 * Generates the Green Eggs and Ham journey goal marker using FLUX via Replicate.
 * Output: public/assets/green-eggs-goal.png  (512 × 512)
 *
 * Usage:
 *   node --env-file=.env scripts/generate-green-eggs-goal.mjs
 *   node --env-file=.env scripts/generate-green-eggs-goal.mjs --force
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const force = process.argv.includes('--force')
const token = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY
const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-dev'
const outputPath = path.join(root, 'public', 'assets', 'green-eggs-goal.png')

if (!token) {
  console.error('Set REPLICATE_API_KEY in .env before running this script.')
  process.exit(1)
}

if (!force && await exists(outputPath)) {
  console.log('Goal art already exists. Use --force to regenerate.')
  process.exit(0)
}

const prompt = [
  'A single small sticker-style illustration on a plain solid white background:',
  'a round white plate holding two sunny-side-up fried eggs whose yolks are BRIGHT GREEN',
  '(vivid green egg yolks, unusual green colour, definitely not yellow or orange yolks) and a slice of GREEN ham',
  '(the ham meat is coloured green too), the plate leaning against a closed hardcover storybook with a plain green cover.',
  'Children\'s picture-book illustration style, soft gouache texture, warm pastel palette,',
  'rounded friendly shapes, thick soft outlines, centered composition, generous white margin around the subject.',
  'No characters, no people, no animals, no text, no letters, no numbers, no watermark, no border, no shadow outside the subject.',
].join(' ')

console.log('Generating Green Eggs goal art via FLUX…')

try {
  const imageUrl = await createPrediction(prompt)
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await sharp(buffer)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .png({ quality: 92 })
    .toFile(outputPath)
  console.log('Saved: public/assets/green-eggs-goal.png')
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
        prompt: promptText,
        aspect_ratio: '1:1',
        output_format: 'png',
        output_quality: 92,
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
