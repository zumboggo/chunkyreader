import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const packDir = path.join(root, 'public', 'clip-packs', 'annas-reading-deck')
const vocabPath = path.join(packDir, 'vocab.csv')
const outDir = path.join(packDir, 'images')
const model = process.env.IMAGE_MODEL || process.env.REPLICATE_MODEL || 'stability-ai/sdxl'
const token = process.env.REPLICATE_API_TOKEN
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const force = args.has('--force')
const limit = numberArg('--limit')
const onlyWord = stringArg('--word')?.toLowerCase()
const startAt = stringArg('--start-at')?.toLowerCase()
let cachedModelVersion

if (!token && !dryRun) {
  console.error('Set REPLICATE_API_TOKEN before generating word images. Use --dry-run to preview without a token.')
  process.exit(1)
}

const rows = parseCsv(await fs.readFile(vocabPath, 'utf8'))
let words = rows
  .map((row) => readColumn(row, ['word', 'Hanzi', 'Front']))
  .filter(Boolean)

if (onlyWord) words = words.filter((word) => word.toLowerCase() === onlyWord)
if (startAt) {
  const startIndex = words.findIndex((word) => word.toLowerCase() === startAt)
  if (startIndex >= 0) words = words.slice(startIndex)
}
words = words.slice(0, limit ?? undefined)

await fs.mkdir(outDir, { recursive: true })

let generated = 0
let skipped = 0
const failed = []
for (const word of words) {
  const outputFile = path.join(outDir, `${slug(word)}.png`)
  const appPath = `clip-packs/annas-reading-deck/images/${slug(word)}.png`
  const prompt = wordPrompt(word)

  if (!force && await exists(outputFile)) {
    skipped += 1
    console.log(`Keeping ${word}: ${appPath}`)
    continue
  }

  if (dryRun) {
    console.log(`Would generate ${word}: ${appPath}`)
    console.log(`  ${prompt}`)
    continue
  }

  console.log(`Generating ${word} (${generated + 1}/${words.length})...`)
  try {
    const imageUrl = await createPrediction(prompt, safeWordPrompt(word))
    const image = await fetch(imageUrl)
    if (!image.ok) throw new Error(`Could not download ${word}: ${image.status}`)
    const input = Buffer.from(await image.arrayBuffer())
    const sharp = (await import('sharp')).default
    await sharp(input).resize(1024, 1024, { fit: 'cover' }).png({ quality: 92 }).toFile(outputFile)
    generated += 1
  } catch (error) {
    failed.push({ word, error: error instanceof Error ? error.message : String(error) })
    console.warn(`Could not generate ${word}: ${error instanceof Error ? error.message : error}`)
  }
}

console.log(`Done. Generated ${generated}, skipped ${skipped}, failed ${failed.length}, total ${words.length}.`)
if (failed.length) {
  console.log(`Failed words: ${failed.map((item) => item.word).join(', ')}`)
  process.exitCode = 1
}

function wordPrompt(word) {
  return [
    `High-quality hand-painted anime storybook illustration for the English reading word "${word}".`,
    `Show ${subjectFor(word)} as the clear main subject, emotionally expressive when appropriate, gentle and sincere rather than silly.`,
    'Warm natural light, cinematic children’s book mood, polished painterly detail, soft but realistic forms, centered readable composition, simple clean background.',
    'No text, no letters, no captions, no labels, no watermark, no logo, no flashcard border, no busy background, no imitation of any specific film studio or existing character.',
  ].join(' ')
}

function safeWordPrompt(word) {
  if (word.toLowerCase() === 'duck') {
    return [
      'Clean educational children’s reading illustration for an early vocabulary card.',
      'Show a friendly yellow water bird with a small orange beak sitting beside a pond.',
      'High quality hand-painted storybook anime look, warm natural light, calm background, child-safe, wholesome.',
      'No text, no letters, no logos, no watermark, no scary or mature content.',
    ].join(' ')
  }

  return [
    `Clean educational children's reading illustration for the word "${word}".`,
    `Show ${subjectFor(word)} as a simple, wholesome object or scene for a flashcard.`,
    'High quality hand-painted storybook anime look, warm natural light, calm background, child-safe, no people unless the word needs a person.',
    'No text, no letters, no logos, no watermark, no scary or mature content.',
  ].join(' ')
}

async function createPrediction(prompt, fallbackPrompt) {
  const input = inputForModel(prompt)
  try {
    return await runPrediction(input)
  } catch (error) {
    if (/NSFW|unsafe|safety/iu.test(String(error?.message)) && fallbackPrompt) {
      console.warn('Retrying with a simpler child-safe prompt after safety rejection.')
      return runPrediction(inputForModel(fallbackPrompt))
    }
    if (!/invalid|schema|input|additional propert/iu.test(String(error?.message))) throw error
    console.warn('Retrying image generation with minimal model input after schema rejection.')
    return runPrediction({ prompt })
  }
}

