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
