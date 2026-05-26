import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dataPath = path.join(root, 'public', 'decks', 'sarah-letter-images.json')
const requireFiles = process.argv.includes('--require-files')
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
const errors = []
const warnings = []

if (!Array.isArray(data.cards) || data.cards.length === 0) {
  errors.push('sarah-letter-images.json must contain a non-empty cards array.')
}

for (const card of data.cards ?? []) {
  if (!card.id) errors.push('A letter card is missing id.')
  if (!card.letter || !/^[A-Z]$/u.test(card.letter)) errors.push(`${card.id}: letter must be one uppercase A-Z character.`)
  if (!card.keyword) errors.push(`${card.id}: missing keyword.`)
  if (!card.imagePrompt) errors.push(`${card.id}: missing imagePrompt.`)
  if (!card.backgroundImage) errors.push(`${card.id}: missing backgroundImage.`)
  if (!card.finalCompositeImage) errors.push(`${card.id}: missing finalCompositeImage.`)
  if (card.imagePrompt && /(render|draw|place|show|include).{0,32}(teaching|final|foreground|bold black)?\s*letter/iu.test(card.imagePrompt)) {
    errors.push(`${card.id}: prompt appears to ask the image model to generate the teaching letter.`)
  }
  if (card.imagePrompt && !/no text, no letters/iu.test(card.imagePrompt)) {
    warnings.push(`${card.id}: prompt should explicitly include "No text, no letters".`)
  }
  if (card.overlay?.enabled !== true || card.overlay?.text !== card.letter) {
    errors.push(`${card.id}: overlay must be enabled and match the uppercase letter.`)
  }
  for (const field of ['backgroundImage', 'finalCompositeImage']) {
    if (!card[field]) continue
    const filePath = path.join(root, 'public', card[field])
    if (requireFiles && !fs.existsSync(filePath)) errors.push(`${card.id}: missing ${field} file ${card[field]}`)
  }
}

if (warnings.length) console.warn(warnings.join('\n'))
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Verified ${data.cards.length} Sarah letter image cards${requireFiles ? ' and generated files' : ''}.`)
