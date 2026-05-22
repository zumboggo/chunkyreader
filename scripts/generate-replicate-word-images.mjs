import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const packDir = path.join(root, 'public', 'clip-packs', 'annas-reading-deck')
const vocabPath = path.join(packDir, 'vocab.csv')
const outDir = path.join(packDir, 'images')
const model = process.env.IMAGE_MODEL || process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell'
const token = process.env.REPLICATE_API_TOKEN
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const force = args.has('--force')
const limit = numberArg('--limit')

if (!token && !dryRun) {
  console.error('Set REPLICATE_API_TOKEN before generating word images. Use --dry-run to preview without a token.')
  process.exit(1)
}

const rows = parseCsv(await fs.readFile(vocabPath, 'utf8'))
const words = rows
  .map((row) => readColumn(row, ['word', 'Hanzi', 'Front']))
  .filter(Boolean)
  .slice(0, limit ?? undefined)

await fs.mkdir(outDir, { recursive: true })

let generated = 0
let skipped = 0
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
  const imageUrl = await createPrediction(prompt)
  const image = await fetch(imageUrl)
  if (!image.ok) throw new Error(`Could not download ${word}: ${image.status}`)
  await fs.writeFile(outputFile, Buffer.from(await image.arrayBuffer()))
  generated += 1
}

console.log(`Done. Generated ${generated}, skipped ${skipped}, total ${words.length}.`)

function wordPrompt(word) {
  return [
    `A cute kawaii chibi sticker illustration for the English reading word "${word}".`,
    `Show ${subjectFor(word)} as the clear main subject with a joyful expressive face when appropriate.`,
    'Warm pastel colors, rounded soft shapes, polished children reading app asset, centered composition, simple clean background.',
    'No text, no letters, no captions, no labels, no watermark, no logo, no flashcard border, no busy background.',
  ].join(' ')
}

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

function numberArg(name) {
  const value = process.argv.find((arg) => arg.startsWith(`${name}=`))?.split('=')[1]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
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
