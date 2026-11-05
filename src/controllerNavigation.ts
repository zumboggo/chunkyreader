type Direction = 'left' | 'right' | 'up' | 'down'
const selector = 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'

function visible(element: HTMLElement) {
  return element.getClientRects().length > 0
    && !element.closest('[hidden], [inert], [aria-hidden="true"]')
    && getComputedStyle(element).visibility !== 'hidden'
}

/** One navigation layer for every screen, including dynamically mounted lessons. */
export function installControllerNavigation() {
  let active = false
  let frame = 0
  let previous = new Set<string>()
  const repeatAt = new Map<string, number>()
  let lastScope: ParentNode = document
  const modalOrigins: HTMLElement[] = []

  function scope(): ParentNode {
    return [...document.querySelectorAll<HTMLElement>('.modal-overlay, [role="dialog"], dialog[open]')]
      .filter(visible).at(-1) ?? document
  }
  function controls(root = scope()) {
    return [...root.querySelectorAll<HTMLElement>(selector)].filter(element => visible(element)
      && !element.matches(':disabled, [aria-disabled="true"], input[type="hidden"]'))
  }
  function focus(element: HTMLElement | undefined) {
    if (!element) return
    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  function ensureFocus() {
    const root = scope()
    const items = controls(root)
    if (root !== lastScope) {
      if (root !== document && root instanceof Node && !root.contains(lastScope as Node)) {
        if (document.activeElement instanceof HTMLElement) modalOrigins.push(document.activeElement)
      } else {
        const origin = modalOrigins.pop()
        if (origin && items.includes(origin)) focus(origin)
      }
      lastScope = root
    }
    if (!items.includes(document.activeElement as HTMLElement)) focus(items[0])
    return items
  }
  function enable() {
    active = true
    document.documentElement.classList.add('controller-navigation')
    return ensureFocus()
  }
  function move(direction: Direction) {
    const items = enable()
    const current = document.activeElement as HTMLElement
    const rect = current?.getBoundingClientRect()
    if (!rect) return
    const horizontal = direction === 'left' || direction === 'right'
    const sign = direction === 'left' || direction === 'up' ? -1 : 1
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const candidates = items.filter(item => item !== current).map(item => {
      const r = item.getBoundingClientRect()
      const dx = r.left + r.width / 2 - x
      const dy = r.top + r.height / 2 - y
      const forward = (horizontal ? dx : dy) * sign
      const sideways = Math.abs(horizontal ? dy : dx)
      return { item, forward, score: forward + sideways * 3 }
    }).filter(candidate => candidate.forward > 1).sort((a, b) => a.score - b.score)
    focus(candidates[0]?.item)
  }
  function cycle(delta: number) {
    const items = enable()
    const index = items.indexOf(document.activeElement as HTMLElement)
    focus(items[(index + delta + items.length) % items.length])
  }
  function back() {
    const items = enable()
    const close = items.find(item => item.matches('[data-controller-back], .close-button, .menu-close, .room-back-button'))
      ?? items.find(item => /^(?:←\s*)?(back\b|close\b|all categories\b)/i.test(item.getAttribute('aria-label') || item.textContent?.trim() || ''))
      ?? (scope() === document ? items.find(item => item.matches('.section-home-button, .menu-home')) : undefined)
    close?.click()
  }
  function select() {
    enable()
    const element = document.activeElement as HTMLElement
    if (element instanceof HTMLSelectElement) {
      // A native picker needs a trusted keyboard/touch event in some browsers.
      try { element.showPicker() } catch { /* D-pad changes the selected option below. */ }
    } else element?.click()
  }
  function adjust(direction: Direction) {
    const element = document.activeElement
    const delta = direction === 'left' || direction === 'up' ? -1 : 1
    if (element instanceof HTMLSelectElement) {
      const options = [...element.options]
      let next = element.selectedIndex + delta
      while (next >= 0 && next < options.length && options[next].disabled) next += delta
      if (next >= 0 && next < options.length) {
        element.selectedIndex = next
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }
      return true
    }
    if (element instanceof HTMLInputElement && element.type === 'range') {
      if (delta > 0) element.stepUp(); else element.stepDown()
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    return false
  }
  function action(name: string) {
    if (['up', 'down', 'left', 'right'].includes(name)) {
      enable()
      if (!adjust(name as Direction)) move(name as Direction)
    } else if (name === 'select') select()
    else if (name === 'back') back()
    else cycle(name === 'next' ? 1 : -1)
  }
  function keydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target
    const editing = target instanceof HTMLElement && (target.isContentEditable || target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea'))
    if (editing) return
    const keys: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'select', ' ': 'select', Escape: 'back', BrowserBack: 'back', GoBack: 'back', Tab: event.shiftKey ? 'previous' : 'next' }
    const name = keys[event.key]
    if (!name) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!event.repeat || !['select', 'back'].includes(name)) action(name)
  }
  function pointer() {
    active = false
    document.documentElement.classList.remove('controller-navigation')
  }
  function poll(now: number) {
    const held = new Set<string>()
    if (!document.hidden && document.hasFocus()) {
      let pads: (Gamepad | null)[] = []
      try { pads = [...(navigator.getGamepads?.() ?? [])] } catch { /* Unsupported or blocked API: keyboard still works. */ }
      for (const pad of pads) {
        if (!pad || pad.mapping !== 'standard') continue
        const pressed = (index: number) => pad.buttons[index]?.pressed
        const names = [
          pressed(12) || pad.axes[1] < -0.55 ? 'up' : '',
          pressed(13) || pad.axes[1] > 0.55 ? 'down' : '',
          pressed(14) || pad.axes[0] < -0.55 ? 'left' : '',
          pressed(15) || pad.axes[0] > 0.55 ? 'right' : '',
          pressed(0) ? 'select' : '', pressed(1) ? 'back' : '',
          pressed(4) ? 'previous' : '', pressed(5) ? 'next' : '',
        ]
        names.filter(Boolean).forEach(name => held.add(name))
      }
      for (const name of held) {
        if (!previous.has(name)) {
          action(name)
          repeatAt.set(name, now + 400)
        } else if (!['select', 'back'].includes(name) && now >= (repeatAt.get(name) ?? Infinity)) {
          action(name)
          repeatAt.set(name, now + 140)
        }
      }
      if (active) ensureFocus()
    }
    previous = held
    frame = requestAnimationFrame(poll)
  }
  window.addEventListener('keydown', keydown, true)
  window.addEventListener('pointerdown', pointer, true)
  frame = requestAnimationFrame(poll)
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('keydown', keydown, true)
    window.removeEventListener('pointerdown', pointer, true)
    document.documentElement.classList.remove('controller-navigation')
  }
}
