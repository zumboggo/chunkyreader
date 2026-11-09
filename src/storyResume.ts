import { progressStorage } from './progressStorage.ts'

type Store = Pick<Storage, 'getItem' | 'setItem'>
export type StoryResumeItem = { id: string; title: string; kind: 'book' | 'adventure' }
const key = (id: string) => `chunky-reader:story:${id}:resume`
function read(store: Store, name: string) { try { return JSON.parse(store.getItem(name) || 'null') } catch { return null } }
export function rememberStoryVisit(id: string, kind: StoryResumeItem['kind'], finished = false, store: Store = progressStorage, now = Date.now()) {
  try { store.setItem(key(id), JSON.stringify({kind, finished, updatedAt: now})) } catch { /* Reading works without storage. */ }
}
export function latestUnfinishedStory(items: StoryResumeItem[], store: Store = progressStorage): StoryResumeItem | undefined {
  const last = read(store, 'chunkyLearnerContinue.v1')
  const completed = read(store, 'chunkyLearnerProgress.v1')?.storyCompletions || {}
  return items.map(item => {
    const visit = read(store, key(item.id))
    const saved = read(store, `chunky-reader:story:${item.id}:${item.kind === 'book' ? 'page' : 'adventure'}`)
    const validSave = item.kind === 'book' ? Number.isInteger(saved) && saved >= 0
      : saved && Array.isArray(saved.steps) && saved.steps.length < 100 && saved.steps.every((s: unknown) => s === null || typeof s === 'string') && ['words','story'].includes(saved.phase) && ['read','listen'].includes(saved.mode) && Number.isInteger(saved.word) && saved.word >= 0 && saved.word < 5
    if (!validSave || visit?.finished === true || (!visit && completed[item.id])) return null
    const updatedAt = Number.isFinite(visit?.updatedAt) ? visit.updatedAt : last?.section === 'stories' && last.storyId === item.id ? 1 : 0
    return {...item, updatedAt}
  }).filter((item): item is StoryResumeItem & {updatedAt: number} => !!item).sort((a,b) => b.updatedAt - a.updatedAt)[0]
}
