import { controllerChoices, loadAppSettings } from './appSettings'

/** One mapping for every screen, including dialogs and newly added activities. */
export function installFourButtonController() {
  const dock = document.createElement('nav')
  dock.className = 'four-button-controller'
  dock.setAttribute('aria-label', 'Four button controls')
  document.body.append(dock)
  let page = 0
  let previous: HTMLElement[] = []
  let actions: Array<HTMLElement | null> = []
  let hasMore = false
  const controls = controllerChoices.map((choice, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.addEventListener('click', () => activate(index))
    button.dataset.choice = choice
    dock.append(button)
    return button
  })
  function visible(element: HTMLElement) {
    return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
      && !element.closest('[hidden], [inert], [aria-hidden="true"]')
  }
  function refresh() {
    const dialogs = [...document.querySelectorAll<HTMLElement>('.modal-content, [role="dialog"], [aria-modal="true"]')].filter(visible)
    const scope = dialogs.at(-1) ?? document.getElementById('root')!
    const candidates = [...scope.querySelectorAll<HTMLElement>('button, a[href], [role="button"], input[type="checkbox"]')]
      .filter(element => visible(element) && !element.matches(':disabled, [aria-disabled="true"]'))
    // Keep the learning choices first; navigation remains reachable through More.
    const priority = (el: HTMLElement) => el.matches('.focus-option, .choice-button, .fsrs-btn') ? 0
      : el.matches('.choice-action, .path-start-button, .primary, .rating-button') ? 1 : 2
    candidates.sort((a, b) => priority(a) - priority(b))
    if (candidates.length !== previous.length || candidates.some((el, i) => el !== previous[i])) page = 0
    previous = candidates
    hasMore = candidates.length > 4
    const size = hasMore ? 3 : 4
    page %= Math.max(1, Math.ceil(candidates.length / size))
    actions = candidates.slice(page * size, page * size + size)
    if (hasMore) actions[3] = null
    const settings = loadAppSettings()
    controls.forEach((control, i) => {
      const target = actions[i]
      const label = hasMore && i === 3 ? 'More buttons' : target?.getAttribute('aria-label')
        || target?.querySelector('h2, h3, strong')?.textContent
        || target?.innerText.trim().replace(/\s+/g, ' ') || target?.getAttribute('title') || (target ? 'Select' : '—')
      const shortLabel = label.length > 52 ? `${label.slice(0, 49)}…` : label
      const text = `${settings.controllerKeys[controllerChoices[i]] || controllerChoices[i]} · ${shortLabel}`
      if (control.textContent !== text) control.textContent = text
      control.disabled = !target && !(hasMore && i === 3)
    })
  }
  function activate(index: number) {
    refresh()
    if (index === 3 && hasMore) { page++; refresh(); return }
    const target = actions[index]
    if (target) {
      target.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      target.click()
    }
  }
  window.addEventListener('keydown', event => {
    const target = event.target
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
      || (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select')))) return
    const settings = loadAppSettings()
    const index = controllerChoices.findIndex(choice => settings.controllerKeys[choice]?.toLowerCase() === event.key.toLowerCase())
    if (index < 0) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!event.repeat) activate(index)
  }, true)
  let scheduled = false
  new MutationObserver(records => {
    if (scheduled || records.every(record => dock.contains(record.target))) return
    scheduled = true
    requestAnimationFrame(() => { scheduled = false; refresh() })
  }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
  window.addEventListener('resize', refresh)
  window.addEventListener('chunkyLearnerSettingsChanged', refresh)
  refresh()
}
