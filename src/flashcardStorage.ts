import { createNewCard, type FlashcardState } from './fsrs'
import { recordLocalProgressChange } from './cloudProgressSync'

const FLASHCARD_PREFIX = 'chunky-reader:flashcard-states:'

export function getFlashcardStorageKey(deckId: string): string {
  return `${FLASHCARD_PREFIX}${deckId}`
}

export function loadFlashcardStates(deckId: string): Map<string, FlashcardState> {
  const states = new Map<string, FlashcardState>()
  try {
    const raw = localStorage.getItem(getFlashcardStorageKey(deckId))
    if (!raw) return states
    const parsed = JSON.parse(raw) as FlashcardState[]
    for (const state of parsed) {
      if (state.cardId) states.set(state.cardId, state)
    }
  } catch {
    return states
  }
  return states
}

export function saveFlashcardStates(deckId: string, states: Map<string, FlashcardState>): void {
  try {
    const array = [...states.values()]
    localStorage.setItem(getFlashcardStorageKey(deckId), JSON.stringify(array))
    recordLocalProgressChange()
  } catch {
    // Persistence is optional; the current learning session can continue.
  }
}

export function getCardState(deckId: string, cardId: string): FlashcardState {
  const states = loadFlashcardStates(deckId)
  return states.get(cardId) ?? createNewCard(cardId, deckId)
}

export function updateCardState(deckId: string, card: FlashcardState): void {
  const states = loadFlashcardStates(deckId)
  states.set(card.cardId, card)
  saveFlashcardStates(deckId, states)
}

export function getDueCardCount(deckId: string): number {
  const states = loadFlashcardStates(deckId)
  const now = Date.now()
  let count = 0
  for (const state of states.values()) {
    if (state.due <= now) count++
  }
  return count
}

export function getNewCardCount(deckId: string, totalCards: number): number {
  const states = loadFlashcardStates(deckId)
  return Math.max(0, totalCards - states.size)
}
