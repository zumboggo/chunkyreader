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
const curriculum = load('src/guidedWords.ts', { './content/guided-words.json': JSON.parse(fs.readFileSync('src/content/guided-words.json')) })
const soundClips = JSON.parse(fs.readFileSync('src/content/guided-sounds.json', 'utf8'))
const media = JSON.parse(fs.readFileSync('public/media-manifest.json', 'utf8'))
const soundModule = load('src/guidedWordAudio.ts', {
  './guidedWords': curriculum, './content/guided-sounds.json': soundClips, './mediaAssets': { assetUrl: p => p },
})
for (const [sound, clip] of Object.entries(soundClips)) {
  assert(media.files[clip.path] || fs.existsSync(`public/${clip.path}`), `Recorded audio for ${sound} must be available`)
  assert(!clip.path.includes('letter-name'), 'Never use a letter-name clip')
  assert(clip.ipa && clip.start >= 0 && clip.duration > .08 && clip.duration < .8)
}
const storage = load('src/progressStorage.ts')
const guidedKey = 'chunky-reader:word-recognition:v2:guided:annas-reading-deck'
assert(storage.isProgressKey(guidedKey), 'Guided results must use the existing account-scoped progress export')
assert.equal(storage.learnerScope(guidedKey), 'anna')
const cachedPlans = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`${guidedKey}:lesson:${i}`, '{}']))
assert.equal(Object.keys(storage.compactProgressKeys(cachedPlans)).length, 20, 'Saved lesson plans remain bounded')
const { READING_POCKETS, makeReadingPlan, emptyReadingState, readingSteps, applyReadingResult, buildReadingTile } = curriculum
assert.equal(READING_POCKETS.length, 24)
const now = Date.parse('2026-09-15T03:00:00Z')
for (let stage = 0; stage < READING_POCKETS.length; stage++) {
  const plan = makeReadingPlan({ ...emptyReadingState(), stage }, now)
  assert.equal(plan.words.length, 4)
  assert.equal(new Set(plan.words.map(w => w.text)).size, 4)
  assert(plan.words.some(w => w.text.length > 3), 'No return to CVC-only lessons')
  assert.notEqual(plan.checkOrder.join(','), plan.words.map(w=>w.text).join(','), 'Checks differ from modeled order')
  for (const sentence of [READING_POCKETS[stage].sentence, READING_POCKETS[stage].alternateSentence]) {
    for (const token of sentence.toLowerCase().match(/[a-z]+/g)) {
      assert(curriculum.READING_HELPERS[token] || curriculum.READING_LEXICON[token], `Sentence vocabulary audited: ${token}`)
      if (curriculum.READING_HELPERS[token]) continue
      const available = new Set(READING_POCKETS.slice(0,stage+1).flatMap(p=>p.words).flatMap(w=>w.sounds.map(u=>u.sound)))
      for (const sound of ['a','e','i','o','u','k','t','p','b','d','f','g','h','j','l','m','n','r','s','v','w','z']) available.add(sound)
      assert(curriculum.READING_LEXICON[token].sounds.every(u=>available.has(u.sound)), `Untaught sentence pattern: ${stage+1} ${token}`)
    }
  }
  assert(plan.meaningPrompt.question && plan.meaningPrompt.answer)
  const steps = readingSteps(plan)
  assert.equal(steps.length, 12)
  assert.equal(steps.at(-1).kind, 'sentence')
  assert.equal(steps.filter(s => s.kind === 'read').length, 4)
  assert(plan.sentence.split(' ').length <= 8)
  for (const w of plan.words) {
    const sounds = soundModule.guidedSoundUnits(w.text)
    assert.deepEqual(Array.from(sounds.flatMap(s => s.positions).sort((a,b) => a-b)), [...w.text].map((_,i) => i), 'Every spelling position maps to exactly one phoneme')
    assert.equal(w.parts.join(''), w.text)
    for (let i = 0; i < w.sounds.length; i++) {
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
const retry = applyReadingResult(independent, { ...plan, attemptId: 'second' }, 'first', correct, true, now)
assert.equal(retry.words.stop.selfReportedDays.length, 1, 'Same-day repeats are not delayed practice')
assert.equal(retry.words.stop.independentDays.length, 0, 'Child self-report is not parent verification')
assert.equal(retry.words.stop.lastResult, 'self-reported')
assert.equal(retry.sentences[0].readAloud, true, 'Sentence completion includes parent confirmation of reading aloud')
const tomorrow = applyReadingResult(retry, { ...plan, attemptId: 'third' }, 'first', correct, true, now + 86400000)
assert.equal(tomorrow.words.stop.selfReportedDays.length, 2)
assert.equal(tomorrow.words.stop.dueAt, now + 4 * 86400000)
const due = makeReadingPlan(independent, now + 86400000)
assert(due.words.some(w => plan.words.some(old => old.text === w.text)), 'Due older words return for review')
assert.equal(readingSteps(due)[1].kind, 'read', 'Due review is read before any new model')
assert.equal(readingSteps(due).filter(s => s.kind === 'read').length, 5, 'Four targets plus one due check')
assert.deepEqual(Array.from(due.words.slice(0,4).map(w=>w.text)), Array.from(READING_POCKETS[1].words.map(w=>w.text)), 'Review never removes a target')
assert.equal(retry.completedSessions.length, 1, 'Replay never creates a second lesson reward record')
assert.equal(retry.completedAttempts.length, 2, 'Replay creates a genuine practice attempt')
assert.notEqual(makeReadingPlan({ ...helped, stage: 0 }, now).sentence, plan.sentence, 'Repeat lessons vary the sentence')
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
  './guidedWords': curriculum, './guidedWordsStorage': {}, './progressStorage': {}, './cloudProgressSync': { recordLocalProgressChange() {} },
  './guidedWordAudio': { guidedSoundUnits: soundModule.guidedSoundUnits, playGuidedSounds: async text => { audio.push(`sounds:${text}`); return 'played' }, prepareGuidedSounds() {}, stopGuidedSounds() {} },
  './audioClipPack': { playNarrationClip: (...args) => audio.push(args), stopAudioPlayback() {} },
  './audioEffects': { playSfx() {} }, './mediaAssets': { assetUrl: p => p }, './guidedWords.css': {},
}, '\nexports.ActivityUnderTest = ReadingActivity;')
function render(step) {
  cursor = 0; effects = []
  const tree = ui.ActivityUnderTest({ step, index: 0, plan, onAdvance: value => advances.push(value), onFinish: value => finishes.push(value), initialHelped: false, onHelp() {}, playWord: async value => { audio.push(value); return true } })
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
assert.equal(audio[0], 'model:stop', 'New words and meaning are introduced with audio')
assert.equal(soundModule.guidedSoundUnits('running').map(s => s.sound).join(','), 'r,u,n,i,ng')
assert.equal(soundModule.guidedSoundUnits('rabbit').map(s => s.sound).join(','), 'r,a,b,i,t')
assert.equal(soundModule.guidedSoundUnits('cake')[1].positions.join(','), '1,3')
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
  './guidedWords': curriculum, './content/guided-sounds.json': soundClips, './mediaAssets': { assetUrl: p => p },
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

const planStorage = load('src/guidedWordsStorage.ts', {
  './progressStorage': { progressStorage: { getItem: key => key.includes(':lesson:')
    ? JSON.stringify({ ...plan, stage: 0, version: 1 })
    : JSON.stringify({ ...emptyReadingState(), stage: 0 }) } },
  './guidedWords': curriculum,
})
for (let lesson = 1; lesson <= READING_POCKETS.length; lesson++) {
  const selected = planStorage.loadGuidedReadingPlan('annas-reading-deck', lesson)
  assert.equal(selected.stage, lesson - 1, 'Each number selects its own content even with stale state/cache')
  assert.equal(selected.title, READING_POCKETS[lesson - 1].title)
}
console.log('Numbered Words lessons ignore stale cached content and select all 24 curriculum pockets correctly.')

// Early-lesson replays must survive compaction after all 24 lessons have cached plans.
const replayPlans = Object.fromEntries(Array.from({length:24},(_,i)=>[`${guidedKey}:lesson:${i+1}`, JSON.stringify({savedAt:i+1})]))
replayPlans[`${guidedKey}:lesson:1`] = JSON.stringify({savedAt:100})
assert(storage.compactProgressKeys(replayPlans)[`${guidedKey}:lesson:1`], 'Keep the most recently used replay, not only the highest lesson numbers')

// The same attempt is resumed, including help; completing it makes the next visit a new attempt.
const memory = new Map()
const savedPlan = { ...plan, progress: { index: 8, results: {stop:false}, helped:true } }
memory.set(`${guidedKey}:lesson:1`, JSON.stringify(savedPlan))
memory.set(`${guidedKey}:selected`, '1')
const persistentStorage = load('src/guidedWordsStorage.ts', {
  './guidedWords': curriculum,
  './progressStorage': { progressStorage: { getItem: key => memory.get(key) ?? null } },
})
assert.equal(persistentStorage.loadGuidedReadingPlan('annas-reading-deck',1).attemptId,plan.attemptId)
assert.equal(persistentStorage.loadGuidedReadingPlan('annas-reading-deck',1).progress.helped,true)
assert.equal(persistentStorage.guidedResumeLessonNumber('annas-reading-deck'),1)
memory.set(guidedKey,JSON.stringify(independent))
assert.notEqual(persistentStorage.loadGuidedReadingPlan('annas-reading-deck',1).attemptId,plan.attemptId)
assert.equal(persistentStorage.guidedResumeLessonNumber('annas-reading-deck'),2)

// An error models the correct connection, but cannot advance until a fresh choice.
hooks=[]; audio=[]; advances=[]
const spelling = {kind:'build', word:plan.words[0]}
let spellingTree = render(spelling)
button(spellingTree,'z').props.onClick()
spellingTree=render(spelling)
assert(button(spellingTree,'Try again'))
assert(!button(spellingTree,'t'), 'Feedback does not silently advance to the next sound')
button(spellingTree,'Try again').props.onClick()
spellingTree=render(spelling)
button(spellingTree,'s').props.onClick()
spellingTree=render(spelling)
assert(button(spellingTree,'t'), 'Only the corrected attempt advances one sound')
assert.equal(advances.length,0,'Building one sound does not complete the word')
console.log('Attempt resume, assisted reloads, reward idempotency, cache retention, and corrective spelling retry passed.')

// A cache lookup that finishes after leaving a model must not reveal audio on a quiet check.
let releaseCache
const startedAudio=[]
const recordedAudio = load('src/audioClipPack.ts', {
  './mediaAssets': { assetUrl:p=>p, legacyAssetUrl:p=>p }, react,
  './appSettings': { loadAppSettings:()=>({}) },
}, '', {
  window: { caches: {} }, localStorage: { getItem:()=>null },
  caches: { open:()=>new Promise(resolve=>{ releaseCache=()=>resolve({match:async()=>undefined}) }) },
  Audio: class { constructor(url){this.url=url} addEventListener(){} play(){startedAudio.push(this.url);return Promise.resolve()} pause(){} },
})
const late = recordedAudio.playRecordedClip('old-model.m4a')
recordedAudio.stopAudioPlayback()
releaseCache()
assert.equal(await late,false)
assert.equal(startedAudio.length,0,'Cancelled cache fetch must never start answer audio')
console.log('Recorded-only audio cancellation prevents late answers during quiet checks.')

let manyVisits=emptyReadingState()
for(let i=0;i<101;i++)manyVisits=applyReadingResult(manyVisits,{...plan,attemptId:`repeat-${i}`},'first',correct,true,now+i)
assert.equal(makeReadingPlan({...manyVisits,stage:0},now).sentence,READING_POCKETS[0].alternateSentence,'Sentence alternation survives bounded history compaction')
