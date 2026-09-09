export const ACCOUNT_CHANGED_EVENT = 'chunkyReaderAccountChanged'
export const EXACT_PROGRESS_KEYS = [
  'chunkyLearnerProgress.v1', 'chunkyLearnerSettings.v1', 'chunkyLearnerContinue.v1',
  'completed-lessons-anna', 'completed-lessons-sarah', 'completed-lessons-100',
  '100-lessons-progress', 'chunky-learner:math-progress:v1',
]
export const PROGRESS_PREFIXES = [
  'sarah-progress-', 'anna-words-progress-', 'chunky-reader:story:',
  'chunky-reader:card-progress:', 'chunky-reader:older-reader-phonemes:',
  'chunky-reader:flashcard-states:', 'chunky-reader:word-recognition:',
  'chunky-reader:pattern-mastery:', 'chunky-reader:green-eggs:milestones:',
]
export const LEARNER_SCOPES = ['shared', 'anna', 'sarah', '100-lessons'] as const
export type LearnerScope = typeof LEARNER_SCOPES[number]
export function isProgressKey(key: string) {
  return EXACT_PROGRESS_KEYS.includes(key) || PROGRESS_PREFIXES.some(prefix => key.startsWith(prefix))
}
export function learnerScope(key: string): LearnerScope {
  if (key === '100-lessons-progress' || key === 'completed-lessons-100') return '100-lessons'
  if (key.includes('sarah')) return 'sarah'
  if (key.includes('anna') || key.includes('older-reader') || key.includes('word-recognition')
    || key.includes('pattern-mastery') || key.includes('green-eggs') || key.includes(':story:')
    || key.includes('math-progress') || key.includes('math-addition') || key.includes('math-subtraction') || key.includes('story-vocab')) return 'anna'
  return 'shared'
}
export function compactProgressKeys(keys: Record<string, string>) {
  const result = { ...keys }
  const lessons = new Map<string, { key: string; number: number }[]>()
  for (const key of Object.keys(result)) {
    const match = /^(chunky-reader:word-recognition:.*:lesson:)(\d+)$/.exec(key)
    if (match) {
      const group = lessons.get(match[1]) ?? []
      group.push({ key, number: Number(match[2]) }); lessons.set(match[1], group)
    }
    if (key.startsWith('chunky-reader:word-recognition:') && !match) {
      try {
        const value = JSON.parse(result[key])
        if (Array.isArray(value.successfulLessonIds) && value.successfulLessonIds.length > 32) {
          value.successfulLessons = Math.max(value.successfulLessons || 0, value.successfulLessonIds.length)
          value.successfulLessonIds = value.successfulLessonIds.slice(-32)
          result[key] = JSON.stringify(value)
        }
      } catch { /* Preserve unrecognized legacy data. */ }
    }
  }
  for (const group of lessons.values()) {
    for (const lesson of group.sort((a,b) => b.number - a.number).slice(20)) delete result[lesson.key]
  }
  return result
}
const PREFIX = 'chunky-reader:account:v2:'
const MIGRATED = 'chunky-reader:account-migration:v2'
const LAST_ACCOUNT = 'chunky-reader:last-account:v2'
const METADATA_KEY = 'chunky-reader:cloud-sync:metadata:v1'

/** A Storage adapter: callers keep their logical keys, physical keys isolate each account and learner. */
export class AccountStorage {
  account = 'guest'
  epoch = 0
  private readonly storage?: Storage
  constructor(raw?: Storage) { this.storage = raw }
  private get raw() { return this.storage ?? window.localStorage }
  private prefix(account = this.account) { return `${PREFIX}${account}:` }
  private physical(key: string, account = this.account) { return `${this.prefix(account)}${learnerScope(key)}:${key}` }
  activate(userId: string | null) {
    const next = userId || 'guest'
    if (!this.raw.getItem(MIGRATED)) {
      let owner = 'guest'
      try { owner = JSON.parse(this.raw.getItem(METADATA_KEY) || '{}').userId || 'guest' } catch { /* guest */ }
      const legacy = Array.from({ length: this.raw.length }, (_, i) => this.raw.key(i)!)
        .filter(key => isProgressKey(key) || key === METADATA_KEY)
      // Copy everything before removing anything. A quota failure leaves the legacy data intact.
      for (const key of legacy) {
        const target = this.physical(key, owner)
        if (this.raw.getItem(target) === null) this.raw.setItem(target, this.raw.getItem(key)!)
      }
      this.raw.setItem(MIGRATED, 'true')
      for (const key of legacy) this.raw.removeItem(key)
    }
    const changed = this.account !== next
    this.account = next
    this.raw.setItem(LAST_ACCOUNT, next)
    if (changed) this.epoch++
    return changed
  }
  keys(account = this.account) {
    const prefix = this.prefix(account)
    return Array.from({ length: this.raw.length }, (_, i) => this.raw.key(i)!)
      .filter(key => key.startsWith(prefix))
      .map(key => key.slice(prefix.length).replace(/^[^:]+:/u, ''))
  }
  get length() { return this.keys().length }
  key(index: number) { return this.keys()[index] ?? null }
  getItem(key: string) { return this.raw.getItem(this.physical(key)) }
  setItem(key: string, value: string) {
    this.raw.setItem(this.physical(key), value)
    if (key.startsWith('chunky-reader:word-recognition:') && /:lesson:\d+$/.test(key)) {
      const lessonKeys = this.keys().filter(k => k.startsWith('chunky-reader:word-recognition:') && /:lesson:\d+$/.test(k))
      const retained = compactProgressKeys(Object.fromEntries(lessonKeys.map(k => [k, this.getItem(k)!])))
      for (const old of lessonKeys) if (!(old in retained)) this.removeItem(old)
    }
  }
  removeItem(key: string) { this.raw.removeItem(this.physical(key)) }
  guestKeys(): Record<string, string> {
    return Object.fromEntries(this.keys('guest').filter(isProgressKey)
      .map(key => [key, this.raw.getItem(this.physical(key, 'guest'))!]))
  }
  lastAccount() { return this.raw.getItem(LAST_ACCOUNT) || 'guest' }
}
export const progressStorage = new AccountStorage()
