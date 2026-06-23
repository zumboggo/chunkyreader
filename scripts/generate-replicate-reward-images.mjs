import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import ts from 'typescript'

const root = process.cwd()
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {}

const args = process.argv.slice(2)
const dryRun = hasFlag('dry-run')
const force = hasFlag('force')
const limit = readNumberArg('limit')
const itemFilter = readStringArg('item')
const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell'
const token = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY
const outputDir = path.join(root, 'public', 'assets', 'rewards')

if (!dryRun && !token) {
  console.error('Set REPLICATE_API_TOKEN in .env before generating reward images.')
  process.exit(1)
}

const rewards = await loadRewardCatalog()
const candidates = rewards
  .filter((item) => !itemFilter || item.id === itemFilter)
  .map((item) => ({
    item,
    outputPath: path.join(outputDir, `${item.id}.webp`),
    prompt: buildRewardPrompt(item),
  }))
const selected = Number.isFinite(limit) ? candidates.slice(0, Math.max(0, limit)) : candidates

console.log('Replicate FLUX Schnell reward image generation')
console.log(`Model: ${model}`)
console.log(`Rewards selected: ${selected.length} of ${candidates.length}`)
if (dryRun) console.log('Dry run: no API calls or files will be written.\n')

let generated = 0
let skipped = 0
let failed = 0
const DELAY_MS = 11_000

for (const candidate of selected) {
  if (dryRun) {
    console.log(`${candidate.item.name} (${candidate.item.rarity} ${candidate.item.slot})`)
    console.log(`  path: assets/rewards/${candidate.item.id}.webp`)
    console.log(`  prompt: ${candidate.prompt}\n`)
    continue
  }

  if (await exists(candidate.outputPath) && !force) {
    console.log(`Skipping existing: ${candidate.item.id}.webp`)
    skipped += 1
    continue
  }

  if (generated > 0 || skipped > 0) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
  }

  try {
    await fs.mkdir(outputDir, { recursive: true })
    console.log(`Generating ${candidate.item.name}...`)
    const imageUrl = await createPrediction(candidate.prompt)
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    const pngBuffer = Buffer.from(await response.arrayBuffer())
    await saveRewardImage(pngBuffer, candidate.outputPath, candidate.item.slot === 'background')
    console.log(`  Saved ${candidate.item.id}.webp`)
    generated += 1
  } catch (error) {
    const message = error instanceof Error ? error.message : error
    const throttled = /throttl|rate.limit|429/iu.test(String(message))
    if (throttled) {
      console.error(`  Rate limited on ${candidate.item.name}, waiting 30s and retrying...`)
      await new Promise((resolve) => setTimeout(resolve, 30_000))
      try {
        const imageUrl = await createPrediction(candidate.prompt)
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error(`Download failed: ${response.status}`)
        const pngBuffer = Buffer.from(await response.arrayBuffer())
        await saveRewardImage(pngBuffer, candidate.outputPath, candidate.item.slot === 'background')
        console.log(`  Saved ${candidate.item.id}.webp (retry)`)
        generated += 1
      } catch (retryError) {
        console.error(`  Failed ${candidate.item.name} on retry: ${retryError instanceof Error ? retryError.message : retryError}`)
        failed += 1
      }
    } else {
      console.error(`  Failed ${candidate.item.name}: ${message}`)
      failed += 1
    }
  }
}

console.log(`\nDone. Generated ${generated}, skipped ${skipped}, failed ${failed}.`)
if (failed > 0) process.exitCode = 1

async function loadRewardCatalog() {
  const sourcePath = path.join(root, 'src', 'rewards.ts')
  const source = await fs.readFile(sourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  return (await import(moduleUrl)).REWARD_CATALOG
}

function buildRewardPrompt(item) {
  if (item.slot === 'background') {
    return [
      'A cute kawaii children\'s app background illustration.',
      `Theme: ${item.description}`,
      'A gentle pastel garden scene for a small panda character to stand in the center.',
      'Soft gouache texture, simple rounded shapes, cheerful flowers, calm sky, child-safe and uncluttered.',
      'Leave the center visually quiet with clear foreground space.',
      'No panda, no people, no text, no letters, no numbers, no logo, no watermark.',
      'Square composition, 1:1 aspect ratio.',
    ].join(' ')
  }

  const slotDirection = {
    head: 'A cute wearable head accessory, front-facing, centered and symmetrical.',
    face: 'A cute glasses or face accessory, front-facing, centered and symmetrical.',
    neck: 'A cute neck accessory, front-facing, centered with a clear opening where a neck would go.',
    body: 'A cute wearable clothing item, front-facing, centered, shaped for a small round panda.',
    back: 'A cute wearable back accessory shown as a standalone item, front-facing and clearly visible.',
    hand: 'A small cute handheld charm or tool, upright and easy to recognize.',
    sticker: 'A cute collectible sticker or badge with a bold simple silhouette.',
  }[item.slot]

  return [
    'A cute kawaii children\'s reading app collectible prize item.',
    `${item.name}: ${item.description}`,
    slotDirection,
    'Single standalone object only, fully visible, generous padding, crisp silhouette.',
    'Premium soft 3D clay-and-gouache illustration style, rounded child-friendly forms, subtle tactile texture, pastel highlights.',
    `Use ${item.colorTheme} as the main accent color, with harmonious pastel details.`,
    'Place the item on a perfectly flat solid bright green (#00FF00) background for easy removal.',
    'The background must be one uniform solid bright green color with no shadows, gradients, texture, floor, reflections, or lighting variation.',
    'Do not use green anywhere in the item itself.',
    'No cast shadow, no contact shadow, no text, no letters, no numbers, no logo, no watermark, no signature, no character wearing the item.',
    'Square composition, 1:1 aspect ratio.',
  ].join(' ')
}

async function saveRewardImage(pngBuffer, outputPath, isBackground) {
  const image = sharp(pngBuffer).resize(768, 768, {
    fit: isBackground ? 'cover' : 'contain',
    position: 'center',
    background: isBackground ? '#ffffff' : '#00ff00',
  })

  if (isBackground) {
    await image.webp({ quality: 86 }).toFile(outputPath)
    return
  }

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const greenDistance = Math.sqrt(((red - 0) ** 2) + ((green - 255) ** 2) + ((blue - 0) ** 2))
    const alpha = greenDistance <= 24
      ? 0
      : greenDistance >= 120
        ? 255
        : Math.round(((greenDistance - 24) / 96) * 255)
    data[index + 3] = Math.min(data[index + 3], alpha)
    if (alpha < 255 && green > red && green > blue) {
      data[index + 1] = Math.round(Math.max(red, blue, green * (alpha / 255)))
    }
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  }).webp({ quality: 88, alphaQuality: 100 }).toFile(outputPath)
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
  throw new Error(`Replicate did not return an image URL. Status: ${prediction.status}`)
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
