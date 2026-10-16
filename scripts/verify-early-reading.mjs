import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
const lexicon = JSON.parse(fs.readFileSync('src/content/guided-words.json')).lexicon
function load(source, mocks) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: key => mocks[key], Set, Object, Math })
  return exports
}
const helpers = load(fs.readFileSync('src/earlyReading.ts', 'utf8'), { './guidedWords': { READING_LEXICON: lexicon }, './content/guided-sounds.json': JSON.parse(fs.readFileSync('src/content/guided-sounds.json')) })
const app = fs.readFileSync('src/App.tsx', 'utf8')
function extract(name) {
  const start = app.indexOf(`function ${name}(`)
  const end = app.indexOf('\n}', start) + 2
  assert(start >= 0 && end > start)
  return app.slice(start, end)
}
const builders = load(`const { earlyReadingContrast, earlyReadingWord } = require('helpers');\n${['buildSarahActivities', 'buildSarahOptions', 'buildCaseOptions', 'buildSarahPhonemeActivities', 'stableSort'].map(extract).join('\n')}\nexport { buildSarahActivities, buildSarahPhonemeActivities };`, { helpers })
let blends = 0
for (const [file, build] of [['sarah-letters-level-1', builders.buildSarahActivities], ['sarah-phonemes-level-2', builders.buildSarahPhonemeActivities]]) {
  const cards = JSON.parse(fs.readFileSync(`public/decks/${file}.json`)).cards
  for (let i = 0; i < cards.length; i++) {
    const pocket = helpers.earlyReadingPocket(cards, i)
    assert.equal(pocket[0].id, cards[i].id, 'Keep existing resume indices')
    assert(pocket.length <= 5)
    assert(pocket.every(c => cards.indexOf(c) <= Math.max(i, 1)), 'No untaught future distractors')
    const seen = new Set()
    const activities = build(pocket)
    assert(activities.length <= 13, 'Keep sessions brief')
    for (const activity of activities) {
      if (activity.kind === 'intro') seen.add(activity.card.id)
      if (activity.options) {
        assert.equal(activity.options.length, 2)
        assert.equal(new Set(activity.options.map(c => c.lowercase ?? c.grapheme)).size, 2, 'Distinct printed choices')
        assert.equal(new Set(activity.options.map(c => c.ipa ?? c.phoneme)).size, 2, 'Distinct sounds')
        assert(activity.options.every(c => seen.has(c.id)), 'Model every option before asking')
      }
      if (activity.textOptions) assert.equal(new Set(activity.textOptions).size, 2)
      if (activity.kind === 'blend') {
        blends++
        const word = helpers.earlyReadingWord(pocket)
        assert(word && word.sounds.length <= 3)
        assert(word.sounds.every(u => pocket.some(c => (c.lowercase ?? c.grapheme) === u.spelling)))
      }
    }
    assert(activities.filter(a => a.options).some(a => a.card.id !== cards[i].id), 'Review targets vary')
  }
}
assert(blends > 5, 'Reading transfer is present across the curriculum')
assert.equal(helpers.soundPosition({ grapheme: 'ng', exampleWord: 'ring' }), 'end')
assert.equal(helpers.soundPosition({ grapheme: 'er', exampleWord: 'bird' }), 'middle')
assert.equal(helpers.soundPosition({ lowercase: 'x', exampleWord: 'fox' }), 'end')
const letters = JSON.parse(fs.readFileSync('public/decks/sarah-letters-level-1.json')).cards
assert.equal(letters.find(c => c.lowercase === 'e').exampleWord, 'egg')
assert.equal(letters.find(c => c.lowercase === 'x').exampleWord, 'fox')
console.log(`Verified all 64 Letters/Sounds lessons, including ${blends} decodable blending activities.`)

const sounds = JSON.parse(fs.readFileSync('public/decks/sarah-phonemes-level-2.json')).cards
for (let i = 0; i < helpers.LEGACY_SOUND_ORDER.length; i++) {
  const resume = helpers.migrateSoundResume(sounds, i)
  const known = new Set(helpers.LEGACY_SOUND_ORDER.slice(0, i))
  assert(sounds.slice(0, resume).every(c => known.has(c.id)), 'Migration never skips an unvisited sound')
  assert(!known.has(sounds[resume].id), 'Resume at earliest unvisited sound')
}
assert.notEqual(helpers.earlyReadingProgressKey('sarah-phonemes-level-2'), 'sarah-progress-sarah-phonemes-level-2', 'Keep legacy progress intact')
assert.equal(helpers.earlyReadingWord(sounds.slice(0,4)).text, 'at', 'Blend in the first four Sounds visits')
assert(!helpers.earlyReadingWord([sounds.find(c => c.grapheme === 'oo'), ...sounds.slice(0,2)]), 'Do not guess an ambiguous pronunciation')
console.log('Sound-sequence migration and pronunciation-specific transfer checks passed.')
