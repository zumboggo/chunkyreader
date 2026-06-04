import type { LearnerProgress, RewardDrop, RewardItem, RewardRarity, RewardSlot } from './types'

export const REWARD_SYSTEM_VERSION = 2
export const BOX_CADENCE = 3

const DUPLICATE_SPARKLES: Record<RewardRarity, number> = {
  common: 1,
  uncommon: 3,
  rare: 8,
  epic: 20,
  legendary: 50,
}

export const REWARD_CATALOG: RewardItem[] = [
  { id: 'red-scarf', name: 'Red scarf', rarity: 'common', slot: 'neck', description: 'A cozy red scarf for reading days.', badgeText: 'RS', colorTheme: '#f66a8f', duplicateSparkles: 1, lessonsRequired: 1, emoji: 'RS' },
  { id: 'yellow-backpack', name: 'Yellow backpack', rarity: 'common', slot: 'back', description: 'A sunny backpack for lesson trips.', badgeText: 'BP', colorTheme: '#f4b942', duplicateSparkles: 1, lessonsRequired: 3, emoji: 'BP' },
  { id: 'explorer-hat', name: 'Explorer hat', rarity: 'common', slot: 'head', description: 'A little hat for brave learning walks.', badgeText: 'HAT', colorTheme: '#c79353', duplicateSparkles: 1, lessonsRequired: 5, emoji: 'HAT' },
  { id: 'reading-glasses', name: 'Reading glasses', rarity: 'common', slot: 'face', description: 'Round glasses for careful looking.', badgeText: 'GL', colorTheme: '#6288d9', duplicateSparkles: 1, lessonsRequired: 10, emoji: 'GL' },
  { id: 'star-badge', name: 'Star badge', rarity: 'common', slot: 'sticker', description: 'A bright badge for a bright learner.', badgeText: 'STAR', colorTheme: '#ffd65c', duplicateSparkles: 1, lessonsRequired: 15, emoji: 'STAR' },
  { id: 'blue-boots', name: 'Blue boots', rarity: 'common', slot: 'body', description: 'Stompy blue boots for tiny steps.', badgeText: 'BT', colorTheme: '#5bb8f3', duplicateSparkles: 1, lessonsRequired: 20, emoji: 'BT' },
  { id: 'cozy-sweater', name: 'Cozy sweater', rarity: 'uncommon', slot: 'body', description: 'A soft sweater for story time.', badgeText: 'SW', colorTheme: '#b58bf2', duplicateSparkles: 3, lessonsRequired: 30, emoji: 'SW' },
  { id: 'lantern-charm', name: 'Lantern charm', rarity: 'rare', slot: 'hand', description: 'A warm lantern for reading paths.', badgeText: 'LC', colorTheme: '#ff986f', duplicateSparkles: 8, lessonsRequired: 40, emoji: 'LC' },
  { id: 'golden-book-badge', name: 'Golden book badge', rarity: 'rare', slot: 'sticker', description: 'A shiny badge for book friends.', badgeText: 'BOOK', colorTheme: '#e8b93f', duplicateSparkles: 8, lessonsRequired: 50, emoji: 'BOOK' },
  { id: 'rainbow-cape', name: 'Rainbow cape', rarity: 'epic', slot: 'back', description: 'A joyful cape for big celebrations.', badgeText: 'RC', colorTheme: '#9a77ff', duplicateSparkles: 20, lessonsRequired: 75, emoji: 'RC' },
  { id: 'master-learner-crown', name: 'Reading Well Crown', rarity: 'legendary', slot: 'head', description: 'The rare crown from the reading well.', badgeText: 'WELL', colorTheme: '#ffcf33', duplicateSparkles: 50, lessonsRequired: 100, emoji: '100' },

  { id: 'flower-crown', name: 'Flower crown', rarity: 'common', slot: 'head', description: 'Soft flowers for a gentle panda.', badgeText: 'FL', colorTheme: '#ff9ec5', duplicateSparkles: 1 },
  { id: 'rain-hood', name: 'Rain hood', rarity: 'common', slot: 'head', description: 'A tiny hood for rainy learning.', badgeText: 'RH', colorTheme: '#72c9ff', duplicateSparkles: 1 },
  { id: 'heart-glasses', name: 'Heart glasses', rarity: 'common', slot: 'face', description: 'Happy glasses with heart sparkle.', badgeText: 'HG', colorTheme: '#ff7ba7', duplicateSparkles: 1 },
  { id: 'round-glasses', name: 'Round glasses', rarity: 'common', slot: 'face', description: 'Classic glasses for careful eyes.', badgeText: 'RG', colorTheme: '#7c91aa', duplicateSparkles: 1 },
  { id: 'bow-tie', name: 'Bow tie', rarity: 'common', slot: 'neck', description: 'A neat bow for a proud panda.', badgeText: 'BT', colorTheme: '#7bd88f', duplicateSparkles: 1 },
  { id: 'book-vest', name: 'Book vest', rarity: 'common', slot: 'body', description: 'A vest with a tiny book badge.', badgeText: 'BV', colorTheme: '#7fbeff', duplicateSparkles: 1 },
  { id: 'school-bag', name: 'School bag', rarity: 'common', slot: 'back', description: 'A little bag for learning treasures.', badgeText: 'SB', colorTheme: '#f0a955', duplicateSparkles: 1 },
  { id: 'book-charm', name: 'Book charm', rarity: 'common', slot: 'hand', description: 'A small book charm to carry along.', badgeText: 'BK', colorTheme: '#d0a3ff', duplicateSparkles: 1 },
  { id: 'moon-sticker', name: 'Moon sticker', rarity: 'common', slot: 'sticker', description: 'A sleepy moon for calm practice.', badgeText: 'MOON', colorTheme: '#a2b7ff', duplicateSparkles: 1 },
  { id: 'rainbow-sticker', name: 'Rainbow sticker', rarity: 'common', slot: 'sticker', description: 'A cheerful rainbow sticker.', badgeText: 'RB', colorTheme: '#ff9d6c', duplicateSparkles: 1 },
  { id: 'apple-badge', name: 'Apple badge', rarity: 'common', slot: 'sticker', description: 'A crisp apple for good thinking.', badgeText: 'AP', colorTheme: '#ef5f69', duplicateSparkles: 1 },
  { id: 'cloud-patch', name: 'Cloud patch', rarity: 'common', slot: 'body', description: 'A soft cloud patch for the sweater.', badgeText: 'CL', colorTheme: '#9edfff', duplicateSparkles: 1 },

  { id: 'star-crown', name: 'Star crown', rarity: 'uncommon', slot: 'head', description: 'A crown with a small friendly star.', badgeText: 'SC', colorTheme: '#ffd65c', duplicateSparkles: 3 },
  { id: 'rainbow-scarf', name: 'Rainbow scarf', rarity: 'uncommon', slot: 'neck', description: 'A scarf with happy rainbow stripes.', badgeText: 'RBS', colorTheme: '#fb7fa8', duplicateSparkles: 3 },
  { id: 'medal', name: 'Medal', rarity: 'uncommon', slot: 'neck', description: 'A medal for finishing strong.', badgeText: 'MED', colorTheme: '#e3b34a', duplicateSparkles: 3 },
  { id: 'star-hoodie', name: 'Star hoodie', rarity: 'uncommon', slot: 'body', description: 'A hoodie with a bright learner star.', badgeText: 'SH', colorTheme: '#8b78ff', duplicateSparkles: 3 },
  { id: 'raincoat', name: 'Raincoat', rarity: 'uncommon', slot: 'body', description: 'A sunny coat for cloudy words.', badgeText: 'RC', colorTheme: '#f4ca45', duplicateSparkles: 3 },
  { id: 'pencil-wand', name: 'Pencil wand', rarity: 'uncommon', slot: 'hand', description: 'A pencil wand for word magic.', badgeText: 'PW', colorTheme: '#fb9f45', duplicateSparkles: 3 },
  { id: 'tiny-umbrella', name: 'Tiny umbrella', rarity: 'uncommon', slot: 'hand', description: 'A tiny umbrella for drizzly stories.', badgeText: 'UM', colorTheme: '#6ed1d6', duplicateSparkles: 3 },
  { id: 'trophy-badge', name: 'Trophy badge', rarity: 'uncommon', slot: 'sticker', description: 'A little trophy for steady practice.', badgeText: 'WIN', colorTheme: '#ffc84a', duplicateSparkles: 3 },
  { id: 'garden-background', name: 'Garden background', rarity: 'uncommon', slot: 'background', description: 'A gentle garden behind Panda.', badgeText: 'GDN', colorTheme: '#99d989', duplicateSparkles: 3 },

  { id: 'wizard-cap', name: 'Wizard cap', rarity: 'rare', slot: 'head', description: 'A sparkly cap for sound magic.', badgeText: 'WIZ', colorTheme: '#6f60d9', duplicateSparkles: 8 },
  { id: 'butterfly-wings', name: 'Butterfly wings', rarity: 'rare', slot: 'back', description: 'Soft wings for floating through lessons.', badgeText: 'BW', colorTheme: '#f68ed7', duplicateSparkles: 8 },
  { id: 'rocket-pack', name: 'Rocket pack', rarity: 'rare', slot: 'back', description: 'A tiny rocket pack for zoomy wins.', badgeText: 'RP', colorTheme: '#ff785e', duplicateSparkles: 8 },
  { id: 'reading-well-badge', name: 'Reading well badge', rarity: 'rare', slot: 'sticker', description: 'A badge from the reading well path.', badgeText: 'WELL', colorTheme: '#62bcd6', duplicateSparkles: 8 },
  { id: 'golden-pencil', name: 'Golden pencil', rarity: 'rare', slot: 'hand', description: 'A bright pencil for brave readers.', badgeText: 'GP', colorTheme: '#e5bd43', duplicateSparkles: 8 },

  { id: 'aurora-cape', name: 'Aurora cape', rarity: 'epic', slot: 'back', description: 'A glowing cape with northern lights.', badgeText: 'AUR', colorTheme: '#58d8c5', duplicateSparkles: 20 },
  { id: 'moon-crown', name: 'Moon crown', rarity: 'epic', slot: 'head', description: 'A soft crown with a moon glow.', badgeText: 'MC', colorTheme: '#b5a5ff', duplicateSparkles: 20 },
  { id: 'dragon-book-charm', name: 'Dragon book charm', rarity: 'epic', slot: 'hand', description: 'A tiny book charm with brave sparkle.', badgeText: 'DB', colorTheme: '#7bcf83', duplicateSparkles: 20 },
]

