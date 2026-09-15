import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'

function load(file, mocks = {}, suffix = '') {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8') + suffix, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, require: name => {
    assert(name in mocks, `Unexpected dependency ${name}`)
    return mocks[name]
  }, Date, Set, console })
  return exports
}
const curriculum = load('src/guidedWords.ts')
const storage = load('src/progressStorage.ts')
const guidedKey = 'chunky-reader:word-recognition:v2:guided:annas-reading-deck'
assert(storage.isProgressKey(guidedKey), 'Guided results must use the existing account-scoped progress export')
assert.equal(storage.learnerScope(guidedKey), 'anna')
const cachedPlans = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`${guidedKey}:lesson:${i}`, '{}']))
assert.equal(Object.keys(storage.compactProgressKeys(cachedPlans)).length, 20, 'Saved lesson plans remain bounded')
const { READING_POCKETS, makeReadingPlan, emptyReadingState, readingSteps, applyReadingResult, buildReadingTile } = curriculum
const now = Date.parse('2026-09-15T03:00:00Z')
for (let stage = 0; stage < READING_POCKETS.length; stage++) {
  const plan = makeReadingPlan({ ...emptyReadingState(), stage }, now)
  assert.equal(plan.words.length, 4)
  assert.equal(new Set(plan.words.map(w => w.text)).size, 4)
  assert(plan.words.some(w => w.text.length > 3), 'No return to CVC-only lessons')
  const steps = readingSteps(plan)
  assert.equal(steps.length, 16)
  assert.equal(steps.at(-1).kind, 'sentence')
  assert.equal(steps.filter(s => s.kind === 'read').length, 4)
  assert(plan.sentence.split(' ').length <= 8)
  for (const w of plan.words) {
    assert.equal(w.parts.join(''), w.text)
    for (let i = 0; i < 2; i++) {
      const tile = buildReadingTile(w, i)
      assert.equal(new Set(tile.choices).size, 2)
      assert(tile.choices.includes(tile.correct))
    }
  }
}
const plan = makeReadingPlan(emptyReadingState(), now)
const correct = Object.fromEntries(plan.words.map(w => [w.text, true]))
const helped = applyReadingResult(emptyReadingState(), plan, 'first', correct, false, now)
assert.equal(helped.stage, 0, 'A helped sentence must not advance the curriculum')
const independent = applyReadingResult(emptyReadingState(), plan, 'first', correct, true, now)
assert.equal(independent.stage, 1)
assert.equal(applyReadingResult(independent, plan, 'first', correct, true, now), independent, 'Completion is idempotent')
const retry = applyReadingResult(independent, plan, 'second', correct, true, now)
assert.equal(retry.words.stop.independentDays.length, 1, 'Same-day repeats are not delayed mastery')
const tomorrow = applyReadingResult(retry, plan, 'third', correct, true, now + 86400000)
assert.equal(tomorrow.words.stop.independentDays.length, 2)
assert.equal(tomorrow.words.stop.dueAt, now + 4 * 86400000)
const due = makeReadingPlan(independent, now + 86400000)
assert(due.words.some(w => plan.words.some(old => old.text === w.text)), 'Due older words return for review')
assert.equal(readingSteps(due)[1].kind, 'read', 'Due review is read before any new model')
assert.equal(readingSteps(due).filter(s => s.kind === 'read').length, 4, 'Review is not counted twice')
assert.notEqual(makeReadingPlan(helped, now).sentence, plan.sentence, 'Repeat lessons vary the sentence')
const notDue = makeReadingPlan(independent, now)
assert(!notDue.words.some(w => plan.words.some(old => old.text === w.text)))
const unverified = applyReadingResult(emptyReadingState(), plan, 'missing', {}, true, now)
assert.equal(unverified.stage, 0, 'A sentence tap cannot substitute for word-reading evidence')
assert.equal(unverified.words.stop.lastResult, 'helped')

// Exercise real activity UI callbacks and audio effects without browser globals or new dependencies.
let hooks = [], cursor = 0, effects = [], audio = [], finishes = [], advances = []
const react = {
  useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next }] },
  useRef(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i] },
  useEffect(fn) { effects.push(fn) },
}
const jsx = (type, props) => ({ type, props })
const ui = load('src/GuidedWordsLesson.tsx', {
  react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
  './guidedWords': curriculum, './guidedWordsStorage': {}, './progressStorage': {},
  './audioClipPack': { playNarrationClip: (...args) => audio.push(args), stopAudioPlayback() {} },
  './audioEffects': { playSfx() {} }, './mediaAssets': { assetUrl: p => p }, './guidedWords.css': {},
}, '\nexports.ActivityUnderTest = ReadingActivity;')
function render(step) {
  cursor = 0; effects = []
  const tree = ui.ActivityUnderTest({ step, index: 0, plan, onAdvance: value => advances.push(value), onFinish: value => finishes.push(value), playWord: value => audio.push(value) })
  effects.forEach(effect => effect())
  return tree
}
function text(node) { return typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '' }
function button(tree, label) {
  if (!tree) return
  if (Array.isArray(tree)) return tree.map(n => button(n, label)).find(Boolean)
  if (tree.type === 'button' && text(tree) === label) return tree
  return button(tree.props?.children, label)
}
for (const kind of ['read', 'sentence']) {
  hooks = []; audio = []; finishes = []; advances = []
  const step = kind === 'read' ? { kind, word: plan.words[0] } : { kind }
  let tree = render(step)
  assert.equal(audio.length, 0, `${kind} answer must not autoplay`)
  assert(!button(tree, 'Read independently'), 'Parent gate is separate from the child action')
  button(tree, kind === 'read' ? 'Help me' : 'Help me hear it').props.onClick()
  tree = render(step)
  button(tree, kind === 'read' ? 'Parent check' : 'Ready for parent check').props.onClick()
  tree = render(step)
  assert.equal(button(tree, 'Read independently').props.disabled, true, 'Audio help cannot be recorded as independent')
  button(tree, 'Read with help').props.onClick()
  assert.equal((kind === 'read' ? advances : finishes)[0], false)
  hooks = []; audio = []
  tree = render(step)
  button(tree, kind === 'read' ? 'Parent check' : 'Ready for parent check').props.onClick()
  tree = render(step)
  assert.equal(button(tree, 'Read independently').props.disabled, false)
  button(tree, 'Read independently').props.onClick()
  assert.equal((kind === 'read' ? advances : finishes).at(-1), true)
}
hooks = []; audio = []
render({ kind: 'teach', word: plan.words[0] })
assert.equal(audio[0], 'stop', 'New words are introduced with audio')
console.log('Guided Words: all curriculum pockets, review spacing, parent checks, silent reading, and help tracking passed.')
