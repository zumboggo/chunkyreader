import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const sourcePath = path.join(root, 'src', 'rewards.ts')
const source = await fs.readFile(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  },
}).outputText

const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
const rewards = await import(moduleUrl)

const {
  REWARD_CATALOG,
  awardBoxesForCompletedLessons,
  equipReward,
  normalizeRewardProgress,
  openPandaBox,
} = rewards

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function baseProgress(overrides = {}) {
  return normalizeRewardProgress({
    totalLessonsCompleted: 0,
    rewardedCompletionCount: 0,
    completedLessonsBySection: {
      letters: 0,
      sounds: 0,
      words: 0,
      stories: 0,
      math: 0,
      chinese: 0,
    },
    completedLessonsByDeck: {},
    unlockedRewards: [],
    storyCompletions: {},
    ...overrides,
  })
}

assert(REWARD_CATALOG.length === 40, `Expected 40 rewards, found ${REWARD_CATALOG.length}.`)

const rarityCounts = REWARD_CATALOG.reduce((counts, item) => {
  counts[item.rarity] = (counts[item.rarity] || 0) + 1
  return counts
}, {})

assert(rarityCounts.common === 18, `Expected 18 common rewards, found ${rarityCounts.common || 0}.`)
assert(rarityCounts.uncommon === 10, `Expected 10 uncommon rewards, found ${rarityCounts.uncommon || 0}.`)
assert(rarityCounts.rare === 7, `Expected 7 rare rewards, found ${rarityCounts.rare || 0}.`)
assert(rarityCounts.epic === 4, `Expected 4 epic rewards, found ${rarityCounts.epic || 0}.`)
assert(rarityCounts.legendary === 1, `Expected 1 legendary reward, found ${rarityCounts.legendary || 0}.`)

const threeLessons = awardBoxesForCompletedLessons(baseProgress({ totalLessonsCompleted: 3 }))
assert(threeLessons.boxesAwarded === 1, 'Three lessons should award exactly one Panda Box.')
assert(threeLessons.progress.unopenedBoxes === 1, 'Awarded Panda Box should be stored as unopened.')

const sixLessons = awardBoxesForCompletedLessons(baseProgress({
  totalLessonsCompleted: 6,
  rewardedCompletionCount: 3,
  unopenedBoxes: 1,
}))
assert(sixLessons.boxesAwarded === 1, 'Six lessons after count 3 should award one more Panda Box.')
assert(sixLessons.progress.unopenedBoxes === 2, 'Existing unopened boxes should be preserved.')

const migratedOnce = normalizeRewardProgress(baseProgress({
  totalLessonsCompleted: 10,
  rewardSystemVersion: 1,
}))
const migratedTwice = normalizeRewardProgress(migratedOnce)
assert((migratedOnce.rewardInventory['red-scarf'] || 0) === 1, 'Milestone rewards should migrate into inventory.')
assert((migratedTwice.rewardInventory['red-scarf'] || 0) === 1, 'Milestone migration should be idempotent.')

const firstOpen = openPandaBox(baseProgress({ unopenedBoxes: 1 }), () => 0)
assert(firstOpen.item, 'Opening a box should return an item.')
assert((firstOpen.progress.rewardInventory[firstOpen.item.id] || 0) === 1, 'Opened item should be owned.')

const duplicateOpen = openPandaBox(baseProgress({
  unopenedBoxes: 1,
  rewardInventory: { [firstOpen.item.id]: 1 },
}), () => 0)
assert(duplicateOpen.drop.duplicate, 'Opening an already-owned item should mark the drop as duplicate.')
assert(duplicateOpen.progress.sparklePoints > 0, 'Duplicate drops should add Sparkle Points.')

const ownedEquip = equipReward(firstOpen.progress, firstOpen.item.id)
assert(ownedEquip.equippedRewards[firstOpen.item.slot] === firstOpen.item.id, 'Owned items should be equippable.')

const blockedEquip = equipReward(baseProgress(), firstOpen.item.id)
assert(!blockedEquip.equippedRewards[firstOpen.item.slot], 'Unowned items should not be equippable.')

const rarePity = openPandaBox(baseProgress({ unopenedBoxes: 1, rarePityCount: 20 }), () => 0)
assert(['rare', 'epic', 'legendary'].includes(rarePity.item.rarity), 'Rare pity should force Rare or better.')

const epicPity = openPandaBox(baseProgress({ unopenedBoxes: 1, epicPityCount: 60 }), () => 0)
assert(['epic', 'legendary'].includes(epicPity.item.rarity), 'Epic pity should force Epic or better.')

console.log('Verified Panda reward catalog and loot box rules.')

