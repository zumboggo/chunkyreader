import { progressStorage } from './progressStorage'
import { emptyReadingState, makeReadingPlan, type GuidedReadingPlan, type GuidedReadingState } from './guidedWords'

export const guidedStateKey = (deckId: string) => `chunky-reader:word-recognition:v2:guided:${deckId}`
export const guidedPlanKey = (deckId: string, lesson: number) => `${guidedStateKey(deckId)}:lesson:${lesson}`
export function loadGuidedReadingState(deckId: string): GuidedReadingState {
  try {
    const parsed = JSON.parse(progressStorage.getItem(guidedStateKey(deckId)) ?? 'null')
    if (parsed && Number.isInteger(parsed.stage) && parsed.stage >= 0 && parsed.words
      && Array.isArray(parsed.completedSessions) && Array.isArray(parsed.sentences)) return parsed
  } catch { /* A fresh local plan is safe if storage is unavailable. */ }
  return emptyReadingState()
}
export function loadGuidedReadingPlan(deckId: string, lesson: number): GuidedReadingPlan {
  try {
    const cached = JSON.parse(progressStorage.getItem(guidedPlanKey(deckId, lesson)) ?? 'null')
    if (cached && Array.isArray(cached.words) && cached.words.length === 4 && cached.sentence) return cached
  } catch { /* Use the current curriculum pocket. */ }
  return makeReadingPlan(loadGuidedReadingState(deckId))
}
