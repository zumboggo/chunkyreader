import assert from 'node:assert/strict'
class MemoryStorage implements Storage {
  data = new Map<string,string>()
  get length() { return this.data.size }
  key(n: number) { return [...this.data.keys()][n] ?? null }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
}
const raw = new MemoryStorage()
Object.assign(globalThis, { window: { localStorage: raw } })
const { AccountStorage, compactProgressKeys } = await import('../src/progressStorage.ts')
raw.setItem('completed-lessons-anna','8')
raw.setItem('unrelated-app','keep')
const store = new AccountStorage(raw)
store.activate('alice')
assert.equal(store.getItem('completed-lessons-anna'),null, 'Legacy guest progress must not silently join an account')
assert.equal(store.guestKeys()['completed-lessons-anna'],'8')
store.setItem('completed-lessons-anna','12')
store.setItem('sarah-progress-letters','4')
store.activate('bob')
assert.equal(store.getItem('completed-lessons-anna'),null)
store.setItem('completed-lessons-anna','2')
store.activate('alice')
assert.equal(store.getItem('completed-lessons-anna'),'12')
assert.equal(store.getItem('sarah-progress-letters'),'4')
store.activate(null)
assert.equal(store.getItem('completed-lessons-anna'),'8')
assert.equal(raw.getItem('unrelated-app'),'keep')
assert([...raw.data.keys()].some(key => key.includes('alice:anna:')))
assert([...raw.data.keys()].some(key => key.includes('alice:sarah:')))
store.activate('alice')
for (let i = 1; i <= 100; i++) store.setItem(`chunky-reader:word-recognition:v1:deck:lesson:deck:lesson:${i}`,'["cat"]')
assert.equal(store.keys().filter(key => key.includes(':lesson:')).length,20)
const old = new MemoryStorage()
old.setItem('completed-lessons-anna','19')
old.setItem('chunky-reader:cloud-sync:metadata:v1',JSON.stringify({userId:'alice'}))
const migrated = new AccountStorage(old)
migrated.activate('bob')
assert.equal(migrated.getItem('completed-lessons-anna'),null)
migrated.activate('alice')
assert.equal(migrated.getItem('completed-lessons-anna'),'19')
const masteryKey = 'chunky-reader:word-recognition:v1:deck:cat'
const compact = compactProgressKeys({[masteryKey]:JSON.stringify({successfulLessons:100,successfulLessonIds:Array.from({length:100},(_,i)=>String(i))})})
assert.equal(JSON.parse(compact[masteryKey]).successfulLessons,100)
assert.equal(JSON.parse(compact[masteryKey]).successfulLessonIds.length,32)
console.log('Account, learner, guest migration, unrelated data, and bounded history checks passed.')