const RARITY_WEIGHTS: Array<{ rarity: RewardRarity; weight: number }> = [
  { rarity: 'common', weight: 65 },
  { rarity: 'uncommon', weight: 23 },
  { rarity: 'rare', weight: 9 },
  { rarity: 'epic', weight: 2.5 },
  { rarity: 'legendary', weight: 0.5 },
]

const RARITY_RANK: Record<RewardRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

function cloneProgress(progress: LearnerProgress): LearnerProgress {
  return {
    ...progress,
    completedLessonsBySection: { ...progress.completedLessonsBySection },
    completedLessonsByDeck: { ...progress.completedLessonsByDeck },
    unlockedRewards: [...(progress.unlockedRewards || [])],
    storyCompletions: { ...progress.storyCompletions },
    rewardInventory: { ...(progress.rewardInventory || {}) },
    equippedRewards: { ...(progress.equippedRewards || {}) },
    rewardHistory: [...(progress.rewardHistory || [])],
  }
}

export function normalizeRewardProgress(progress: LearnerProgress): LearnerProgress {
  const normalized = cloneProgress(progress)
  normalized.rewardInventory ||= {}
  normalized.equippedRewards ||= {}
  normalized.rewardHistory ||= []
  normalized.unopenedBoxes = normalized.unopenedBoxes || 0
  normalized.rewardedCompletionCount = normalized.rewardedCompletionCount || 0
  normalized.sparklePoints = normalized.sparklePoints || 0
  normalized.rarePityCount = normalized.rarePityCount || 0
  normalized.epicPityCount = normalized.epicPityCount || 0

  if ((normalized.rewardSystemVersion || 1) < REWARD_SYSTEM_VERSION) {
    const earnedMilestones = REWARD_CATALOG.filter(
      (reward) => reward.lessonsRequired && reward.lessonsRequired <= normalized.totalLessonsCompleted,
    )
    for (const reward of earnedMilestones) {
      normalized.rewardInventory[reward.id] = Math.max(1, normalized.rewardInventory[reward.id] || 0)
    }
    normalized.rewardSystemVersion = REWARD_SYSTEM_VERSION
  }

  return normalized
}

