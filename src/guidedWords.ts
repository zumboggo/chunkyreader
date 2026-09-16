/** Original practice material, not a reproduction of the 100 Easy Lessons sequence. */
export interface ReadingWord { text: string; parts: string[] }
export interface ReadingPocket {
  title: string
  cue: string
  words: ReadingWord[]
  sentence: string
}
const word = (parts: string): ReadingWord => ({ text: parts.replaceAll('|', ''), parts: parts.split('|') })
const pocket = (title: string, cue: string, words: string[], sentence: string): ReadingPocket =>
  ({ title, cue, words: words.map(word), sentence })

export const READING_POCKETS: ReadingPocket[] = [
  pocket('Keep both starting sounds', 'Slide through each sound. Keep both sounds at the start.', ['s|t|o|p', 's|p|i|n', 's|p|o|t', 's|t|e|p'], 'A cat can spin.'),
  pocket('Little l blends', 'Keep the l sound as you blend the whole word.', ['f|l|a|g', 'f|l|a|t', 'c|l|a|p', 's|l|i|p'], 'A flag can flap.'),
  pocket('Little r blends', 'Say both starting sounds, then blend to the end.', ['f|r|o|g', 'd|r|i|p', 't|r|a|p', 'g|r|i|n'], 'A frog can hop.'),
  pocket('Keep the ending', 'Read right to the last sound. Do not leave the ending behind.', ['t|e|n|t', 'b|e|n|d', 'h|a|n|d', 's|a|n|d'], 'An ant is in a tent.'),
  pocket('More ending blends', 'Keep both sounds at the end.', ['m|i|l|k', 'h|e|l|p', 'j|u|m|p', 'l|a|m|p'], 'A frog can jump.'),
  pocket('Blends at both ends', 'Blend all the way through, from the first sound to the last.', ['s|t|a|m|p', 'p|l|a|n|t', 'c|r|i|s|p', 'b|l|e|n|d'], 'A plant is in a pot.'),
  pocket('Two letters, one sh sound', 'In these words, s and h work together to spell one sound.', ['sh|i|p', 'sh|o|p', 'f|i|sh', 'd|i|sh'], 'A fish is in a dish.'),
  pocket('Two letters, one ch sound', 'In these words, c and h work together to spell one sound.', ['ch|i|p', 'ch|o|p', 'ch|i|n', 'ch|a|t'], 'A chip is in a bag.'),
  pocket('Two letters, one th sound', 'Listen to the beginning of thin. The two letters spell one sound.', ['th|i|n', 'th|u|d', 'm|o|th', 'b|a|th'], 'A moth is in a bath.'),
  pocket('Listen for ng', 'At the end of sing, n and g work together to spell one sound.', ['s|i|ng', 'r|i|ng', 'l|o|ng', 's|o|ng'], 'A long song is fun.'),
  pocket('Read the ing ending', 'Read the base word, then add ing. An extra consonant keeps the vowel short.', ['jump|ing', 'help|ing', 'run|ning', 'sit|ting'], 'A cat is jumping.'),
  pocket('Two small parts', 'Read each part, then put the parts together into one word.', ['sun|set', 'pic|nic', 'rab|bit', 'nap|kin'], 'A rabbit can hop.'),
  pocket('Longer words you can build', 'Find the two readable parts, then blend them together.', ['cat|nip', 'cat|nap', 'bed|bug', 'sun|lit'], 'A bedbug is on a bed.'),
  pocket('Longer word adventure', 'Read each part carefully. Say the whole word naturally.', ['den|tist', 'cac|tus', 'vel|vet', 'in|sect'], 'An insect is on a cactus.'),
]

export interface WordReadingRecord {
  independentDays: string[]
  selfReportedDays?: string[]
  dueAt: number
  lastAt: number
  lastResult: 'independent' | 'self-reported' | 'helped'
}
export interface GuidedReadingState {
  stage: number
  words: Record<string, WordReadingRecord>
  completedSessions: string[]
  sentences: { session: string; text: string; independent: boolean; readAloud?: boolean; at: number }[]
}
export interface GuidedReadingPlan {
  stage: number
  title: string
  cue: string
  words: ReadingWord[]
  sentence: string
  support: string[]
  reviewWord?: string
}
export type ReadingStep = { kind: 'welcome' | 'sentence' } | { kind: 'teach' | 'blend' | 'build' | 'read'; word: ReadingWord }
export const emptyReadingState = (): GuidedReadingState => ({ stage: 0, words: {}, completedSessions: [], sentences: [] })
const DAY = 86_400_000
const ALTERNATE_SENTENCES = [
  'A dog can stop.', 'A cat can clap.', 'A frog can grin.', 'An ant is on a hand.',
  'A cat can jump.', 'A stamp is on a bag.', 'A fish is in a ship.', 'A chip is in a dish.',
  'A thin cat is in a bath.', 'A long song can help.', 'A frog is jumping.', 'A rabbit is at a picnic.',
  'A cat is on a sunlit bed.', 'A dentist can help.',
]

