import type { LearningCard, LearningDeck } from './types'
import { isWordMastered, readWordRecognitionProgress } from './wordLessonProgress'
import { recordLocalProgressChange } from './cloudProgressSync'

/**
 * The single reading goal of the Words section: the 50 words of
 * "Green Eggs and Ham". Every progress meter around Words points at
 * masteredBookWords / 50 so the child sees one journey toward one book.
 */
export const GREEN_EGGS_STARTER_WORDS = new Set([
  'a',
  'am',
  'and',
  'anywhere',
  'are',
  'be',
  'boat',
  'box',
  'car',
  'could',
  'dark',
  'do',
  'eat',
  'eggs',
  'fox',
  'goat',
  'good',
  'green',
  'ham',
  'here',
  'house',
  'i',
  'if',
  'in',
  'let',
  'like',
  'may',
  'me',
  'mouse',
  'not',
  'on',
  'or',
  'rain',
  'sam',
  'say',
  'see',
  'so',
  'thank',
  'that',
  'the',
  'them',
  'there',
  'they',
  'train',
  'tree',
  'try',
  'will',
  'with',
  'would',
  'you',
])

export const GREEN_EGGS_WORD_TOTAL = GREEN_EGGS_STARTER_WORDS.size

export interface GreenEggsProgress {
  mastered: number
  growing: number
  total: number
  percent: number
}

function bookWordLabel(card: LearningCard): string {
  return (card.word || card.displayText || card.grapheme || card.exampleWord || '').toLowerCase()
}

export function isBookWord(card: LearningCard): boolean {
  return GREEN_EGGS_STARTER_WORDS.has(bookWordLabel(card))
    || (card.tags ?? []).some((tag) => tag.toLowerCase() === 'green-eggs-starter')
}

export function getGreenEggsProgress(decks: LearningDeck[]): GreenEggsProgress {
  const seen = new Set<string>()
  let mastered = 0
  let growing = 0
  for (const deck of decks) {
    if (deck.type !== 'reading-words') continue
    for (const card of deck.cards) {
      if (!isBookWord(card)) continue
      const label = bookWordLabel(card)
      if (seen.has(label)) continue
      seen.add(label)
      if (isWordMastered(deck.id, card.id)) {
        mastered += 1
      } else {
        const progress = readWordRecognitionProgress(deck.id, card.id)
        if (progress.introducedAt || progress.successfulLessons > 0) growing += 1
      }
    }
  }
  const total = GREEN_EGGS_WORD_TOTAL
  const clampedMastered = Math.min(mastered, total)
  return {
    mastered: clampedMastered,
    growing,
    total,
    percent: total > 0 ? Math.round((clampedMastered / total) * 100) : 0,
  }
}

// Milestone celebrations (every 10 mastered book words) fire exactly once per
// device account — celebrated milestones are persisted and synced.
const MILESTONES_PREFIX = 'chunky-reader:green-eggs:milestones:'

export function milestonesKey(deckId: string) {
  return `${MILESTONES_PREFIX}${deckId}`
}

export function readCelebratedMilestones(deckId: string): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(milestonesKey(deckId)) || '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === 'number') : []
  } catch {
    return []
  }
}

export function markMilestoneCelebrated(deckId: string, milestone: number) {
  try {
    const current = readCelebratedMilestones(deckId)
    if (current.includes(milestone)) return
    localStorage.setItem(milestonesKey(deckId), JSON.stringify([...current, milestone].sort((a, b) => a - b)))
    recordLocalProgressChange()
  } catch {
    // Celebration bookkeeping must never block a lesson.
  }
}
