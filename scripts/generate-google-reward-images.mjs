import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import ts from 'typescript'

const root = process.cwd()
const args = process.argv.slice(2)
const dryRun = hasFlag('dry-run')
const force = hasFlag('force')
const limit = readNumberArg('limit')
const itemFilter = readStringArg('item')
const model = process.env.GOOGLE_IMAGE_MODEL || 'gemini-2.5-flash-image'
const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_CLOUD_API_KEY
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
const googleLocation = process.env.GOOGLE_CLOUD_LOCATION || 'global'
const outputDir = path.join(root, 'public', 'assets', 'rewards')

if (!dryRun && !apiKey && !credentialsPath) {
  console.error(
    'Set GEMINI_API_KEY (Google AI Studio) or GOOGLE_APPLICATION_CREDENTIALS (Vertex AI) before generating reward images.',
  )
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

console.log('Google Flash reward image generation')
console.log(`Model: ${model}`)
console.log(`Rewards selected: ${selected.length} of ${candidates.length}`)
if (dryRun) console.log('Dry run: no API calls or files will be written.\n')

let generated = 0
let skipped = 0
let failed = 0

for (const candidate of selected) {
  if (dryRun) {
    console.log(`${candidate.item.name}`)
    console.log(`  path: assets/rewards/${candidate.item.id}.webp`)
    console.log(`  prompt: ${candidate.prompt}\n`)
    continue
  }

  if (await exists(candidate.outputPath) && !force) {
    console.log(`Skipping existing image: assets/rewards/${candidate.item.id}.webp`)
    skipped += 1
    continue
  }

  try {
    await fs.mkdir(outputDir, { recursive: true })
    console.log(`Generating ${candidate.item.name}...`)
    const image = await generateImageWithRetry(candidate.prompt)
    await saveRewardImage(image, candidate.outputPath, candidate.item.slot === 'background')
    console.log(`Saved assets/rewards/${candidate.item.id}.webp`)
    generated += 1
  } catch (error) {
    console.error(`Could not generate ${candidate.item.name}: ${error instanceof Error ? error.message : error}`)
    failed += 1
  }
}

console.log(`Done. Generated ${generated}, skipped ${skipped}, failed ${failed}.`)
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
      'Use case: illustration-story.',
      'Asset type: square background for a kawaii early-learning app prize.',
      `Primary request: ${item.description}`,
      'Create a gentle pastel garden scene sized for a cute panda character to stand in the center.',
      'Soft gouache and tactile picture-book texture, simple rounded shapes, cheerful flowers, calm sky, child-safe and uncluttered.',
      'Keep the center visually quiet and leave clear foreground space for the app character.',
      'No panda, no people, no text, no letters, no numbers, no logo, no watermark, no signature, no frame.',
    ].join(' ')
  }

  const slotDirection = {
    head: 'Front-facing wearable head accessory, centered and symmetrical.',
    face: 'Front-facing glasses or face accessory, centered and symmetrical.',
    neck: 'Front-facing neck accessory, centered with a clear opening where a neck would be.',
    body: 'Front-facing wearable clothing item, centered and shaped for a small round panda.',
    back: 'Front-facing wearable back accessory shown clearly as a standalone item.',
    hand: 'Small handheld charm or tool, upright and easy to recognize.',
    sticker: 'Cute collectible sticker or badge with a bold, simple silhouette.',
  }[item.slot]

  return [
    'Use case: stylized-concept.',
    'Asset type: collectible prize-box item icon and wearable overlay for a kawaii children\'s reading app.',
    `Primary request: ${item.name}. ${item.description}`,
    slotDirection,
    'Single standalone object only, fully visible, generous padding, crisp silhouette.',
    'Premium soft 3D clay-and-gouache illustration, rounded child-friendly forms, subtle tactile texture, pastel highlights, polished mobile-game reward quality.',
    `Use ${item.colorTheme} as the main accent color, with harmonious pastel details.`,
    'Place the item on a perfectly flat solid #00ff00 chroma-key background for background removal.',
    'The background must be one uniform color with no shadows, gradients, texture, floor, reflections, or lighting variation.',
    'Do not use green anywhere in the item. No cast shadow, no contact shadow, no text, no letters, no numbers, no logo, no watermark, no signature, no character or body wearing the item.',
  ].join(' ')
}

async function saveRewardImage(buffer, outputPath, isBackground) {
  const image = sharp(buffer).resize(768, 768, {
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

async function generateImageWithRetry(prompt) {
  const waits = [20_000, 45_000, 75_000]
  for (let attempt = 0; attempt <= waits.length; attempt += 1) {
    try {
      return await generateImage(prompt)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const throttled = /resource has been exhausted|quota|429/iu.test(message)
      if (!throttled || attempt === waits.length) throw error
      const wait = waits[attempt]
      console.warn(`Google image quota paused this batch. Retrying in ${Math.round(wait / 1000)} seconds...`)
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }
  throw new Error('Google image generation retry loop ended unexpectedly.')
}

async function generateImage(prompt) {
  const auth = credentialsPath
    ? await vertexAuth(credentialsPath)
    : {
        endpoint:
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        headers: {},
      }
  const response = await fetch(auth.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth.headers },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '1:1' },
      },
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Google image request failed: ${data.error?.message || response.status}`)
  }
  const imagePart = data.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((part) => {
      const inlineData = part.inlineData || part.inline_data
      return inlineData?.data && String(inlineData.mimeType || inlineData.mime_type || '').startsWith('image/')
    })
  const inlineData = imagePart?.inlineData || imagePart?.inline_data
  if (!inlineData?.data) throw new Error('Google image response did not contain an image.')
  return Buffer.from(inlineData.data, 'base64')
}

async function vertexAuth(filePath) {
  const credentials = JSON.parse(await fs.readFile(filePath, 'utf8'))
  const project = process.env.GOOGLE_CLOUD_PROJECT || credentials.project_id
  if (!project) throw new Error('Set GOOGLE_CLOUD_PROJECT or use credentials containing project_id.')
  const host = googleLocation === 'global'
    ? 'aiplatform.googleapis.com'
    : `${googleLocation}-aiplatform.googleapis.com`
  return {
    endpoint:
      `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(googleLocation)}` +
      `/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
    headers: { Authorization: `Bearer ${await googleAccessToken(credentials)}` },
  }
}

async function googleAccessToken(credentials) {
  if (credentials.type === 'authorized_user') return authorizedUserAccessToken(credentials)
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const claim = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url')
  const unsigned = `${header}.${claim}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), credentials.private_key)
  const assertion = `${unsigned}.${Buffer.from(signature).toString('base64url')}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) {
    throw new Error(`Google service-account authentication failed: ${data.error_description || data.error || response.status}`)
  }
  return data.access_token
}

async function authorizedUserAccessToken(credentials) {
  const response = await fetch(credentials.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) {
    throw new Error(`Google authorized-user authentication failed: ${data.error_description || data.error || response.status}`)
  }
  return data.access_token
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
