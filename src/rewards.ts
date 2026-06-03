import type { RewardItem } from './types'

export const REWARDS: RewardItem[] = [
  { id: 'red-scarf', name: 'Red scarf', lessonsRequired: 1, emoji: 'RS' },
  { id: 'yellow-backpack', name: 'Yellow backpack', lessonsRequired: 3, emoji: 'BP' },
  { id: 'explorer-hat', name: 'Explorer hat', lessonsRequired: 5, emoji: 'HAT' },
  { id: 'reading-glasses', name: 'Reading glasses', lessonsRequired: 10, emoji: 'GL' },
  { id: 'star-badge', name: 'Star badge', lessonsRequired: 15, emoji: 'STAR' },
  { id: 'blue-boots', name: 'Blue boots', lessonsRequired: 20, emoji: 'BT' },
  { id: 'cozy-sweater', name: 'Cozy sweater', lessonsRequired: 30, emoji: 'SW' },
  { id: 'lantern-charm', name: 'Lantern charm', lessonsRequired: 40, emoji: 'LC' },
  { id: 'golden-book-badge', name: 'Golden book badge', lessonsRequired: 50, emoji: 'BOOK' },
  { id: 'rainbow-cape', name: 'Rainbow cape', lessonsRequired: 75, emoji: 'RC' },
  { id: 'master-learner-crown', name: 'Master Learner crown', lessonsRequired: 100, emoji: '100' },
]

export function getNewlyUnlockedRewards(previousCompletedCount: number, newCompletedCount: number): RewardItem[] {
  return REWARDS.filter((reward) => reward.lessonsRequired > previousCompletedCount && reward.lessonsRequired <= newCompletedCount)
}

export function getAllUnlockedRewards(completedCount: number): RewardItem[] {
  return REWARDS.filter((reward) => reward.lessonsRequired <= completedCount)
}
