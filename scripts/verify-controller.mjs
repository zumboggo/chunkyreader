import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'

// Exercise the shared event dispatcher with changing screens and modal controls.
let candidates = []
let modalOpen = false
const events = {}
class Element {
  constructor(label = '') { this.textContent = label; this.innerText = label; this.children = []; this.attrs = {}; this.dataset = {}; this.handlers = {}; this.clicks = 0; this.tag = 'button' }
  append(child) { this.children.push(child); child.parent = this }
  setAttribute(key, value) { this.attrs[key] = value }
  getAttribute(key) { return this.attrs[key] ?? null }
  addEventListener(key, fn) { this.handlers[key] = fn }
  getClientRects() { return this.hidden ? [] : [{}] }
  closest() { return null }
  contains(node) { return node === this || this.children.some(child => child.contains(node)) }
  matches(selector) {
    if (selector.includes('.focus-option')) return this.action !== false
    if (selector.startsWith(':disabled')) return this.disabled === true
    if (selector === 'input, textarea, select') return this.tag === 'input'
    return false
  }
  querySelector() { return null }
  querySelectorAll() { return this.items ?? candidates }
  scrollIntoView() {}
  click() { this.clicks++; this.handlers.click?.() }
}
const root = new Element()
const keys = { A: '1', B: '2', C: '3', D: '4' }
const code = ts.transpileModule(fs.readFileSync('src/fourButtonController.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
vm.runInNewContext(code, {
  exports, HTMLElement: Element,
  require: () => ({ controllerChoices: ['A', 'B', 'C', 'D'], loadAppSettings: () => ({ controllerKeys: keys }) }),
  document: { querySelector: selector => selector.includes('modal') ? (modalOpen ? {} : null) : root },
  window: { addEventListener: (key, fn) => { events[key] = fn } },
  getComputedStyle: () => ({ visibility: 'visible' }),
  requestAnimationFrame: fn => fn(),
})
function key(value, extras = {}) {
  const event = { key: value, target: root, preventDefault() { this.prevented = true }, stopImmediatePropagation() { this.stopped = true }, ...extras }
  events.keydown(event)
  return event
}
candidates = [new Element('I knew it'), new Element('Help me'), new Element('Home')]
exports.installFourButtonController()
const handled = key('1')
assert.equal(candidates[0].clicks, 1)
assert(handled.prevented && handled.stopped, 'Legacy shortcuts cannot also act')
key('2'); assert.equal(candidates[1].clicks, 1)
key('3'); key('4'); assert.equal(candidates[2].clicks, 0, 'Extra keys never activate Home')
candidates[0].disabled = true
key('1'); assert.equal(candidates[1].clicks, 1, 'Disabled actions do not shift another button into their place')
key('2', { repeat: true }); assert.equal(candidates[1].clicks, 1)
modalOpen = true; key('2'); assert.equal(candidates[1].clicks, 1, 'Modal blocks lesson shortcuts')
modalOpen = false
const input = new Element(); input.tag = 'input'
assert(!key('1', { target: input }).prevented, 'Dropdown and text input remain native')
keys.B = 'x'; key('x'); assert.equal(candidates[1].clicks, 2)
candidates = [new Element('Next lesson: 2')]
key('1'); assert.equal(candidates[0].clicks, 1, 'Completion advances within Words')
console.log('Safe lesson buttons: no navigation, no remapping, repeat suppression, custom keys, and next lesson passed.')