export function awardBoxesForCompletedLessons(progress: LearnerProgress): { progress: LearnerProgress; boxesAwarded: number } {
  const next = normalizeRewardProgress(progress)
  const previousBucket = Math.floor((next.rewardedCompletionCount || 0) / BOX_CADENCE)
  const currentBucket = Math.floor(next.totalLessonsCompleted / BOX_CADENCE)
  const boxesAwarded = Math.max(0, currentBucket - previousBucket)
  if (boxesAwarded > 0) {
    next.unopenedBoxes = (next.unopenedBoxes || 0) + boxesAwarded
  }
  next.rewardedCompletionCount = next.totalLessonsCompleted
  return { progress: next, boxesAwarded }
}

export function getAllUnlockedRewards(completedCount: number): RewardItem[] {
  return REWARD_CATALOG.filter((reward) => reward.lessonsRequired && reward.lessonsRequired <= completedCount)
}

export function getOwnedRewards(progress: LearnerProgress): RewardItem[] {
  const normalized = normalizeRewardProgress(progress)
  return REWARD_CATALOG.filter((reward) => (normalized.rewardInventory?.[reward.id] || 0) > 0)
}

export function getRewardById(id?: string): RewardItem | undefined {
  return REWARD_CATALOG.find((reward) => reward.id === id)
}

