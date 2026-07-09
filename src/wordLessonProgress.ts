import type { LearningCard } from './types'
import { recordLocalProgressChange } from './cloudProgressSync'

export interface WordRecognitionProgress {
  successfulLessons: number
  successfulLessonIds: string[]
  lastPracticedAt?: number
  introducedAt?: number
}

const STORAGE_PREFIX = 'chunky-reader:word-recognition:v1:'
const STARTER_WORD_LIMIT = 50

export function selectWordLessonCards(deckId: string, cards: LearningCard[], lessonId: string): LearningCard[] {
  const wordCards = cards.filter((card) => card.type === 'word')
  const storedIds = readStoredLessonIds(deckId, lessonId)
  if (storedIds.length) {
    const storedCards = storedIds
      .map((id) => wordCards.find((card) => card.id === id))
      .filter((card): card is LearningCard => Boolean(card))
    if (storedCards.length === storedIds.length) return storedCards
  }
  const starterCards = wordCards.slice(0, STARTER_WORD_LIMIT)
  const starterComplete = starterCards.length > 0 && starterCards.every((card) => isWordMastered(deckId, card.id))
  const available = starterComplete ? wordCards : starterCards
  const unseen = available.filter((card) => !readWordRecognitionProgress(deckId, card.id).introducedAt)

  if (unseen.length >= 4 && available.every((card) => !readWordRecognitionProgress(deckId, card.id).introducedAt)) {
    return unseen.slice(0, 4)
  }

  const newCards = unseen.slice(0, 2)
  const selectedIds = new Set(newCards.map((card) => card.id))
  const reviewCards = available
    .filter((card) => !selectedIds.has(card.id))
    .sort((a, b) => compareReviewPriority(deckId, a, b))
    .slice(0, 4 - newCards.length)
  const lessonCards = [...newCards, ...reviewCards]

  if (lessonCards.length < 4) {
    lessonCards.push(...available.filter((card) => !lessonCards.some((item) => item.id === card.id)).slice(0, 4 - lessonCards.length))
  }

  return lessonCards
}

export function markWordLessonIntroduced(deckId: string, cards: LearningCard[], lessonId: string) {
  markWordsIntroduced(deckId, cards, lessonId)
}

export function recordWordLessonResults(
  deckId: string,
  lessonId: string,
  cards: LearningCard[],
  firstTryCorrectCounts: Record<string, number>,
) {
  const practicedAt = Date.now()
  for (const card of cards) {
    const progress = readWordRecognitionProgress(deckId, card.id)
    const successful = (firstTryCorrectCounts[card.id] ?? 0) >= 2
    const successfulLessonIds = successful && !progress.successfulLessonIds.includes(lessonId)
      ? [...progress.successfulLessonIds, lessonId]
      : progress.successfulLessonIds
    writeWordRecognitionProgress(deckId, card.id, {
      ...progress,
      successfulLessons: successfulLessonIds.length,
      successfulLessonIds,
      lastPracticedAt: practicedAt,
      introducedAt: progress.introducedAt ?? practicedAt,
    })
  }
}

export function isWordMastered(deckId: string, cardId: string) {
  return readWordRecognitionProgress(deckId, cardId).successfulLessons >= 2
}

/**
 * One-time self-heal for devices whose saved resume index was stuck at 0
 * while words were already being introduced: estimate how many lessons have
 * effectively happened from the per-word introduction records, so the child
 * resumes at a fresh lesson number instead of replaying a cached lesson 1.
 */
export function estimateWordLessonResumeIndex(deckId: string, cards: LearningCard[], lessonSize: number): number {
  const wordCards = cards.filter((card) => card.type === 'word').slice(0, STARTER_WORD_LIMIT)
  let introduced = 0
  for (const card of wordCards) {
    if (readWordRecognitionProgress(deckId, card.id).introducedAt) introduced += 1
  }
  return Math.floor(introduced / lessonSize) * lessonSize
}

export function readWordRecognitionProgress(deckId: string, cardId: string): WordRecognitionProgress {
  try {
    const raw = localStorage.getItem(wordProgressKey(deckId, cardId))
    if (!raw) return { successfulLessons: 0, successfulLessonIds: [] }
    const parsed = JSON.parse(raw) as Partial<WordRecognitionProgress>
    const successfulLessonIds = Array.isArray(parsed.successfulLessonIds)
      ? parsed.successfulLessonIds.filter((value): value is string => typeof value === 'string')
      : []
    return {
      successfulLessons: Math.max(parsed.successfulLessons ?? successfulLessonIds.length, successfulLessonIds.length),
      successfulLessonIds,
      lastPracticedAt: parsed.lastPracticedAt,
      introducedAt: parsed.introducedAt,
    }
  } catch {
    return { successfulLessons: 0, successfulLessonIds: [] }
  }
}

function markWordsIntroduced(deckId: string, cards: LearningCard[], lessonId: string) {
  const introducedAt = Date.now()
  for (const card of cards) {
    const progress = readWordRecognitionProgress(deckId, card.id)
    if (progress.introducedAt) continue
    writeWordRecognitionProgress(deckId, card.id, {
      ...progress,
      introducedAt,
      successfulLessonIds: progress.successfulLessonIds,
    })
  }
  try {
    localStorage.setItem(lessonStorageKey(deckId, lessonId), JSON.stringify(cards.map((card) => card.id)))
  } catch {
    // Lesson selection can still continue without storage.
  }
}

function readStoredLessonIds(deckId: string, lessonId: string): string[] {
  try {
    const raw = localStorage.getItem(lessonStorageKey(deckId, lessonId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function compareReviewPriority(deckId: string, a: LearningCard, b: LearningCard) {
  const aProgress = readWordRecognitionProgress(deckId, a.id)
  const bProgress = readWordRecognitionProgress(deckId, b.id)
  const aMastered = aProgress.successfulLessons >= 2 ? 1 : 0
  const bMastered = bProgress.successfulLessons >= 2 ? 1 : 0
  if (aMastered !== bMastered) return aMastered - bMastered
  if (aProgress.successfulLessons !== bProgress.successfulLessons) {
    return aProgress.successfulLessons - bProgress.successfulLessons
  }
  return (aProgress.lastPracticedAt ?? 0) - (bProgress.lastPracticedAt ?? 0)
}

function writeWordRecognitionProgress(deckId: string, cardId: string, progress: WordRecognitionProgress) {
  try {
    localStorage.setItem(wordProgressKey(deckId, cardId), JSON.stringify(progress))
    recordLocalProgressChange()
  } catch {
    // Recognition tracking should never block a lesson.
  }
}

function wordProgressKey(deckId: string, cardId: string) {
  return `${STORAGE_PREFIX}${deckId}:${cardId}`
}

function lessonStorageKey(deckId: string, lessonId: string) {
  return `${STORAGE_PREFIX}${deckId}:lesson:${lessonId}`
}
