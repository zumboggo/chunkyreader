import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'

// Exercise the actual component callbacks with controlled state and timers.
const source = ts.createSourceFile('App.tsx', fs.readFileSync('src/App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const lesson = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'OlderReaderLesson')
assert(lesson, 'Words lesson component must exist')
function callback(name) {
  let found
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer.arguments[0]
    ts.forEachChild(node, visit)
  }
  visit(lesson)
  assert(found, `Missing ${name} callback`)
  return ts.transpileModule(`(${found.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
}
let complete = false
let streak = 0
let counts = {}
let recalled = 0
const timers = []
const card = { id: 'word-a' }
const context = vm.createContext({
  activity: { card, options: [card] }, activities: Array(90).fill({ card }), activityIndex: 0,
  deck: { id: 'words' }, lessonCards: [card], selected: '', missedIds: [], retryLocked: false,
  showCompletion: false, isPatternQuestion: false,
  window: { setTimeout: (fn, delay) => timers.push({ fn, delay }) },
  setComplete: value => { complete = value },
  setCarefulStreak: update => { streak = typeof update === 'function' ? update(streak) : update },
  setFirstTryCorrectCounts: update => { counts = update(counts) },
  setSelected: value => { context.selected = value },
  setMissedIds: value => { context.missedIds = value },
  setRetryLocked: value => { context.retryLocked = value },
  onActivityChange: value => { context.activityIndex = value },
  markCardsRecalled: () => { recalled++ },
  playSfx: () => {}, playNarrationClip: () => {}, playCardAudio: () => {}, updateCardProgress: () => {},
})
context.finishActivity = vm.runInContext(callback('finishActivity'), context)
const choose = vm.runInContext(callback('chooseByIndex'), context)
for (let answer = 1; answer <= 90; answer++) {
  choose(0)
  timers.sort((a, b) => a.delay - b.delay)
  while (timers.length) timers.shift().fn()
  assert.equal(complete, answer === 90, `Lesson completion after answer ${answer}`)
}
assert.equal(streak, 90, 'Correct-answer encouragement is preserved')
assert.equal(counts[card.id], 90, 'First-try results are preserved')
assert.equal(recalled, 1, 'Completion is recorded only at the end')
console.log('Words continues past three correct answers and completes only at the final activity.')
