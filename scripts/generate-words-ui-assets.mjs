import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const root = process.cwd()
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  // Environment variables may also be supplied by the shell or CI.
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const model = process.env.GOOGLE_IMAGE_MODEL || 'gemini-2.5-flash-image'
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_CLOUD_API_KEY
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
const googleLocation = process.env.GOOGLE_CLOUD_LOCATION || 'global'
const outputDir = path.join(root, 'public', 'assets', 'words')

const assets = [
  {
    id: 'reading-garden',
    aspectRatio: '9:16',
    width: 768,
    height: 1365,
    transparent: false,
    prompt: [
      'Use case: illustration-story.',
      'Asset type: portrait mobile lesson background for a joyful early-reading app.',
      'Create a polished pastel storybook environment with a pale sky-blue upper area, soft white clouds near the edges,',
      'a warm blush-white middle kept visually quiet for readable app controls, and low rolling fresh-green hills with a few tiny flowers along only the bottom edge.',
      'Add sparse tiny star sparkles around the outer edges, never in the quiet center.',
      'Soft gouache with gentle clay-like highlights, bright child-friendly lighting, premium kawaii mobile-game finish.',
      'Keep generous empty central space from 18 percent to 82 percent height.',
      'Use sky blue, blush pink, leaf green, sunny yellow, and small lavender accents.',
      'No panda, people, animals, food, cards, buttons, panels, text, letters, numbers, logos, watermark, dark areas, or busy center details.',
    ].join(' '),
  },
  {
    id: 'reading-panda',
    aspectRatio: '1:1',
    width: 768,
    height: 768,
    transparent: true,
    prompt: [
      'Use case: stylized-concept.',
      'Asset type: compact header mascot cutout for a kawaii children reading app.',
      'Create one friendly baby panda sitting and holding an open lavender-blue picture book.',
      'The panda has large warm brown eyes, small pink cheeks, rounded soft clay-and-gouache forms, and a delighted attentive reading expression.',
      'Full character and book visible, centered, front-facing, crisp silhouette, generous padding, premium polished mobile-game illustration.',
      'Place the subject on a perfectly flat solid #00ff00 chroma-key background for background removal.',
      'The background must be one uniform color with no shadows, gradients, texture, floor, reflections, or lighting variation.',
      'Do not use green anywhere in the panda or book. No cast shadow, contact shadow, text, letters, numbers, logo, watermark, or extra objects.',
    ].join(' '),
  },
]

if (!dryRun && !apiKey && !credentialsPath) {
  console.error('Set GEMINI_API_KEY or GOOGLE_APPLICATION_CREDENTIALS before generating Words UI assets.')
  process.exit(1)
}

console.log('Google Words UI asset generation')
console.log(`Model: ${model}`)
if (dryRun) console.log('Dry run: no API calls or files will be written.\n')

let generated = 0
let skipped = 0
let failed = 0

for (const asset of assets) {
  const outputPath = path.join(outputDir, `${asset.id}.webp`)
  if (dryRun) {
    console.log(`${asset.id}`)
    console.log(`  path: assets/words/${asset.id}.webp`)
    console.log(`  aspect: ${asset.aspectRatio}`)
    console.log(`  prompt: ${asset.prompt}\n`)
    continue
  }

  if (await exists(outputPath) && !force) {
    console.log(`Skipping existing image: assets/words/${asset.id}.webp`)
    skipped += 1
    continue
  }

  try {
    await fs.mkdir(outputDir, { recursive: true })
    console.log(`Generating ${asset.id}...`)
    const image = await generateImageWithRetry(asset.prompt, asset.aspectRatio)
    if (asset.transparent) {
      await saveChromaKeyCutout(image, outputPath, asset.width, asset.height)
    } else {
      await sharp(image)
        .resize(asset.width, asset.height, { fit: 'cover', position: 'center' })
        .webp({ quality: 88 })
        .toFile(outputPath)
    }
    console.log(`Saved assets/words/${asset.id}.webp`)
    generated += 1
  } catch (error) {
    console.error(`Could not generate ${asset.id}: ${error instanceof Error ? error.message : error}`)
    failed += 1
  }
}

console.log(`Done. Generated ${generated}, skipped ${skipped}, failed ${failed}.`)
if (failed > 0) process.exitCode = 1

async function saveChromaKeyCutout(buffer, outputPath, width, height) {
  const { data, info } = await sharp(buffer)
    .resize(width, height, { fit: 'contain', position: 'center', background: '#00ff00' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const greenDominance = green - Math.max(red, blue)
    const greenDistance = Math.sqrt((red ** 2) + ((green - 255) ** 2) + (blue ** 2))
    const alpha = greenDistance <= 26 && greenDominance > 80
      ? 0
      : greenDistance >= 150 || greenDominance < 24
        ? 255
        : Math.round(Math.max(0, Math.min(255, ((greenDistance - 26) / 124) * 255)))

    data[index + 3] = Math.min(data[index + 3], alpha)
    if (alpha < 255 && green > red && green > blue) {
      data[index + 1] = Math.round(Math.max(red, blue, green * (alpha / 255)))
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(outputPath)

  const { channels } = await sharp(outputPath).stats()
  if (channels.length < 4 || channels[3].min !== 0) {
    throw new Error('Panda cutout did not contain transparent pixels.')
  }
}

async function generateImageWithRetry(prompt, aspectRatio) {
  const waits = [20_000, 45_000, 75_000]
  for (let attempt = 0; attempt <= waits.length; attempt += 1) {
    try {
      return await generateImage(prompt, aspectRatio)
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

async function generateImage(prompt, aspectRatio) {
  const auth = credentialsPath
    ? await vertexAuth(credentialsPath)
    : {
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        headers: {},
      }
  const response = await fetch(auth.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth.headers },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio },
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
  const assertion = `${unsigned}.${crypto.sign('RSA-SHA256', Buffer.from(unsigned), credentials.private_key).toString('base64url')}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
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

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
