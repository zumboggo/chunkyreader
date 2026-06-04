import type { LearnerProgress, SectionId } from './types'
import { awardBoxesForCompletedLessons, normalizeRewardProgress, REWARD_SYSTEM_VERSION } from './rewards'
import { recordLocalProgressChange } from './cloudProgressSync'

const PROGRESS_KEY = 'chunkyLearnerProgress.v1'

export interface CompletionRewardResult {
  progress: LearnerProgress
  boxesAwarded: number
}

function getEmptyProgress(): LearnerProgress {
  return {
    totalLessonsCompleted: 0,
    completedLessonsBySection: {
      letters: 0,
      sounds: 0,
      words: 0,
      stories: 0,
      math: 0,
      chinese: 0
    },
    completedLessonsByDeck: {},
    unlockedRewards: [],
    storyCompletions: {},
    rewardSystemVersion: REWARD_SYSTEM_VERSION,
    unopenedBoxes: 0,
    rewardedCompletionCount: 0,
    sparklePoints: 0,
    rewardInventory: {},
    equippedRewards: {},
    rewardHistory: [],
    rarePityCount: 0,
    epicPityCount: 0
  }
}

export function loadProgress(): LearnerProgress {
  try {
    const data = localStorage.getItem(PROGRESS_KEY)
    if (!data) return getEmptyProgress()
    const parsed = JSON.parse(data)
    
    // Merge with defaults to ensure all fields exist
    return normalizeRewardProgress({
      ...getEmptyProgress(),
      ...parsed,
      completedLessonsBySection: {
        ...getEmptyProgress().completedLessonsBySection,
        ...(parsed.completedLessonsBySection || {})
      }
    })
  } catch (e) {
    console.error('Failed to load progress', e)
    return getEmptyProgress()
  }
}

export function saveProgress(progress: LearnerProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(normalizeRewardProgress(progress)))
    recordLocalProgressChange()
  } catch (e) {
    console.error('Failed to save progress', e)
  }
}

export function resetProgress() {
  try {
    saveProgress(getEmptyProgress())
    const prefixes = [
      'chunky-reader:story:',
      'chunky-reader:card-progress:',
      'chunky-reader:older-reader-phonemes:',
      'sarah-progress-',
    ]
    const exactKeys = [
      'completed-lessons-anna',
      'completed-lessons-sarah',
      'completed-lessons-100',
      '100-lessons-progress',
      'chunkyLearnerContinue.v1',
    ]
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (!key) continue
      if (exactKeys.includes(key) || prefixes.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key)
      }
    }
    recordLocalProgressChange()
  } catch (e) {
    console.error('Failed to reset progress', e)
  }
}

export function markLessonComplete(sectionId: SectionId, deckId: string): CompletionRewardResult {
  const progress = loadProgress()
  progress.totalLessonsCompleted += 1
  progress.completedLessonsBySection[sectionId] = (progress.completedLessonsBySection[sectionId] || 0) + 1
  progress.completedLessonsByDeck[deckId] = (progress.completedLessonsByDeck[deckId] || 0) + 1
  
  const result = awardBoxesForCompletedLessons(progress)
  saveProgress(result.progress)
  return result
}

export function markStoryComplete(storyId: string): CompletionRewardResult {
  const progress = loadProgress()
  if (!progress.storyCompletions[storyId]) {
    progress.storyCompletions[storyId] = 0
  }
  progress.storyCompletions[storyId] += 1
  
  // For rewards, maybe completing a story counts as a lesson
  progress.totalLessonsCompleted += 1
  progress.completedLessonsBySection.stories = (progress.completedLessonsBySection.stories || 0) + 1
  
  const result = awardBoxesForCompletedLessons(progress)
  saveProgress(result.progress)
  return result
}

export function markHundredLessonComplete(lessonId: string): CompletionRewardResult {
  const progress = loadProgress()
  progress.totalLessonsCompleted += 1
  progress.completedLessonsByDeck[lessonId] = (progress.completedLessonsByDeck[lessonId] || 0) + 1

  const result = awardBoxesForCompletedLessons(progress)
  saveProgress(result.progress)
  return result
}

export function getSectionProgress(sectionId: SectionId): number {
  return loadProgress().completedLessonsBySection[sectionId] || 0
}

export function selectReward(rewardId: string) {
  const progress = loadProgress()
  progress.selectedRewardId = rewardId
  saveProgress(progress)
}
