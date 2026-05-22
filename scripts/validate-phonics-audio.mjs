import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const deckPath = path.join(root, 'public', 'decks', 'sarah-letters-level-1.json')
const manifestPath = path.join(root, 'public', 'clip-packs', 'chunky-reader-audio', 'clips_manifest.json')

const deck = JSON.parse(await fs.readFile(deckPath, 'utf8'))
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const errors = []

if (deck.cards.length !== 26) errors.push(`Expected 26 Level 1 letter-sound cards, found ${deck.cards.length}.`)

for (const card of deck.cards) {
  if (!card.avoidTtsLetterName) errors.push(`${card.id}: avoidTtsLetterName should be true.`)
  if (card.letterNameAudio) errors.push(`${card.id}: should not point at letter-name audio in phonics-first Level 1.`)
  if (!card.ipa || !card.ssmlSound?.includes('phoneme')) errors.push(`${card.id}: missing IPA/SSML phoneme data.`)
  if (!card.audio?.includes('phonics-v2')) errors.push(`${card.id}: audio path should use phonics-v2 to avoid stale letter-name clips.`)

  const clip = manifest.clips.find((entry) => entry.id === `${card.id}:sound`)
  if (!clip) {
    errors.push(`${card.id}: missing generated sound clip manifest entry.`)
    continue
  }

  const bareLetterPattern = new RegExp(`^${card.uppercase}[.\\s]`, 'u')
  if (bareLetterPattern.test(clip.text)) {
    errors.push(`${card.id}: clip text starts with a bare letter and may synthesize the letter name.`)
  }
  if (!clip.audioPath.includes('phonics-v2')) errors.push(`${card.id}: manifest audio path does not use phonics-v2.`)
}

console.log('Phonics audio validation source preview:')
for (const card of deck.cards.slice(0, 6)) {
  console.log(`- ${card.displayText}: ${card.sound} / IPA ${card.ipa} / ${card.exampleWord}`)
  console.log(`  SSML sound: ${card.ssmlSound}`)
  console.log(`  TTS text: ${card.ttsText}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Validated ${deck.cards.length} phonics-first letter sound cards.`)
