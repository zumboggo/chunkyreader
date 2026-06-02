import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'
import { TTS_VOICE_VERSIONS } from './tts-config.mjs'

const root = process.cwd()
const storyFile = path.join(root, 'public', 'stories', 'anne-stories.json')
const args = process.argv.slice(2)
const dryRun = hasFlag('dry-run')
const force = hasFlag('force')
const forceOcr = hasFlag('ocr')
const pageMode = readStringArg('page-mode') || 'auto-pair'
const pdfPath = readStringArg('pdf')
const title = readStringArg('title')
const storyId = readStringArg('story-id') || safeSlug(title || '')
const series = readStringArg('series') || 'PDF Stories'
const readingLevel = readStringArg('reading-level') || 'older reader'
const description =
  readStringArg('description') || `${title || 'This story'} imported from a PDF for Older Reader story practice.`

if (!pdfPath || !storyId || !title) {
  console.error(
    'Usage: npm run import:pdf-story -- --pdf "<file.pdf>" --story-id story-id --title "Story Title" [--dry-run] [--force] [--ocr] [--page-mode auto-pair|each-page]',
  )
  process.exit(1)
}

if (!['auto-pair', 'each-page'].includes(pageMode)) {
  console.error(`Unsupported --page-mode "${pageMode}". Use "auto-pair" or "each-page".`)
  process.exit(1)
}

const absolutePdfPath = path.resolve(pdfPath)
const storyDir = path.join(root, 'public', 'stories', 'pdf', storyId)
const imageDir = path.join(storyDir, 'images')
const sourceManifestPath = path.join(storyDir, 'source-manifest.json')
const reviewPath = path.join(storyDir, 'review-text.json')
const publicStoryDir = `stories/pdf/${storyId}`
const publicImageDir = `${publicStoryDir}/images`
const publicSourceManifestPath = `${publicStoryDir}/source-manifest.json`

console.log('PDF story import')
console.log(`PDF: ${absolutePdfPath}`)
console.log(`Story: ${title} (${storyId})`)
console.log(`Mode: ${pageMode}${forceOcr ? ', forced OCR' : ''}${dryRun ? ', dry run' : ''}`)

await assertInputPdf(absolutePdfPath)

const pdfData = new Uint8Array(await fs.readFile(absolutePdfPath))
const pdf = await pdfjsLib.getDocument({ data: pdfData, disableWorker: true }).promise
console.log(`PDF pages: ${pdf.numPages}`)

const extractedPages = []
let worker

try {
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textLayerText = cleanOcrText(await extractPdfText(page))
    const rendered = await renderPage(page)
    const shouldOcr = forceOcr || wordCount(textLayerText) < 6
    let text = textLayerText
    let method = 'pdf-text'
    let confidence
    let cropName

    if (shouldOcr) {
      worker ??= await createWorker('eng', 1, {
        cachePath: path.join(root, 'node_modules', '.cache', 'tesseract'),
      })
      await worker.setParameters({ tessedit_pageseg_mode: '6' })
      const ocrResult = await recognizeBestTextCrop(worker, rendered.pngBuffer, rendered.width, rendered.height)
      text = cleanOcrText(ocrResult.text)
      method = 'ocr'
      confidence = Math.round(ocrResult.confidence)
      cropName = ocrResult.cropName
    }

    extractedPages.push({
      pageNumber,
      text,
      method,
      confidence,
      cropName,
      pngBuffer: rendered.pngBuffer,
      width: rendered.width,
      height: rendered.height,
    })
    console.log(
      `Page ${pageNumber}: ${wordCount(text)} words via ${method}${confidence == null ? '' : ` (${confidence}%)`}`,
    )
  }
} finally {
  if (worker) await worker.terminate()
}

const imported = buildImportedStory(extractedPages)

if (dryRun) {
  printDryRun(imported)
  process.exit(0)
}

const stories = await readStories()
const existingIndex = stories.findIndex((story) => story.id === storyId)
if (existingIndex >= 0 && !force) {
  console.error(`Story "${storyId}" already exists. Re-run with --force to replace it.`)
  process.exit(1)
}

await fs.mkdir(imageDir, { recursive: true })
await writeCoverImage(imported.coverSourcePage, imported.coverImage)
for (const page of imported.pages) {
  await writeStoryPageImage(page.sourceImagePage, page.image)
}

const story = {
  id: storyId,
  title,
  series,
  readingLevel,
  description,
  coverImage: imported.coverImage,
  sourceType: 'pdf-import',
  sourceManifest: publicSourceManifestPath,
  pages: imported.pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: page.text,
    image: page.image,
    altText: page.altText,
    audio: page.audio,
    sourcePdfPage: page.sourcePdfPage,
    sourceImagePage: page.sourceImagePage,
    extractionMethod: page.extractionMethod,
    ocrConfidence: page.ocrConfidence,
  })),
}

