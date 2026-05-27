import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const decksDir = path.join(root, 'public', 'decks')
const indexPath = path.join(decksDir, 'index.json')

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
const errors = []

for (const entry of index) {
  if (!entry.id || !entry.title || !entry.type || !entry.profile || !entry.format) {
    errors.push(`Deck index entry is missing required fields: ${JSON.stringify(entry)}`)
    continue
  }

  if (entry.format === 'json') {
    const sourcePath = path.join(root, 'public', entry.source)
    if (!fs.existsSync(sourcePath)) {
      errors.push(`${entry.id}: missing source ${entry.source}`)
      continue
    }
    const deck = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
    if (!Array.isArray(deck.cards) || deck.cards.length === 0) {
      errors.push(`${entry.id}: deck has no cards`)
      continue
    }
    for (const card of deck.cards) {
      if (!card.id || !card.type || !card.displayText) {
        errors.push(`${entry.id}: card is missing id, type, or displayText`)
      }
      if (entry.type === 'phonemes') {
        if (entry.profile === 'anna') {
          if (!card.primarySpelling) errors.push(`${entry.id} (${card.id}): missing primarySpelling`)
          if (!card.spellings || !Array.isArray(card.spellings)) errors.push(`${entry.id} (${card.id}): missing spellings array`)
          if (!card.exampleWord) errors.push(`${entry.id} (${card.id}): missing exampleWord`)
          if (!card.speechCue) errors.push(`${entry.id} (${card.id}): missing speechCue`)
        } else {
          // Sarah's phonemes validation
          if (!card.grapheme) errors.push(`${entry.id} (${card.id}): missing grapheme`)
        }
      }
    }
  }

  if (entry.format === 'chunky-clip-pack') {
    const basePath = path.join(root, 'public', entry.baseUrl)
    for (const file of ['clips_manifest.json', 'vocab.csv']) {
      if (!fs.existsSync(path.join(basePath, file))) {
        errors.push(`${entry.id}: missing ${file}`)
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Verified ${index.length} decks.`)
