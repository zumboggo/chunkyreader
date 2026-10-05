import { controllerChoices, loadAppSettings } from './appSettings'

/** Physical buttons only operate the current activity, never app navigation. */
export function installFourButtonController() {
  window.addEventListener('keydown', event => {
    const target = event.target
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
      || (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select')))) return
    const settings = loadAppSettings()
    const index = controllerChoices.findIndex(choice => settings.controllerKeys[choice]?.toLowerCase() === event.key.toLowerCase())
    if (index < 0) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.repeat || document.querySelector('.modal-overlay, [role="dialog"]')) return
    const activity = document.querySelector('.focus-lesson, .lesson-complete')
    if (!activity) return
    const buttons = [...activity.querySelectorAll<HTMLButtonElement>('button')]
      .filter(button => button.getClientRects().length > 0
        && !button.closest('[hidden], [inert], [aria-hidden="true"]')
        && getComputedStyle(button).visibility !== 'hidden'
        && !/\b(home|done|back|menu|collection|flashcards)\b/i.test(button.textContent || '')
        && !button.closest('.math-diff-bar'))
    const choices = buttons.filter(button => button.matches('.focus-option, .choice-button, .choice-action, .fsrs-btn'))
    const audio = buttons.filter(button => !choices.includes(button) && button.matches('.audio-prompt-button'))
    // Keep disabled answers in their positions; never remap a held key to another action.
    const button = [...choices, ...audio][index]
    if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') button.click()
  }, true)
}
