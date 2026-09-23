import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'

function load(file, mocks = {}, suffix = '', globals = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8') + suffix, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, require: name => {
    assert(name in mocks, `Unexpected dependency ${name}`)
    return mocks[name]
  }, Date, Set, console, ...globals })
  return exports
}
const curriculum = load('src/guidedWords.ts')
const soundClips = JSON.parse(fs.readFileSync('src/content/guided-sounds.json', 'utf8'))
const media = JSON.parse(fs.readFileSync('public/media-manifest.json', 'utf8'))
const soundModule = load('src/guidedWordAudio.ts', {
  './content/guided-sounds.json': soundClips, './mediaAssets': { assetUrl: p => p },
})
for (const [sound, clip] of Object.entries(soundClips)) {
  assert(media.files[clip.path], `Recorded audio for ${sound} must exist in the shared catalog`)
  assert(clip.path.includes('-phoneme-phonics-sounds-v2'), 'Never use a letter-name clip')
  assert(clip.ipa && clip.start >= 0 && clip.duration > .08 && clip.duration < .8)
}
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
    const sounds = soundModule.guidedSoundUnits(w.text)
    assert.equal(sounds.map(s => s.spelling).join(''), w.text)
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
assert.equal(helped.stage, 1, 'Completing with help advances to the next lesson')
const independent = applyReadingResult(emptyReadingState(), plan, 'first', correct, true, now)
assert.equal(independent.stage, 1)
assert.equal(applyReadingResult(independent, plan, 'first', correct, true, now), independent, 'Completion is idempotent')
const retry = applyReadingResult(independent, plan, 'second', correct, true, now)
assert.equal(retry.words.stop.selfReportedDays.length, 1, 'Same-day repeats are not delayed practice')
assert.equal(retry.words.stop.independentDays.length, 0, 'Child self-report is not parent verification')
assert.equal(retry.words.stop.lastResult, 'self-reported')
assert.equal(retry.sentences[0].readAloud, true, 'Sentence completion includes parent confirmation of reading aloud')
const tomorrow = applyReadingResult(retry, plan, 'third', correct, true, now + 86400000)
assert.equal(tomorrow.words.stop.selfReportedDays.length, 2)
assert.equal(tomorrow.words.stop.dueAt, now + 4 * 86400000)
const due = makeReadingPlan(independent, now + 86400000)
assert(due.words.some(w => plan.words.some(old => old.text === w.text)), 'Due older words return for review')
assert.equal(readingSteps(due)[1].kind, 'read', 'Due review is read before any new model')
assert.equal(readingSteps(due).filter(s => s.kind === 'read').length, 4, 'Review is not counted twice')
assert.notEqual(makeReadingPlan(helped, now).sentence, plan.sentence, 'Repeat lessons vary the sentence')
const notDue = makeReadingPlan(independent, now)
assert(!notDue.words.some(w => plan.words.some(old => old.text === w.text)))
const unverified = applyReadingResult(emptyReadingState(), plan, 'missing', {}, true, now)
assert.equal(unverified.stage, 1, 'Completion advances without claiming independent reading')
assert.equal(unverified.words.stop.lastResult, 'helped')
assert.equal(unverified.words.stop.lastResult, 'helped')

// Exercise real activity UI callbacks and audio effects without browser globals or new dependencies.
let hooks = [], cursor = 0, effects = [], audio = [], finishes = [], advances = []
const react = {
  useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next }] },
  useRef(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i] },
  useEffect(fn) { effects.push(fn) },
  useCallback(fn) { return fn },
}
const jsx = (type, props) => ({ type, props })
const ui = load('src/GuidedWordsLesson.tsx', {
  react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
  './guidedWords': curriculum, './guidedWordsStorage': {}, './progressStorage': {},
  './guidedWordAudio': { guidedSoundUnits: soundModule.guidedSoundUnits, playGuidedSounds: async text => { audio.push(`sounds:${text}`); return 'played' }, prepareGuidedSounds() {}, stopGuidedSounds() {} },
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
  if (kind === 'sentence') {
    button(tree, 'Ready for parent check').props.onClick()
    tree = render(step)
    assert.equal(button(tree, 'Read independently').props.disabled, true, 'Audio help cannot be recorded as independent')
    button(tree, 'Read with help').props.onClick()
  } else {
    assert(!button(tree, 'Parent check'), 'Words do not need a parent')
    assert(!button(tree, 'I knew it'), 'Hearing help removes the self-reported unassisted option')
    button(tree, 'Keep practising').props.onClick()
  }
  assert.equal((kind === 'read' ? advances : finishes)[0], false)
  hooks = []; audio = []
  tree = render(step)
  if (kind === 'sentence') {
    button(tree, 'Ready for parent check').props.onClick()
    tree = render(step)
    assert.equal(button(tree, 'Read independently').props.disabled, false)
    button(tree, 'Read independently').props.onClick()
  } else button(tree, 'I knew it').props.onClick()
  assert.equal((kind === 'read' ? advances : finishes).at(-1), true)
}
hooks = []; audio = []
render({ kind: 'teach', word: plan.words[0] })
assert.equal(audio[0], 'stop', 'New words are introduced with audio')
hooks = []; audio = []
render({ kind: 'blend', word: plan.words[0] })
assert.equal(audio[0], 'sounds:stop', 'Blending automatically models phonemes')
assert.equal(soundModule.guidedSoundUnits('running').map(s => s.sound).join(','), 'r,u,n,ing')
assert.equal(soundModule.guidedSoundUnits('rabbit').map(s => s.sound).join(','), 'r,a,b,i,t')
const scheduled = []
class TestAudioContext {
  state = 'running'
  currentTime = 10
  async resume() {}
  async decodeAudioData() { return { duration: 2 } }
  createBufferSource() {
    const node = { connect() {}, start(...args) { node.timing = args }, stop() { node.stopped = true } }
    scheduled.push(node)
    return node
  }
}
const engine = load('src/guidedWordAudio.ts', {
  './content/guided-sounds.json': soundClips, './mediaAssets': { assetUrl: p => p },
}, '', {
  AudioContext: TestAudioContext, AbortSignal,
  fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
  setTimeout: () => 1, clearTimeout() {},
})
const playing = engine.playGuidedSounds('stop', () => {})
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(scheduled.length, 4)
assert.equal(scheduled[0].timing[1], soundClips.s.start)
assert.equal(scheduled[0].timing[2], soundClips.s.duration)
engine.stopGuidedSounds()
assert.equal(await playing, 'cancelled', 'Leaving a screen cancels the entire sound sequence')
assert(scheduled.every(node => node.stopped && !node.onended))
const sh = engine.playGuidedSounds('ship', () => {})
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(scheduled.length, 7, 'sh is one sound, not two letter names')
scheduled.at(-1).onended()
assert.equal(await sh, 'played')
console.log('Guided Words: all curriculum pockets, review spacing, parent checks, silent reading, and help tracking passed.')

const resumeStorage = load('src/guidedWordsStorage.ts', {
  './progressStorage': { progressStorage: { getItem: () => JSON.stringify({ ...emptyReadingState(), completedSessions: ['annas-reading-deck:2', 'annas-reading-deck:7', 'other-deck:99'] }) } },
  './guidedWords': curriculum,
})
assert.equal(resumeStorage.guidedCompletedLessonNumber('annas-reading-deck'), 7, 'Completed sessions repair a stale resume pointer without using another deck')