if (existingIndex >= 0) stories.splice(existingIndex, 1, story)
else stories.unshift(story)

await fs.writeFile(storyFile, `${JSON.stringify(stories, null, 2)}\n`)
await fs.writeFile(sourceManifestPath, `${JSON.stringify(imported.sourceManifest, null, 2)}\n`)
await fs.writeFile(reviewPath, `${JSON.stringify(imported.review, null, 2)}\n`)

console.log(`Imported ${story.pages.length} story pages.`)
console.log(`Images: ${path.relative(root, imageDir)}`)
console.log(`Review text: ${path.relative(root, reviewPath)}`)
console.log('Next: review text if needed, then run `npm run generate:audio`.')

async function assertInputPdf(filePath) {
  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) throw new Error('not a file')
  } catch {
    console.error(`PDF not found: ${filePath}`)
    process.exit(1)
  }
}

async function extractPdfText(page) {
  const content = await page.getTextContent()
  return content.items.map((item) => ('str' in item ? item.str : '')).join('\n')
}

async function renderPage(page) {
  const viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d')
  await page.render({ canvasContext: context, viewport }).promise
  return {
    pngBuffer: canvas.toBuffer('image/png'),
    width: canvas.width,
    height: canvas.height,
  }
}

async function recognizeBestTextCrop(worker, pngBuffer, width, height) {
  const crops = [
    {
      name: 'right-center',
      region: {
        left: Math.floor(width * 0.52),
        top: Math.floor(height * 0.16),
        width: Math.floor(width * 0.42),
        height: Math.floor(height * 0.72),
      },
    },
    {
      name: 'right-half',
      region: {
        left: Math.floor(width * 0.48),
        top: 0,
        width: Math.floor(width * 0.52),
        height,
      },
    },
    {
      name: 'left-center',
      region: {
        left: Math.floor(width * 0.06),
        top: Math.floor(height * 0.16),
        width: Math.floor(width * 0.42),
        height: Math.floor(height * 0.72),
      },
    },
  ]
  const results = []
  for (const crop of crops) {
    const prepared = await sharp(pngBuffer)
      .extract(clampRegion(crop.region, width, height))
      .grayscale()
      .normalise()
      .resize({ width: 1500, withoutEnlargement: true })
      .png()
      .toBuffer()
    const result = await worker.recognize(prepared)
    const text = cleanOcrText(result.data.text)
    const confidence = Number(result.data.confidence) || 0
    results.push({
      cropName: crop.name,
      text,
      confidence,
      score: confidence * 5 + wordCount(text) * 3 + sentenceLineCount(text) * 15 - suspiciousLineCount(text) * 30,
    })
  }
  return results.sort((a, b) => b.score - a.score)[0]
}

function clampRegion(region, width, height) {
  const left = Math.max(0, Math.min(region.left, width - 1))
  const top = Math.max(0, Math.min(region.top, height - 1))
  return {
    left,
    top,
    width: Math.max(1, Math.min(region.width, width - left)),
    height: Math.max(1, Math.min(region.height, height - top)),
  }
}

function buildImportedStory(extractedPages) {
  const bodyPages = extractedPages.filter((page) => isStoryBodyPage(page))
  const pagesToUse = bodyPages.length > 0 ? bodyPages : extractedPages.filter((page) => page.pageNumber > 1)
  const coverSourcePage = extractedPages[0]?.pageNumber || pagesToUse[0]?.pageNumber || 1
  const coverImage = `${publicImageDir}/cover.webp`
  const pages = pagesToUse.map((sourcePage, index) => {
    const pageNumber = index + 1
    const sourceImagePage = chooseSourceImagePage(sourcePage, extractedPages)
    return {
      pageNumber,
      text: sourcePage.text || '[Review needed: no readable story text was found on this page.]',
      image: `${publicImageDir}/page-${pageNumber}.webp`,
      altText: `${title} page ${pageNumber}, imported from PDF page ${sourceImagePage}.`,
      audio: `clip-packs/chunky-reader-audio/audio/narration/stories/${TTS_VOICE_VERSIONS.anneNarrator}/${storyId}-page-${pageNumber}.mp3`,
      sourcePdfPage: sourcePage.pageNumber,
      sourceImagePage,
      extractionMethod: sourcePage.method,
      ocrConfidence: sourcePage.confidence,
      cropName: sourcePage.cropName,
    }
  })
  return {
    coverSourcePage,
    coverImage,
    pages,
    sourceManifest: {
      storyId,
      title,
      sourceFileName: path.basename(absolutePdfPath),
      sourceFileSizeBytes: pdfData.byteLength,
      importedAt: new Date().toISOString(),
      pageCount: extractedPages.length,
      pageMode,
      ocrUsed: pages.some((page) => page.extractionMethod === 'ocr'),
      coverSourcePage,
      pages: pages.map(({ pageNumber, sourcePdfPage, sourceImagePage, extractionMethod, ocrConfidence, cropName, image }) => ({
        pageNumber,
        sourcePdfPage,
        sourceImagePage,
        extractionMethod,
        ocrConfidence,
        cropName,
        image,
      })),
    },
    review: {
      storyId,
      title,
      note: 'Review and correct OCR text here before regenerating Azure TTS if any words look wrong.',
      pages: pages.map(({ pageNumber, sourcePdfPage, extractionMethod, ocrConfidence, text }) => ({
        pageNumber,
        sourcePdfPage,
        extractionMethod,
        ocrConfidence,
        text,
      })),
    },
  }
}