let furnished = baseProgress({ rewardInventory: Object.fromEntries(REWARD_CATALOG.map(item => [item.id, 1])) })
for (const item of REWARD_CATALOG) {
  furnished = rewards.autoPlaceReward(furnished, item.id)
}
const slots = Object.keys(rewards.rewardsBySlot([]))
const counts = slots.map(slot => Object.values(furnished.roomPlacements).filter(value => value === slot).length)
assert(Math.max(...counts) - Math.min(...counts) <= 1, 'Automatic placement balances all room areas without replacing prizes.')
assert(Object.keys(furnished.roomPlacements).length === REWARD_CATALOG.length, 'Every prize has its own placement.')
const again = rewards.autoPlaceReward(furnished, REWARD_CATALOG[0].id)
assert(JSON.stringify(again.roomPlacements) === JSON.stringify(furnished.roomPlacements), 'Duplicate prizes preserve placement.')
assert(firstOpen.progress.roomPlacements[firstOpen.item.id], 'Closing immediately after opening cannot lose placement.')
const manual = equipReward(furnished, REWARD_CATALOG[0].id)
assert(manual.roomPlacements[REWARD_CATALOG[0].id] === REWARD_CATALOG[0].slot, 'Manual placement overrides automatic placement.')
assert(JSON.stringify(normalizeRewardProgress(manual).roomPlacements) === JSON.stringify(manual.roomPlacements), 'Saved placement survives reload.')
console.log('Room placement: balanced areas, full rooms, duplicates, manual placement, and reload passed.')

// Reproduce the old cloud-merge bug against the actual merge implementation.
const vm = await import('node:vm')
const cloudSource = await fs.readFile(path.join(root, 'src/cloudProgressSync.ts'), 'utf8')
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)
  if (start < 0) throw new Error(`Missing ${name}`)
  return source.slice(start, source.indexOf('\n}', start) + 2)
}
const cloudExports = {}
const cloudCode = ['mergeLearnerProgress', 'mergeSectionCounts', 'mergeNumberRecords', 'mergeRewardHistory', 'unionStrings', 'timeValue'].map(name => extractFunction(cloudSource, name)).join('\n') + '\nexports.merge = mergeLearnerProgress'
vm.runInNewContext(ts.transpileModule(cloudCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: cloudExports, normalizeRewardProgress, mergeBoxBalances: rewards.mergeBoxBalances, Map, Set, Date, Math, Object })
const stale = baseProgress({ totalLessonsCompleted: 36, rewardedCompletionCount: 36, unopenedBoxes: 12 })
let spent = stale
for (let i = 0; i < 12; i++) spent = openPandaBox(spent, () => 0).progress
assert(spent.unopenedBoxes === 0, 'All twelve boxes were spent')
for (let i = 0; i < 5; i++) {
  spent = cloudExports.merge(spent, stale)
  assert(spent.unopenedBoxes === 0, 'Stale sync must never resurrect the twelve boxes')
}
const earnedAgain = awardBoxesForCompletedLessons({ ...spent, totalLessonsCompleted: 39 })
assert(earnedAgain.boxesAwarded === 1 && earnedAgain.progress.unopenedBoxes === 1, 'Three new lessons still earn one real box')
assert(cloudExports.merge(stale, spent).unopenedBoxes === 0, 'Merge order does not change spent balance')
const legacySpent = { ...spent }
delete legacySpent.boxesEarned; delete legacySpent.boxesOpened
assert(cloudExports.merge(legacySpent, stale).unopenedBoxes === 0, 'Old opening history repairs legacy resurrection')
assert(Object.keys(spent.rewardInventory).length > 0, 'Repair preserves owned prizes')

// Exercise persistent reward idempotence, without any network or account access.
const progressSource = await fs.readFile(path.join(root, 'src/progress.ts'), 'utf8')
const progressExports = {}, saved = new Map()
vm.runInNewContext(ts.transpileModule(progressSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
  { exports: progressExports, require: key => key === './rewards' ? rewards : key === './progressStorage' ? { progressStorage: { getItem: k => saved.get(k) ?? null, setItem: (k,v) => saved.set(k,v) } } : { recordLocalProgressChange() {} }, console, Date })
for (let i = 0; i < 12; i++) progressExports.markLessonComplete('letters', 'letters', 'same-attempt')
assert(progressExports.loadProgress().totalLessonsCompleted === 1, 'Repeated completion callbacks count once')
progressExports.markLessonComplete('letters', 'letters', 'second-attempt')
progressExports.markLessonComplete('letters', 'letters', 'third-attempt')
assert(progressExports.loadProgress().unopenedBoxes === 1, 'Three genuine attempts earn one box')
console.log('Stale-cloud twelve-box reproduction, legacy repair, and persistent completion idempotence passed.')