export function makeReadingPlan(state: GuidedReadingState, now = Date.now()): GuidedReadingPlan {
  const stage = Math.max(0, Math.min(READING_POCKETS.length - 1, state.stage))
  const current = READING_POCKETS[stage]
  // Review a previously introduced word only when it is due, not every easy word every day.
  const previous = READING_POCKETS.slice(0, stage).flatMap(p => p.words)
  const review = previous.filter(w => state.words[w.text] && state.words[w.text].dueAt <= now)
    .sort((a, b) => Number(state.words[a.text].lastResult !== 'helped') - Number(state.words[b.text].lastResult !== 'helped')
      || state.words[a.text].dueAt - state.words[b.text].dueAt)[0]
  const words = review ? [...current.words.slice(0, 3), review] : current.words
  // Function words are supported explicitly before the final independent attempt.
  const previousAttempts = state.sentences.filter(s => s.text === current.sentence || s.text === ALTERNATE_SENTENCES[stage]).length
  const sentence = previousAttempts % 2 ? ALTERNATE_SENTENCES[stage] : current.sentence
  return { stage, title: current.title, cue: current.cue, words, sentence, support: ['is'], reviewWord: review?.text }
}

export function readingSteps(plan: GuidedReadingPlan): ReadingStep[] {
  const review = plan.words.find(word => word.text === plan.reviewWord)
  const newWords = plan.words.filter(word => word.text !== plan.reviewWord)
  return [
    { kind: 'welcome' },
    // A due word is checked BEFORE any model, so the result measures retention.
    ...(review ? [{ kind: 'read' as const, word: review }] : []),
    ...newWords.map(word => ({ kind: 'teach' as const, word })),
    ...plan.words.map(word => ({ kind: 'blend' as const, word })),
    ...plan.words.slice(0, 2).map(word => ({ kind: 'build' as const, word })),
    // Delay print-only checks until after other activities; never autoplay their answers.
    ...newWords.map(word => ({ kind: 'read' as const, word })),
    { kind: 'sentence' },
  ]
}

export function applyReadingResult(
  state: GuidedReadingState, plan: GuidedReadingPlan, session: string,
  results: Record<string, boolean>, sentenceIndependent: boolean, now = Date.now(),
): GuidedReadingState {
  if (state.completedSessions.includes(session)) return state
  const day = new Date(now).toISOString().slice(0, 10)
  const words = { ...state.words }
  for (const word of plan.words) {
    const old = words[word.text]
    const independent = results[word.text] === true
    const selfReportedDays = independent
      ? [...new Set([...(old?.selfReportedDays ?? []), day])].slice(-8)
      : old?.selfReportedDays ?? []
    const days = independent ? [1, 3, 7][Math.min(2, Math.max(0, selfReportedDays.length - 1))] : 1
    words[word.text] = { independentDays: old?.independentDays ?? [], selfReportedDays, dueAt: now + days * DAY, lastAt: now,
      lastResult: independent ? 'self-reported' : 'helped' }
  }
  const ready = sentenceIndependent && plan.words.filter(w => results[w.text]).length >= 3
  return {
    stage: ready ? Math.max(state.stage, Math.min(READING_POCKETS.length - 1, plan.stage + 1)) : state.stage,
    words,
    completedSessions: [...state.completedSessions, session].slice(-32),
    sentences: [...state.sentences, { session, text: plan.sentence, independent: sentenceIndependent, readAloud: true, at: now }].slice(-20),
  }
}

/** Change one internal/end part as well as beginnings, always with two choices. */
export function buildReadingTile(word: ReadingWord, index: number) {
  const position = index % 2 === 0 ? word.parts.length - 1 : Math.min(1, word.parts.length - 1)
  const correct = word.parts[position]
  const alternate = correct === 'a' ? 'i' : correct === 'i' ? 'o' : correct === 'ing' ? 'ed' : correct === 't' ? 'p' : 't'
  return { position, correct, choices: index % 2 ? [alternate, correct] : [correct, alternate] }
}
