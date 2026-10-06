import content from './content/guided-words.json'

/** Original curriculum, independent of the 100 Easy Lessons book sequence. */
export interface SoundUnit { spelling: string; sound: string; positions: number[] }
export interface ReadingWord { text: string; parts: string[]; sounds: SoundUnit[]; meaning?: string }
export interface MeaningPrompt { question: string; answer: string }
export interface ReadingPocket {
  title: string; cue: string; words: ReadingWord[]; sentence: string; alternateSentence: string
  meaningPrompts: MeaningPrompt[]
}
export const READING_LEXICON: Record<string, ReadingWord> = content.lexicon
export const READING_HELPERS: Record<string, { ipa: string; note: string }> = content.helpers
export const READING_POCKETS: ReadingPocket[] = content.lessons.map(p => ({ ...p, words: p.words.map(w => READING_LEXICON[w]) }))
export const GUIDED_PLAN_VERSION = 3
export interface WordReadingRecord {
  independentDays: string[]; selfReportedDays?: string[]; dueAt: number; lastAt: number
  lastResult: 'independent' | 'self-reported' | 'helped'
}
export interface GuidedReadingState {
  stage: number; words: Record<string, WordReadingRecord>; completedSessions: string[]; completedAttempts?: string[]; lessonVisits?: Record<string, number>
  sentences: { session: string; attemptId?: string; text: string; independent: boolean; readAloud?: boolean; at: number }[]
}
export interface GuidedReadingPlan {
  savedAt?: number; version: number; attemptId: string; stage: number; title: string; cue: string
  words: ReadingWord[]; sentence: string; support: string[]; meaningPrompt: MeaningPrompt
  reviewWord?: string; checkOrder: string[]
  progress?: { index: number; results: Record<string, boolean>; helped: boolean }
}
export type ReadingStep = { kind: 'welcome' | 'sentence' } | { kind: 'teach' | 'build' | 'read'; word: ReadingWord }
export const emptyReadingState = (): GuidedReadingState => ({ stage: 0, words: {}, completedSessions: [], completedAttempts: [], sentences: [] })
const DAY = 86_400_000
export function makeReadingPlan(state: GuidedReadingState, now = Date.now()): GuidedReadingPlan {
  const stage = Math.max(0, Math.min(READING_POCKETS.length - 1, state.stage))
  const current = READING_POCKETS[stage]
  const previous = READING_POCKETS.slice(0, stage).flatMap(p => p.words)
  const review = previous.filter(w => !current.words.some(target => target.text === w.text)
    && state.words[w.text] && state.words[w.text].dueAt <= now)
    .sort((a, b) => Number(state.words[a.text].lastResult !== 'helped') - Number(state.words[b.text].lastResult !== 'helped')
      || state.words[a.text].dueAt - state.words[b.text].dueAt)[0]
  const variant = (state.lessonVisits?.[stage] ?? state.sentences.filter(s => s.text === current.sentence || s.text === current.alternateSentence).length) % 2
  const sentence = variant ? current.alternateSentence : current.sentence
  const checkOrder = current.words.map(w => w.text)
  for (let i = checkOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [checkOrder[i], checkOrder[j]] = [checkOrder[j], checkOrder[i]]
  }
  // Avoid repeating the modeled order even when the shuffle happens to produce it.
  if (checkOrder.every((w, i) => w === current.words[i].text)) checkOrder.push(checkOrder.shift()!)
  return { version: GUIDED_PLAN_VERSION, attemptId: globalThis.crypto?.randomUUID() ?? `${now}-${Math.random().toString(36).slice(2)}`,
    stage, title: current.title, cue: current.cue, words: [...current.words, ...(review ? [review] : [])],
    sentence, support: [...new Set(sentence.toLowerCase().match(/[a-z]+/g))].filter(w => w in READING_HELPERS),
    meaningPrompt: current.meaningPrompts[variant], reviewWord: review?.text, checkOrder }
}
export function readingSteps(plan: GuidedReadingPlan): ReadingStep[] {
  const targets = plan.words.slice(0, 4)
  const review = plan.words.find(word => word.text === plan.reviewWord)
  return [
    { kind: 'welcome' },
    ...(review ? [{ kind: 'read' as const, word: review }] : []),
    ...targets.map(word => ({ kind: 'teach' as const, word })),
    ...targets.slice(0, 2).map(word => ({ kind: 'build' as const, word })),
    ...plan.checkOrder.map(text => ({ kind: 'read' as const, word: targets.find(w => w.text === text)! })),
    { kind: 'sentence' },
  ]
}
export function applyReadingResult(state: GuidedReadingState, plan: GuidedReadingPlan, session: string,
  results: Record<string, boolean>, sentenceIndependent: boolean, now = Date.now()): GuidedReadingState {
  if (state.completedAttempts?.includes(plan.attemptId)) return state
  const day = new Date(now).toISOString().slice(0, 10)
  const words = { ...state.words }
  for (const word of plan.words) {
    const old = words[word.text]
    const independent = results[word.text] === true
    const selfReportedDays = independent ? [...new Set([...(old?.selfReportedDays ?? []), day])].slice(-8) : old?.selfReportedDays ?? []
    const days = independent ? [1, 3, 7][Math.min(2, Math.max(0, selfReportedDays.length - 1))] : 1
    words[word.text] = { independentDays: old?.independentDays ?? [], selfReportedDays, dueAt: now + days * DAY, lastAt: now,
      lastResult: independent ? 'self-reported' : 'helped' }
  }
  return {
    stage: Math.max(state.stage, Math.min(READING_POCKETS.length - 1, plan.stage + 1)), words,
    completedSessions: [...new Set([...state.completedSessions, session])],
    completedAttempts: [...(state.completedAttempts ?? []), plan.attemptId].slice(-128),
    lessonVisits: { ...state.lessonVisits, [plan.stage]: (state.lessonVisits?.[plan.stage] ?? state.sentences.filter(s => s.text === READING_POCKETS[plan.stage].sentence || s.text === READING_POCKETS[plan.stage].alternateSentence).length) + 1 },
    sentences: [...state.sentences, { session, attemptId: plan.attemptId, text: plan.sentence, independent: sentenceIndependent, readAloud: true, at: now }].slice(-96),
  }
}
const CONTRASTS: Record<string, string> = {
  a: 'i', i: 'e', e: 'a', o: 'u', u: 'o', 'a_e': 'i_e', 'i_e': 'a_e', 'o_e': 'i_e',
  ee: 'ai', ai: 'oa', oa: 'ee', sh: 'ch', ch: 'sh', th: 'sh', ng: 'n', ck: 'sh',
  s: 'z', z: 's', p: 'b', b: 'p', t: 'd', d: 't', f: 'v', v: 'f', m: 'n', n: 'm',
  r: 'l', l: 'r', g: 'k', k: 'g', c: 'g', h: 'f', j: 'ch', nn: 'mm', tt: 'dd', bb: 'pp', ll: 'ss', ff: 'ss', ss: 'ff',
}
/** Every phoneme is encoded; alternatives contrast sounds rather than random word fragments. */
export function buildReadingTile(word: ReadingWord, position: number, seed = 0) {
  const unit = word.sounds[position]
  const correct = unit.spelling
  const alternate = CONTRASTS[correct]
  if (!alternate) throw new Error(`Missing spelling contrast for ${correct}`)
  return { position, correct, unit, choices: (position + seed) % 2 ? [alternate, correct] : [correct, alternate] }
}
