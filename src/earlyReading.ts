import soundModels from './content/guided-sounds.json'
import type { LearningCard } from './types'
import { READING_LEXICON, type ReadingWord } from './guidedWords'

/** Two sounds per toddler visit: one focus and one familiar contrast. */
export function earlyReadingPocket(cards: LearningCard[], start: number): LearningCard[] {
  if (!cards.length) return []
  const index = Math.max(0, Math.min(cards.length - 1, start))
  if (index === 0) return cards.slice(0, 2)
  const card = cards[index]
  // M, S, A and P are already familiar to Sarah. Prefer one as a reassuring anchor.
  const earlier = cards.slice(0, index)
  const familiar = earlier.filter(c => ['m', 's', 'a', 'p'].includes(spelling(c)))
  const word = earlyReadingWord([card, ...earlier])
  const partner = word?.sounds.length === 2 && word.sounds.some(unit => unit.spelling === spelling(card))
    ? earlier.find(c => word.sounds.some(unit => unit.spelling === spelling(c))) : undefined
  const contrast = partner ?? earlyReadingContrast(familiar, card, index) ?? earlyReadingContrast(earlier, card)
  return contrast ? [card, contrast] : [card]
}

const spelling = (card: LearningCard) => card.lowercase ?? card.grapheme ?? card.displayText

/** Identical printed choices (c/k, the two th sounds) cannot test sound-to-print. */
export function earlyReadingContrast(cards: LearningCard[], card: LearningCard, repetition = 0): LearningCard | undefined {
  const candidates = cards.filter(c => c.id !== card.id && spelling(c) !== spelling(card)
    && (c.ipa ?? c.phoneme) !== (card.ipa ?? card.phoneme))
  return candidates[repetition % candidates.length]
}

/** Only blend audited words whose spellings AND pronunciations have been modeled. */
export function earlyReadingWord(cards: LearningCard[]): ReadingWord | undefined {
  const sounds: Record<string, { ipa: string }> = soundModels
  const focus = spelling(cards[0])
  return Object.values(READING_LEXICON).filter(w => w.sounds.length <= 3 && w.sounds.length >= 2
    && w.sounds.every(unit => cards.some(card => spelling(card) === unit.spelling
      && sounds[unit.sound]?.ipa === (card.ipa ?? card.phoneme?.replaceAll('/', '')))))
    .sort((a, b) => Number(b.sounds.some(u => u.spelling === focus)) - Number(a.sounds.some(u => u.spelling === focus))
      || a.text.length - b.text.length || a.text.localeCompare(b.text))[0]
}

export function soundPosition(card: LearningCard): 'start' | 'end' | 'middle' {
  const word = card.exampleWord ?? ''
  const letters = spelling(card)
  if (word.startsWith(letters)) return 'start'
  if (word.endsWith(letters)) return 'end'
  return 'middle'
}

/** Preserve the old sequence's position and revisit the earliest unvisited new sound. */
export const LEGACY_SOUND_ORDER = ["phoneme-m", "phoneme-p", "phoneme-b", "phoneme-t", "phoneme-d", "phoneme-k", "phoneme-g", "phoneme-f", "phoneme-v", "phoneme-s", "phoneme-z", "phoneme-sh", "phoneme-ch", "phoneme-j", "phoneme-h", "phoneme-n", "phoneme-ng", "phoneme-l", "phoneme-r", "phoneme-w", "phoneme-y", "phoneme-th-voiceless", "phoneme-th-voiced", "phoneme-short-a", "phoneme-short-e", "phoneme-short-i", "phoneme-short-o", "phoneme-short-u", "phoneme-ee", "phoneme-ay", "phoneme-ie", "phoneme-oa", "phoneme-oo-moon", "phoneme-oo-book", "phoneme-ow", "phoneme-oy", "phoneme-er", "phoneme-aw"]
export function migrateSoundResume(cards: LearningCard[], legacyIndex: number): number {
  const visited = new Set(LEGACY_SOUND_ORDER.slice(0, Math.max(0, legacyIndex)))
  const next = cards.findIndex(card => !visited.has(card.id))
  return Math.max(0, next)
}
export function earlyReadingProgressKey(deckId: string): string {
  return `sarah-progress-${deckId}${deckId === 'sarah-phonemes-level-2' ? ':phonics-v2' : ''}`
}