function isStoryBodyPage(page) {
  if (page.pageNumber === 1 && textLooksLikeTitlePage(page.text)) return false
  return wordCount(page.text) >= 4
}

function textLooksLikeTitlePage(text) {
  const lower = text.toLowerCase()
  const titleTokens = title.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean)
  const matched = titleTokens.filter((token) => lower.includes(token)).length
  return matched >= Math.max(2, Math.floor(titleTokens.length * 0.5)) || wordCount(text) < 12
}

function chooseSourceImagePage(sourcePage, extractedPages) {
  if (pageMode === 'each-page') return sourcePage.pageNumber
  const previous = extractedPages.find((page) => page.pageNumber === sourcePage.pageNumber - 1)
  if (previous && previous.pageNumber !== 1 && wordCount(previous.text) < 4) return previous.pageNumber
  return sourcePage.pageNumber
}

async function writeCoverImage(sourcePageNumber, appPath) {
  const source = extractedPages.find((page) => page.pageNumber === sourcePageNumber) || extractedPages[0]
  await writeWebp(source.pngBuffer, path.join(root, 'public', appPath))
}

async function writeStoryPageImage(sourcePageNumber, appPath) {
  const source = extractedPages.find((page) => page.pageNumber === sourcePageNumber)
  if (!source) throw new Error(`Missing rendered source PDF page ${sourcePageNumber}`)
  await writeWebp(source.pngBuffer, path.join(root, 'public', appPath))
}

async function writeWebp(pngBuffer, outputPath) {
  if (!force && await exists(outputPath)) {
    console.log(`Keeping existing image: ${path.relative(root, outputPath)}`)
    return
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await sharp(pngBuffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(outputPath)
}

async function readStories() {
  try {
    return JSON.parse(await fs.readFile(storyFile, 'utf8'))
  } catch {
    return []
  }
}

function printDryRun(imported) {
  console.log('')
  console.log(`Would import ${imported.pages.length} story pages.`)
  console.log(`Cover: PDF page ${imported.coverSourcePage} -> ${imported.coverImage}`)
  for (const page of imported.pages) {
    console.log('')
    console.log(`Story page ${page.pageNumber}: PDF text page ${page.sourcePdfPage}, image page ${page.sourceImagePage}`)
    console.log(`  method: ${page.extractionMethod}${page.ocrConfidence == null ? '' : ` (${page.ocrConfidence}%)`}`)
    console.log(`  image: ${page.image}`)
    console.log(`  audio: ${page.audio}`)
    console.log(indent(page.text, '  text: '))
  }
}

function cleanOcrText(value) {
  return String(value || '')
    .split(/\r?\n/u)
    .map((line) => line
      .replace(/\bDAVID HEPTING\b/giu, '')
      .replace(/[|]/gu, '')
      .replace(/[^\p{L}\p{N}\s.,!?;:'"’“”‘-]/gu, '')
      .replace(/\s+/gu, ' ')
      .trim())
    .filter((line) => line && line.length > 1 && !/^\d+$/u.test(line) && /[\p{L}\p{N}]/u.test(line))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

function wordCount(value) {
  return (String(value || '').match(/[\p{L}\p{N}]+/gu) || []).length
}

function sentenceLineCount(value) {
  return String(value || '')
    .split('\n')
    .filter((line) => /[.!?]"?$/u.test(line.trim()) && wordCount(line) >= 3)
    .length
}

function suspiciousLineCount(value) {
  return String(value || '')
    .split('\n')
    .filter((line) => {
      const words = line.match(/[\p{L}\p{N}]+/gu) || []
      if (words.length === 0) return false
      const shortWords = words.filter((word) => word.length <= 2).length
      const vowelWords = words.filter((word) => /[aeiouy]/iu.test(word)).length
      return shortWords / words.length > 0.65 || vowelWords / words.length < 0.45
    })
    .length
}

function safeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['’]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function indent(value, prefix) {
  return String(value || '')
    .split('\n')
    .map((line, index) => `${index === 0 ? prefix : ' '.repeat(prefix.length)}${line}`)
    .join('\n')
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