function inputForModel(prompt) {
  const negativePrompt = [
    'text',
    'letters',
    'caption',
    'label',
    'watermark',
    'logo',
    'signature',
    'low quality',
    'blurry',
    'distorted',
    'extra limbs',
    'busy background',
    'chibi',
    'kawaii',
    'silly sticker',
    'imitation of a specific film studio',
    'existing cartoon character',
  ].join(', ')

  if (model.includes('stability-ai/sdxl')) {
    return {
      prompt,
      negative_prompt: negativePrompt,
      width: 1024,
      height: 1024,
      num_outputs: 1,
      scheduler: 'K_EULER',
      num_inference_steps: 35,
      guidance_scale: 7.5,
      refine: 'expert_ensemble_refiner',
      apply_watermark: false,
    }
  }

  return {
    prompt: `${prompt} Avoid: ${negativePrompt}.`,
    aspect_ratio: '1:1',
    output_format: 'png',
    output_quality: 90,
    num_outputs: 1,
    go_fast: true,
    num_inference_steps: 4,
  }
}

async function runPrediction(input) {
  const usesVersionEndpoint = model.includes('stability-ai/sdxl')
  const response = await fetch(
    usesVersionEndpoint ? 'https://api.replicate.com/v1/predictions' : `https://api.replicate.com/v1/models/${model}/predictions`,
    {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
      body: JSON.stringify(usesVersionEndpoint ? { version: await modelVersion(), input } : { input }),
    },
  )

  const prediction = await response.json()
  if (!response.ok) {
    throw new Error(`Replicate request failed: ${prediction.detail || response.status}`)
  }
  if (prediction.status === 'failed' || prediction.error) {
    throw new Error(`Replicate prediction failed: ${prediction.error || 'unknown error'}`)
  }

  const finished = ['starting', 'processing'].includes(prediction.status) ? await pollPrediction(prediction) : prediction
  if (finished.status === 'failed' || finished.error) {
    throw new Error(`Replicate prediction failed: ${finished.error || 'unknown error'}`)
  }

  const output = Array.isArray(finished.output) ? finished.output[0] : finished.output
  if (typeof output === 'string') return output
  if (output && typeof output.url === 'string') return output.url
  throw new Error(`Replicate prediction did not return an image URL. Status: ${finished.status}`)
}

async function modelVersion() {
  if (process.env.REPLICATE_MODEL_VERSION) return process.env.REPLICATE_MODEL_VERSION
  if (cachedModelVersion) return cachedModelVersion
  const response = await fetch(`https://api.replicate.com/v1/models/${model}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()
  if (!response.ok || !data.latest_version?.id) {
    throw new Error(`Could not find latest version for ${model}: ${data.detail || response.status}`)
  }
  cachedModelVersion = data.latest_version.id
  return cachedModelVersion
}

async function pollPrediction(prediction) {
  const getUrl = prediction.urls?.get
  if (!getUrl) return prediction
  for (let attempt = 0; attempt < 60; attempt += 1) {
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

function numberArg(name) {
  const value = process.argv.find((arg) => arg.startsWith(`${name}=`))?.split('=')[1]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function stringArg(name) {
  return process.argv.find((arg) => arg.startsWith(`${name}=`))?.split('=').slice(1).join('=')
}

function subjectFor(word) {
  const special = {
    at: 'a cheerful character pointing at a spot',
    and: 'two cute friends together',
    am: 'a smiling child pointing to themself',
    in: 'a tiny toy sitting inside a box',
    it: 'a mystery wrapped present',
    off: 'a friendly lamp switched off',
    up: 'a balloon floating upward',
    ng: 'a singing note sound symbol as a cute abstract character with no letters',
    blub: 'bubbly water with a silly fish face',
    bone: 'a clean toy dog bone on a bright kitchen floor',
    duck: 'a friendly yellow water bird sitting beside a pond',
  }
  return special[word.toLowerCase()] || `${article(word)} ${word}`
}

function article(value) {
  return /^[aeiou]/iu.test(value) ? 'an' : 'a'
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function readColumn(row, names) {
  for (const name of names) {
    if (row[name]) return row[name].trim()
  }
  return ''
}

function parseCsv(text) {
  const rows = []
  const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u).filter(Boolean)
  const headers = splitCsvLine(lines.shift() ?? '')
  for (const line of lines) {
    const values = splitCsvLine(line)
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })
    rows.push(row)
  }
  return rows
}

function splitCsvLine(line) {
  const values = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}
