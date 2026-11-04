const fs = require('node:fs')
const path = require('node:path')

const deckPath = path.join(__dirname, '../public/decks/sarah-letters-level-1.json')
const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'))

for (const card of deck.cards) {
  const filename = path.parse(card.image).name
  const word = filename.replace(new RegExp('^' + card.lowercase + '-(.+)-card$'), '$1')
  card.exampleWord = word
  card.speechCue = card.speechCue.replace(/like \w+$/, 'like ' + word)
  card.ttsText = card.ttsText.replace(/as in \w+\.$/, 'as in ' + word + '.')
}

fs.writeFileSync(deckPath, JSON.stringify(deck, null, 2) + '\n')