export function equipReward(progress: LearnerProgress, rewardId: string): LearnerProgress {
  const next = normalizeRewardProgress(progress)
  const reward = getRewardById(rewardId)
  if (!reward || !next.rewardInventory?.[rewardId]) return next
  next.equippedRewards = {
    ...(next.equippedRewards || {}),
    [reward.slot]: rewardId,
  }
  return next
}

export function unequipReward(progress: LearnerProgress, slot: RewardSlot): LearnerProgress {
  const next = normalizeRewardProgress(progress)
  delete next.equippedRewards?.[slot]
  return next
}

function pickRarity(progress: LearnerProgress, random = Math.random): RewardRarity {
  if ((progress.epicPityCount || 0) >= 60) return pickWeightedRarity(['epic', 'legendary'], random)
  if ((progress.rarePityCount || 0) >= 20) return pickWeightedRarity(['rare', 'epic', 'legendary'], random)
  return pickWeightedRarity(['common', 'uncommon', 'rare', 'epic', 'legendary'], random)
}

function pickWeightedRarity(allowed: RewardRarity[], random: () => number): RewardRarity {
  const weights = RARITY_WEIGHTS.filter((item) => allowed.includes(item.rarity))
  const total = weights.reduce((sum, item) => sum + item.weight, 0)
  let roll = random() * total
  for (const item of weights) {
    roll -= item.weight
    if (roll <= 0) return item.rarity
  }
  return weights[weights.length - 1]?.rarity || 'common'
}

function pickItemByRarity(rarity: RewardRarity, random: () => number): RewardItem {
  const pool = REWARD_CATALOG.filter((reward) => reward.rarity === rarity)
  return pool[Math.floor(random() * pool.length)] || REWARD_CATALOG[0]
}

export function openPandaBox(progress: LearnerProgress, random = Math.random): { progress: LearnerProgress; drop?: RewardDrop; item?: RewardItem; error?: string } {
  const next = normalizeRewardProgress(progress)
  if ((next.unopenedBoxes || 0) <= 0) {
    return { progress: next, error: 'No Panda Boxes to open yet.' }
  }

  const rarity = pickRarity(next, random)
  const item = pickItemByRarity(rarity, random)
  const currentCount = next.rewardInventory?.[item.id] || 0
  const duplicate = currentCount > 0
  const sparklePointsGained = duplicate ? DUPLICATE_SPARKLES[item.rarity] : 0
  const drop: RewardDrop = {
    id: `${Date.now()}-${item.id}`,
    itemId: item.id,
    openedAt: new Date().toISOString(),
    rarity: item.rarity,
    duplicate,
    sparklePointsGained,
  }

  next.unopenedBoxes = Math.max(0, (next.unopenedBoxes || 0) - 1)
  next.rewardInventory = {
    ...(next.rewardInventory || {}),
    [item.id]: currentCount + 1,
  }
  next.sparklePoints = (next.sparklePoints || 0) + sparklePointsGained
  next.rewardHistory = [drop, ...(next.rewardHistory || [])].slice(0, 20)
  next.rarePityCount = RARITY_RANK[item.rarity] >= RARITY_RANK.rare ? 0 : (next.rarePityCount || 0) + 1
  next.epicPityCount = RARITY_RANK[item.rarity] >= RARITY_RANK.epic ? 0 : (next.epicPityCount || 0) + 1

  return { progress: next, drop, item }
}

export function rarityRank(rarity: RewardRarity): number {
  return RARITY_RANK[rarity]
}

export function rewardsBySlot(rewards: RewardItem[]): Record<RewardSlot, RewardItem[]> {
  const grouped: Record<RewardSlot, RewardItem[]> = {
    head: [],
    face: [],
    neck: [],
    body: [],
    back: [],
    hand: [],
    sticker: [],
    background: [],
  }

  for (const reward of rewards) {
    grouped[reward.slot].push(reward)
  }
  return grouped
}
