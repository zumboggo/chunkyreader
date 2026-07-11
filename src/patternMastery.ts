import { recordLocalProgressChange } from './cloudProgressSync'

// Stepping-stone ladder for each taught phonics pattern. Question difficulty
// per pattern climbs one rung at a time and only after repeated first-try
// success, so Anna never sees a "which word has this chunk?" style question
// for a pattern she hasn't already tapped, heard, and read successfully.
//
// rung 0: tap the pattern inside a word (guided)
// rung 1: pick the word that carries the sound vs a clearly different word
// rung 2: hear a word, pick it among two words that SHARE the pattern
// rung 3: pattern-identification ("which word has <chunk>?") with near misses
export const MAX_PATTERN_RUNG = 3

export interface PatternMastery {
  rung: number
  firstTryStreak: number
  totalCorrect: number
  totalAttempts: number
  introducedAt?: number
  lastPracticedAt?: number
}

const STORAGE_PREFIX = 'chunky-reader:pattern-mastery:v1:'
const RUNG_UP_STREAK = 2
const NEAR_MISS_UNLOCK_CORRECT = 1

export function readPatternMastery(deckId: string, patternId: string): PatternMastery {
  try {
    const raw = localStorage.getItem(patternKey(deckId, patternId))
    if (!raw) return emptyMastery()
    const parsed = JSON.parse(raw) as Partial<PatternMastery>
    return {
      rung: clampRung(parsed.rung),
      firstTryStreak: Math.max(0, Number(parsed.firstTryStreak) || 0),
      totalCorrect: Math.max(0, Number(parsed.totalCorrect) || 0),
      totalAttempts: Math.max(0, Number(parsed.totalAttempts) || 0),
      introducedAt: parsed.introducedAt,
      lastPracticedAt: parsed.lastPracticedAt,
    }
  } catch {
    return emptyMastery()
  }
}

export function recordPatternIntroduced(deckId: string, patternId: string) {
  const mastery = readPatternMastery(deckId, patternId)
  if (mastery.introducedAt) return
  writePatternMastery(deckId, patternId, { ...mastery, introducedAt: Date.now() })
}

/**
 * Record one answered pattern question. Only the FIRST tap of a question
 * counts (guided retries always end in success and are never held against
 * her): first-try success climbs toward the next rung, a miss just resets
 * the streak — the rung never drops, support simply stops advancing.
 */
export function recordPatternAnswer(deckId: string, patternId: string, firstTry: boolean) {
  const mastery = readPatternMastery(deckId, patternId)
  const next: PatternMastery = {
    ...mastery,
    totalAttempts: mastery.totalAttempts + 1,
    totalCorrect: mastery.totalCorrect + (firstTry ? 1 : 0),
    firstTryStreak: firstTry ? mastery.firstTryStreak + 1 : 0,
    lastPracticedAt: Date.now(),
    introducedAt: mastery.introducedAt ?? Date.now(),
  }
  if (firstTry && next.firstTryStreak >= RUNG_UP_STREAK && next.rung < MAX_PATTERN_RUNG) {
    next.rung = next.rung + 1
    next.firstTryStreak = 0
  }
  writePatternMastery(deckId, patternId, next)
}

/** Look-alike / sound-alike distractors are only fair after real success. */
export function isNearMissUnlocked(deckId: string, patternId: string): boolean {
  return readPatternMastery(deckId, patternId).totalCorrect >= NEAR_MISS_UNLOCK_CORRECT
}

export function isPatternMastered(deckId: string, patternId: string): boolean {
  const mastery = readPatternMastery(deckId, patternId)
  return mastery.rung >= MAX_PATTERN_RUNG && mastery.firstTryStreak >= RUNG_UP_STREAK
}

/** 0..4 growth stage for the pattern's garden flower. */
export function patternFlowerStage(deckId: string, patternId: string): number {
  const mastery = readPatternMastery(deckId, patternId)
  if (isPatternMastered(deckId, patternId)) return 4
  return clampRung(mastery.rung)
}

function emptyMastery(): PatternMastery {
  return { rung: 0, firstTryStreak: 0, totalCorrect: 0, totalAttempts: 0 }
}

function clampRung(value: unknown): number {
  const rung = Number(value) || 0
  return Math.max(0, Math.min(MAX_PATTERN_RUNG, Math.floor(rung)))
}

function writePatternMastery(deckId: string, patternId: string, mastery: PatternMastery) {
  try {
    localStorage.setItem(patternKey(deckId, patternId), JSON.stringify(mastery))
    recordLocalProgressChange()
  } catch {
    // Pattern tracking must never block a lesson.
  }
}

function patternKey(deckId: string, patternId: string) {
  return `${STORAGE_PREFIX}${deckId}:${patternId}`
}
