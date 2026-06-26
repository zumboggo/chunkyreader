import type { LearnerProgress, RewardDrop, RewardItem, RewardRarity, RewardSlot } from './types'

export const REWARD_SYSTEM_VERSION = 3
export const BOX_CADENCE = 3

const DUPLICATE_SPARKLES: Record<RewardRarity, number> = {
  common: 1,
  uncommon: 3,
  rare: 8,
  epic: 20,
  legendary: 50,
}

export const REWARD_CATALOG: RewardItem[] = [
  // window (4)
  { id: 'moon-sticker', name: 'Moon nightlight', rarity: 'common', slot: 'window', description: 'A glowing moon sits by the window.', badgeText: 'MOON', colorTheme: '#a2b7ff', duplicateSparkles: 1 },
  { id: 'rainbow-sticker', name: 'Rainbow sun-catcher', rarity: 'common', slot: 'window', description: 'Colours dance through the glass.', badgeText: 'RB', colorTheme: '#ff9d6c', duplicateSparkles: 1 },
  { id: 'garden-background', name: 'Garden view', rarity: 'uncommon', slot: 'window', description: 'A sunny garden blooms outside the window.', badgeText: 'GDN', colorTheme: '#99d989', duplicateSparkles: 3 },
  { id: 'aurora-cape', name: 'Northern lights', rarity: 'epic', slot: 'window', description: 'The sky glows with ribbon colours at night.', badgeText: 'AUR', colorTheme: '#58d8c5', duplicateSparkles: 20 },

  // ceiling (7)
  { id: 'explorer-hat', name: 'Explorer mobile', rarity: 'common', slot: 'ceiling', description: 'A brave hat sways gently from the ceiling.', badgeText: 'HAT', colorTheme: '#c79353', duplicateSparkles: 1, lessonsRequired: 5 },
  { id: 'flower-crown', name: 'Flower mobile', rarity: 'common', slot: 'ceiling', description: 'Soft flowers turn slowly in the breeze.', badgeText: 'FL', colorTheme: '#ff9ec5', duplicateSparkles: 1 },
  { id: 'rain-hood', name: 'Rain cloud mobile', rarity: 'common', slot: 'ceiling', description: 'A fluffy cloud mobile floats above.', badgeText: 'RH', colorTheme: '#72c9ff', duplicateSparkles: 1 },
  { id: 'star-crown', name: 'Star mobile', rarity: 'uncommon', slot: 'ceiling', description: 'Little stars spin in the dark.', badgeText: 'SC', colorTheme: '#ffd65c', duplicateSparkles: 3 },
  { id: 'wizard-cap', name: 'Wizard hat hook', rarity: 'rare', slot: 'ceiling', description: 'A sparkly hat hangs from its hook.', badgeText: 'WIZ', colorTheme: '#6f60d9', duplicateSparkles: 8 },
  { id: 'moon-crown', name: 'Moon lantern', rarity: 'epic', slot: 'ceiling', description: 'A crescent moon glows softly overhead.', badgeText: 'MC', colorTheme: '#b5a5ff', duplicateSparkles: 20 },
  { id: 'master-learner-crown', name: 'Reading Crown', rarity: 'legendary', slot: 'ceiling', description: 'The rare crown from the reading well.', badgeText: 'WELL', colorTheme: '#ffcf33', duplicateSparkles: 50, lessonsRequired: 100 },

  // wall (6)
  { id: 'star-badge', name: 'Star poster', rarity: 'common', slot: 'wall', description: 'A bright star beams from the wall.', badgeText: 'STAR', colorTheme: '#ffd65c', duplicateSparkles: 1, lessonsRequired: 15 },
  { id: 'apple-badge', name: 'Apple art', rarity: 'common', slot: 'wall', description: 'A cheerful apple on a tiny frame.', badgeText: 'AP', colorTheme: '#ef5f69', duplicateSparkles: 1 },
  { id: 'trophy-badge', name: 'Trophy plaque', rarity: 'uncommon', slot: 'wall', description: 'A little trophy for steady practice.', badgeText: 'WIN', colorTheme: '#ffc84a', duplicateSparkles: 3 },
  { id: 'golden-book-badge', name: 'Book frame', rarity: 'rare', slot: 'wall', description: 'A golden book badge in a special frame.', badgeText: 'BOOK', colorTheme: '#e8b93f', duplicateSparkles: 8, lessonsRequired: 50 },
  { id: 'reading-well-badge', name: 'Reading plaque', rarity: 'rare', slot: 'wall', description: 'A badge from the reading well path.', badgeText: 'WELL', colorTheme: '#62bcd6', duplicateSparkles: 8 },
  { id: 'dragon-book-charm', name: 'Dragon art', rarity: 'epic', slot: 'wall', description: 'A brave dragon hangs on the wall.', badgeText: 'DB', colorTheme: '#7bcf83', duplicateSparkles: 20 },

  // shelf (5)
  { id: 'book-charm', name: 'Tiny bookshelf', rarity: 'common', slot: 'shelf', description: 'A row of tiny books to treasure.', badgeText: 'BK', colorTheme: '#d0a3ff', duplicateSparkles: 1 },
  { id: 'pencil-wand', name: 'Magic pencil cup', rarity: 'uncommon', slot: 'shelf', description: 'A pencil wand standing tall in its cup.', badgeText: 'PW', colorTheme: '#fb9f45', duplicateSparkles: 3 },
  { id: 'tiny-umbrella', name: 'Umbrella stand', rarity: 'uncommon', slot: 'shelf', description: 'A tiny umbrella for rainy-day stories.', badgeText: 'UM', colorTheme: '#6ed1d6', duplicateSparkles: 3 },
  { id: 'lantern-charm', name: 'Panda lantern', rarity: 'rare', slot: 'shelf', description: 'A warm lantern on the shelf.', badgeText: 'LC', colorTheme: '#ff986f', duplicateSparkles: 8, lessonsRequired: 40 },
  { id: 'golden-pencil', name: 'Golden pencil', rarity: 'rare', slot: 'shelf', description: 'A bright pencil for brave readers.', badgeText: 'GP', colorTheme: '#e5bd43', duplicateSparkles: 8 },

  // cushion (5)
  { id: 'red-scarf', name: 'Red cushion', rarity: 'common', slot: 'cushion', description: 'A cosy red cushion for story time.', badgeText: 'RS', colorTheme: '#f66a8f', duplicateSparkles: 1, lessonsRequired: 1 },
  { id: 'cloud-patch', name: 'Cloud pillow', rarity: 'common', slot: 'cushion', description: 'A fluffy cloud pillow to rest on.', badgeText: 'CL', colorTheme: '#9edfff', duplicateSparkles: 1 },
  { id: 'bow-tie', name: 'Bow pillow', rarity: 'common', slot: 'cushion', description: 'A neat bow pillow for a proud panda.', badgeText: 'BT', colorTheme: '#7bd88f', duplicateSparkles: 1 },
  { id: 'cozy-sweater', name: 'Cosy blanket', rarity: 'uncommon', slot: 'cushion', description: 'A soft blanket for reading nooks.', badgeText: 'SW', colorTheme: '#b58bf2', duplicateSparkles: 3, lessonsRequired: 30 },
  { id: 'rainbow-scarf', name: 'Rainbow cushion', rarity: 'uncommon', slot: 'cushion', description: 'A cushion with happy rainbow stripes.', badgeText: 'RBS', colorTheme: '#fb7fa8', duplicateSparkles: 3 },

  // desk (4)
  { id: 'reading-glasses', name: 'Glasses stand', rarity: 'common', slot: 'desk', description: 'Reading glasses on a little stand.', badgeText: 'GL', colorTheme: '#6288d9', duplicateSparkles: 1, lessonsRequired: 10 },
  { id: 'heart-glasses', name: 'Heart lamp', rarity: 'common', slot: 'desk', description: 'A heart-shaped lamp for warm reading light.', badgeText: 'HG', colorTheme: '#ff7ba7', duplicateSparkles: 1 },
  { id: 'round-glasses', name: 'Round lamp', rarity: 'common', slot: 'desk', description: 'A round desk lamp for careful studying.', badgeText: 'RG', colorTheme: '#7c91aa', duplicateSparkles: 1 },
  { id: 'medal', name: 'Medal display', rarity: 'uncommon', slot: 'desk', description: 'A medal for finishing strong.', badgeText: 'MED', colorTheme: '#e3b34a', duplicateSparkles: 3 },

  // rug (4)
  { id: 'blue-boots', name: 'Blue dotted rug', rarity: 'common', slot: 'rug', description: 'A cheerful blue rug for the floor.', badgeText: 'RUG', colorTheme: '#5bb8f3', duplicateSparkles: 1, lessonsRequired: 20 },
  { id: 'book-vest', name: 'Bookish rug', rarity: 'common', slot: 'rug', description: 'A rug with tiny book patterns all over.', badgeText: 'BV', colorTheme: '#7fbeff', duplicateSparkles: 1 },
  { id: 'star-hoodie', name: 'Star rug', rarity: 'uncommon', slot: 'rug', description: 'A cosy rug with bright learner stars.', badgeText: 'SH', colorTheme: '#8b78ff', duplicateSparkles: 3 },
  { id: 'raincoat', name: 'Yellow mat', rarity: 'uncommon', slot: 'rug', description: 'A sunny floor mat for rainy-day fun.', badgeText: 'RC', colorTheme: '#f4ca45', duplicateSparkles: 3 },

  // door (5)
  { id: 'yellow-backpack', name: 'Yellow backpack', rarity: 'common', slot: 'door', description: 'A sunny backpack hanging by the door.', badgeText: 'BP', colorTheme: '#f4b942', duplicateSparkles: 1, lessonsRequired: 3 },
  { id: 'school-bag', name: 'School bag', rarity: 'common', slot: 'door', description: 'A little bag for learning treasures.', badgeText: 'SB', colorTheme: '#f0a955', duplicateSparkles: 1 },
  { id: 'butterfly-wings', name: 'Butterfly wings', rarity: 'rare', slot: 'door', description: 'Beautiful wings hung beside the door.', badgeText: 'BW', colorTheme: '#f68ed7', duplicateSparkles: 8 },
  { id: 'rocket-pack', name: 'Rocket display', rarity: 'rare', slot: 'door', description: 'A tiny rocket pack ready for adventures.', badgeText: 'RP', colorTheme: '#ff785e', duplicateSparkles: 8 },
  { id: 'rainbow-cape', name: 'Rainbow cape', rarity: 'epic', slot: 'door', description: 'A joyful cape hanging on the hook.', badgeText: 'RC', colorTheme: '#9a77ff', duplicateSparkles: 20, lessonsRequired: 75 },
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
    // Clear equipped items — slots changed from body parts to room spots
    normalized.equippedRewards = {}
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
    window: [],
    ceiling: [],
    wall: [],
    shelf: [],
    cushion: [],
    desk: [],
    rug: [],
    door: [],
  }
  for (const reward of rewards) {
    grouped[reward.slot].push(reward)
  }
  return grouped
}
