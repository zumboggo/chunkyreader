import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'

// Exercise the shared event dispatcher with changing screens and modal controls.
let candidates = []
let dialogs = []
let observer
const events = {}
class Element {
  constructor(label = '') { this.innerText = label; this.children = []; this.attrs = {}; this.dataset = {}; this.handlers = {}; this.clicks = 0; this.tag = 'button' }
  append(child) { this.children.push(child); child.parent = this }
  setAttribute(key, value) { this.attrs[key] = value }
  getAttribute(key) { return this.attrs[key] ?? null }
  addEventListener(key, fn) { this.handlers[key] = fn }
  getClientRects() { return this.hidden ? [] : [{}] }
  closest() { return null }
  contains(node) { return node === this || this.children.some(child => child.contains(node)) }
  matches(selector) {
    if (selector.startsWith(':disabled')) return this.disabled === true
    if (selector === 'input, textarea, select') return this.tag === 'input'
    return false
  }
  querySelector() { return null }
  querySelectorAll() { return this.items ?? candidates }
  scrollIntoView() {}
  click() { this.clicks++; this.handlers.click?.() }
}
const body = new Element()
const root = new Element()
const keys = { A: '1', B: '2', C: '3', D: '4' }
const code = ts.transpileModule(fs.readFileSync('src/fourButtonController.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
vm.runInNewContext(code, {
  exports, HTMLElement: Element,
  require: () => ({ controllerChoices: ['A', 'B', 'C', 'D'], loadAppSettings: () => ({ controllerKeys: keys }) }),
  document: { body, createElement: () => new Element(), querySelectorAll: () => dialogs, getElementById: () => root },
  window: { addEventListener: (key, fn) => { events[key] = fn } },
  getComputedStyle: () => ({ visibility: 'visible' }),
  MutationObserver: class { constructor(fn) { observer = fn } observe() {} },
  requestAnimationFrame: fn => fn(),
})
const refresh = () => observer([{ target: root }])
function key(value, extras = {}) {
  const event = { key: value, target: root, preventDefault() { this.prevented = true }, stopImmediatePropagation() { this.stopped = true }, ...extras }
  events.keydown(event)
  return event
}
candidates = Array.from({ length: 8 }, (_, i) => new Element(`Action ${i}`))
exports.installFourButtonController()
assert.equal(body.children[0].children.length, 4)
key('1')
assert.equal(candidates[0].clicks, 1)
key('4'); key('2')
assert.equal(candidates[4].clicks, 1, 'Extra actions are reachable through More')
key('4'); key('2')
assert.equal(candidates[7].clicks, 1)
const modalAction = new Element('Done')
const modal = new Element(); modal.items = [modalAction]; dialogs = [modal]
refresh(); const handled = key('1')
assert.equal(modalAction.clicks, 1, 'Modal actions replace background controls')
assert(handled.prevented && handled.stopped, 'Legacy handlers cannot activate a second action')
key('1', { repeat: true })
assert.equal(modalAction.clicks, 1, 'Held buttons do not skip steps')
const input = new Element(); input.tag = 'input'
assert(!key('1', { target: input }).prevented, 'Typing in settings is preserved')
dialogs = []; candidates = [new Element('Disabled'), new Element('Next')]; candidates[0].disabled = true
refresh(); key('1')
assert.equal(candidates[0].clicks, 0)
assert.equal(candidates[1].clicks, 1)
keys.A = 'x'; key('x')
assert.equal(candidates[1].clicks, 2, 'Custom controller keys are used immediately')
console.log('Four-button controls: paging, dialogs, disabled actions, custom keys, typing, and repeat suppression passed.')
