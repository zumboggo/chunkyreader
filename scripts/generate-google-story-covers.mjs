import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const root = process.cwd()
const storyFile = path.join(root, 'public', 'stories', 'anne-stories.json')
const args = process.argv.slice(2)
const dryRun = hasFlag('dry-run')
const force = hasFlag('force')
const limit = readNumberArg('limit')
const storyFilter = readStringArg('story')
const model = process.env.GOOGLE_IMAGE_MODEL || 'gemini-3.1-flash-image-preview'
const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_CLOUD_API_KEY
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
const googleLocation = process.env.GOOGLE_CLOUD_LOCATION || 'global'

if (!dryRun && !apiKey && !credentialsPath) {
  console.error(
    'Set GEMINI_API_KEY (Google AI Studio) or GOOGLE_APPLICATION_CREDENTIALS (Vertex AI) before generating story covers.',
  )
  process.exit(1)
}

const stories = JSON.parse(await fs.readFile(storyFile, 'utf8'))
const candidates = stories
  .filter((story) => !storyFilter || story.id === storyFilter)
  .map((story) => {
    const appPath = `stories/covers/${story.id}-cover.webp`
    return {
      story,
      appPath,
      outputPath: path.join(root, 'public', appPath),
      prompt: buildCoverPrompt(story),
    }
  })

const selected = Number.isFinite(limit) ? candidates.slice(0, Math.max(0, limit)) : candidates
let generated = 0
let skipped = 0
let failed = 0
let changed = false

console.log('Google Flash story cover generation')
console.log(`Model: ${model}`)
console.log(`Stories selected: ${selected.length} of ${candidates.length}`)
if (dryRun) console.log('Dry run: no API calls or files will be written.\n')

for (const item of selected) {
  const existsAlready = await exists(item.outputPath)
  if (dryRun) {
    console.log(`${item.story.title}`)
    console.log(`  path: ${item.appPath}`)
    console.log(`  prompt: ${item.prompt}\n`)
    continue
  }

  if (existsAlready && !force) {
    console.log(`Skipping existing cover: ${item.appPath}`)
    skipped += 1
  } else {
    try {
      await fs.mkdir(path.dirname(item.outputPath), { recursive: true })
      console.log(`Generating cover for ${item.story.title}...`)
      const generatedImage = await generateImageWithRetry(item.prompt)
      await sharp(generatedImage)
        .resize(768, 1024, { fit: 'cover', position: 'attention' })
        .webp({ quality: 88 })
        .toFile(item.outputPath)
      console.log(`Saved ${item.appPath}`)
      generated += 1
    } catch (error) {
      console.error(`Could not generate ${item.story.title}: ${error instanceof Error ? error.message : error}`)
      failed += 1
      continue
    }
  }

  if (item.story.coverImage !== item.appPath || item.story.coverPrompt !== item.prompt) {
    item.story.coverImage = item.appPath
    item.story.coverPrompt = item.prompt
    changed = true
  }
  if (changed) {
    await fs.writeFile(storyFile, `${JSON.stringify(stories, null, 2)}\n`)
  }
}

if (changed) {
  await fs.writeFile(storyFile, `${JSON.stringify(stories, null, 2)}\n`)
  console.log('Updated coverImage and coverPrompt fields in public/stories/anne-stories.json.')
}

console.log(`Done. Generated ${generated}, skipped ${skipped}, failed ${failed}.`)
if (failed > 0) process.exitCode = 1

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
        imageConfig: { aspectRatio: '3:4', imageSize: '1K' },
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
  if (!inlineData?.data) {
    throw new Error('Google image response did not contain an image.')
  }
  return Buffer.from(inlineData.data, 'base64')
}

async function vertexAuth(filePath) {
  const serviceAccount = JSON.parse(await fs.readFile(filePath, 'utf8'))
  const project = process.env.GOOGLE_CLOUD_PROJECT || serviceAccount.project_id
  if (!project) {
    throw new Error('Set GOOGLE_CLOUD_PROJECT or use a service-account file containing project_id.')
  }
  const host = googleLocation === 'global'
    ? 'aiplatform.googleapis.com'
    : `${googleLocation}-aiplatform.googleapis.com`
  const endpoint =
    `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(googleLocation)}` +
    `/publishers/google/models/${encodeURIComponent(model)}:generateContent`
  return {
    endpoint,
    headers: { Authorization: `Bearer ${await googleAccessToken(serviceAccount)}` },
  }
}

async function googleAccessToken(credentials) {
  if (credentials.type === 'authorized_user') {
    return authorizedUserAccessToken(credentials)
  }
  return serviceAccountAccessToken(credentials)
}

async function serviceAccountAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const unsigned = `${header}.${claim}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), serviceAccount.private_key)
  const assertion = `${unsigned}.${base64Url(signature)}`
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
  if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token) {
    throw new Error('The Google authorized-user credential is missing client_id, client_secret, or refresh_token.')
  }
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

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function buildCoverPrompt(story) {
  const firstPage = story.pages?.[0]
  const openingScene = firstPage?.imagePrompt
    ? trimPrompt(firstPage.imagePrompt)
    : `Opening scene: ${String(firstPage?.text || story.description || '').replace(/\s+/g, ' ').trim()}`

  return [
    'Create a portrait 3:4 cover illustration for a young child\'s story library.',
    `Story title for context only: "${story.title}". Do not render the title or any words in the image.`,
    `Story summary: ${story.description || 'A warm, playful early-reader adventure.'}`,
    openingScene,
    'Original premium children\'s storybook illustration, warm painterly watercolor and gouache textures, expressive friendly characters, clear central silhouette, rich but calm color, gentle humor, polished book-cover composition.',
    'Leave the upper and lower edges visually calm so the app can overlay its own title and badges.',
    'No text, no letters, no numbers, no typography, no logo, no watermark, no signature, no frightening imagery, no copied copyrighted character design, and no imitation of a specific living artist or animation studio.',
  ].join(' ')
}

function trimPrompt(value) {
  const cleaned = String(value).replace(/\s+/g, ' ').trim()
  const originalArtIndex = cleaned.search(/Original (cozy|gentle|children)/i)
  return originalArtIndex > 80 ? cleaned.slice(0, originalArtIndex).trim() : cleaned.slice(0, 750)
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
