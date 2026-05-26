import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const dataPath = path.join(root, 'public', 'decks', 'sarah-letter-images.json')
const args = process.argv.slice(2)
const dryRun = hasFlag('dry-run')
const force = hasFlag('force')
const limit = readNumberArg('limit')
const letterFilter = readStringArg('letter')?.toUpperCase()

const data = JSON.parse(await fs.readFile(dataPath, 'utf8'))
const width = data.cardSize?.width ?? 1024
const height = data.cardSize?.height ?? 1024
const allCards = (data.cards ?? []).filter((card) => !letterFilter || card.letter === letterFilter)
const cards = Number.isFinite(limit) ? allCards.slice(0, Math.max(0, limit)) : allCards

let composited = 0
let skipped = 0
let missing = 0

console.log('Sarah letter card compositing')
console.log(`Cards selected: ${cards.length} of ${(data.cards ?? []).length}`)
if (dryRun) console.log('Dry run: no final cards will be written.\n')

for (const card of cards) {
  const backgroundPath = path.join(root, 'public', card.backgroundImage)
  const finalPath = path.join(root, 'public', card.finalCompositeImage)

  if (dryRun) {
    console.log(`${card.letter} - ${card.keyword}`)
    console.log(`  background: ${card.backgroundImage}`)
    console.log(`  final: ${card.finalCompositeImage}`)
    console.log(`  overlay: ${card.overlay?.text ?? card.letter}`)
    console.log('')
    continue
  }

  if (!(await exists(backgroundPath))) {
    console.warn(`Missing background for ${card.letter}: ${card.backgroundImage}`)
    missing += 1
    continue
  }

  if ((await exists(finalPath)) && !force) {
    console.log(`Skipping existing final card: ${card.finalCompositeImage}`)
    skipped += 1
    continue
  }

  await fs.mkdir(path.dirname(finalPath), { recursive: true })
  const overlaySvg = buildOverlaySvg(card, width, height)
  await sharp(backgroundPath)
    .resize(width, height, { fit: 'cover' })
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .webp({ quality: 90 })
    .toFile(finalPath)
  console.log(`Saved ${card.finalCompositeImage}`)
  composited += 1
}

if (missing > 0 && !dryRun) {
  console.warn(`Done with missing backgrounds. Composited ${composited}, skipped ${skipped}, missing ${missing}.`)
  process.exitCode = 1
} else {
  console.log(`Done. Composited ${composited}, skipped ${skipped}.`)
}

function buildOverlaySvg(card, cardWidth, cardHeight) {
  const overlay = card.overlay ?? {}
  const text = escapeXml(overlay.text || card.letter)
  const secondary = overlay.secondaryText ? escapeXml(overlay.secondaryText) : ''
  const fontFamily = overlay.fontFamily || 'Arial Black, Arial, Helvetica, sans-serif'
  const color = overlay.color || '#050505'
  const opacity = Number.isFinite(overlay.opacity) ? overlay.opacity : 1
  const fontSize = Math.round(cardHeight * (overlay.fontSizeRatio ?? 0.68))
  const secondaryFontSize = Math.round(cardHeight * (overlay.secondaryFontSizeRatio ?? 0.17))
  const anchor = overlay.position === 'left' ? { x: cardWidth * 0.42, y: cardHeight * 0.58 } :
    overlay.position === 'right' ? { x: cardWidth * 0.58, y: cardHeight * 0.58 } :
      { x: cardWidth * 0.5, y: cardHeight * 0.58 }
  const x = Math.round(overlay.x ?? anchor.x)
  const y = Math.round(overlay.y ?? anchor.y)
  const secondaryY = Math.round(y + fontSize * 0.24)

  return `<svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle"
      font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="900"
      fill="${escapeXml(color)}" opacity="${opacity}" stroke="rgba(255,255,255,0.78)" stroke-width="${Math.max(10, Math.round(cardHeight * 0.018))}" paint-order="stroke fill">${text}</text>
    ${secondary ? `<text x="${x}" y="${secondaryY}" text-anchor="middle" dominant-baseline="middle"
      font-family="${escapeXml(fontFamily)}" font-size="${secondaryFontSize}" font-weight="900"
      fill="${escapeXml(color)}" opacity="${opacity}">${secondary}</text>` : ''}
  </svg>`
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

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
