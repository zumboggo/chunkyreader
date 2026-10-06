import { progressStorage } from './progressStorage'
import { emptyReadingState, makeReadingPlan, GUIDED_PLAN_VERSION, READING_POCKETS, type GuidedReadingPlan, type GuidedReadingState } from './guidedWords'

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
  const stage = Math.max(0, Math.min(READING_POCKETS.length - 1, lesson - 1))
  try {
    const cached = JSON.parse(progressStorage.getItem(guidedPlanKey(deckId, lesson)) ?? 'null')
    if (cached?.version === GUIDED_PLAN_VERSION && cached.stage === stage && cached.attemptId
      && Array.isArray(cached.words) && cached.words.length >= 4 && cached.words.length <= 5
      && cached.checkOrder?.length === 4 && cached.sentence
      && !loadGuidedReadingState(deckId).completedAttempts?.includes(cached.attemptId)) return cached
  } catch { /* Use the current curriculum pocket. */ }
  return makeReadingPlan({ ...loadGuidedReadingState(deckId), stage })
}

// Recover the resume pointer even if a previous save stopped after recording results.
export function guidedCompletedLessonNumber(deckId: string): number {
  const prefix = `${deckId}:`
  return loadGuidedReadingState(deckId).completedSessions.reduce((latest, session) => {
    const number = session.startsWith(prefix) ? Number(session.slice(prefix.length)) : 0
    return Number.isSafeInteger(number) && number > latest ? number : latest
  }, 0)
}

export const guidedSelectedLessonKey = (deckId: string) => `${guidedStateKey(deckId)}:selected`
/** Explicit dropdown choices and unfinished replays take precedence over the legacy high-water mark. */
export function guidedResumeLessonNumber(deckId: string): number | undefined {
  const selected = Number(progressStorage.getItem(guidedSelectedLessonKey(deckId)))
  if (!Number.isInteger(selected) || selected < 1 || selected > READING_POCKETS.length) return undefined
  try {
    const plan = JSON.parse(progressStorage.getItem(guidedPlanKey(deckId, selected)) ?? 'null')
    if (plan?.attemptId && loadGuidedReadingState(deckId).completedAttempts?.includes(plan.attemptId)) {
      return Math.min(selected + 1, READING_POCKETS.length)
    }
  } catch { /* Keep the explicit selection; only rebuild its plan. */ }
  return selected
}
