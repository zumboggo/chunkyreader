import { controllerChoices, loadAppSettings } from './appSettings'

/** Choice shortcuts operate the current activity; menus keep their normal navigation. */
export function installFourButtonController() {
  window.addEventListener('keydown', event => {
    const target = event.target
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
      || (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select')))) return
    const settings = loadAppSettings()
    const fixedIndex = ['x', 'y', 'a', 'b'].indexOf(event.key.toLowerCase())
    const numberIndex = ['1', '2', '3', '4'].indexOf(event.key)
    const index = fixedIndex >= 0 ? fixedIndex : numberIndex >= 0 ? numberIndex : controllerChoices.findIndex(choice => settings.controllerKeys[choice]?.toLowerCase() === event.key.toLowerCase())
    if (index < 0) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.repeat || document.querySelector('.modal-overlay, [role="dialog"]')) return
    const activity = document.querySelector('.focus-lesson, .lesson-complete, .focus-complete, .adventure-player')
    if (!activity) return
    const buttons = [...activity.querySelectorAll<HTMLButtonElement>('button')]
      .filter(button => button.getClientRects().length > 0
        && !button.closest('[hidden], [inert], [aria-hidden="true"]')
        && getComputedStyle(button).visibility !== 'hidden'
        && !/\b(home|back|menu|collection|flashcards)\b/i.test(button.textContent || '')
        && !button.closest('.math-diff-bar'))
    const choices = buttons.filter(button => button.matches('.focus-option, .choice-button, .choice-action, .fsrs-btn, .focus-actions button, .focus-complete button, .adventure-choices button'))
    const audio = buttons.filter(button => !choices.includes(button) && button.matches('.audio-prompt-button'))
    // Keep disabled answers in their positions; never remap a held key to another action.
    const button = [...choices, ...audio][index]
    if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') button.click()
  }, true)
}
