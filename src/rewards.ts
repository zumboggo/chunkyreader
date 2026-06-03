import type { RewardItem } from './types'

export const REWARDS: RewardItem[] = [
  { id: 'red-scarf', name: 'Red scarf', lessonsRequired: 1, emoji: '🧣' },
  { id: 'yellow-backpack', name: 'Yellow backpack', lessonsRequired: 3, emoji: '🎒' },
  { id: 'explorer-hat', name: 'Explorer hat', lessonsRequired: 5, emoji: '🤠' },
  { id: 'reading-glasses', name: 'Reading glasses', lessonsRequired: 10, emoji: '👓' },
  { id: 'star-badge', name: 'Star badge', lessonsRequired: 15, emoji: '⭐' },
  { id: 'blue-boots', name: 'Blue boots', lessonsRequired: 20, emoji: '👢' },
  { id: 'cozy-sweater', name: 'Cozy sweater', lessonsRequired: 30, emoji: '🧥' },
  { id: 'lantern-charm', name: 'Lantern charm', lessonsRequired: 40, emoji: '🏮' },
  { id: 'golden-book-badge', name: 'Golden book badge', lessonsRequired: 50, emoji: '📖' },
  { id: 'rainbow-cape', name: 'Rainbow cape', lessonsRequired: 75, emoji: '🌈' },
  { id: 'master-learner-crown', name: 'Master Learner crown', lessonsRequired: 100, emoji: '👑' }
]

export function getNewlyUnlockedRewards(previousCompletedCount: number, newCompletedCount: number): RewardItem[] {
  return REWARDS.filter(r => r.lessonsRequired > previousCompletedCount && r.lessonsRequired <= newCompletedCount)
}

export function getAllUnlockedRewards(completedCount: number): RewardItem[] {
  return REWARDS.filter(r => r.lessonsRequired <= completedCount)
}
