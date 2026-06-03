import type { LearnerProgress, SectionId } from './types'

const PROGRESS_KEY = 'chunkyLearnerProgress.v1'

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
    storyCompletions: {}
  }
}

export function loadProgress(): LearnerProgress {
  try {
    const data = localStorage.getItem(PROGRESS_KEY)
    if (!data) return getEmptyProgress()
    const parsed = JSON.parse(data)
    
    // Merge with defaults to ensure all fields exist
    return {
      ...getEmptyProgress(),
      ...parsed,
      completedLessonsBySection: {
        ...getEmptyProgress().completedLessonsBySection,
        ...(parsed.completedLessonsBySection || {})
      }
    }
  } catch (e) {
    console.error('Failed to load progress', e)
    return getEmptyProgress()
  }
}

export function saveProgress(progress: LearnerProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
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
      'chunky-reader:older-phonemes:',
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
  } catch (e) {
    console.error('Failed to reset progress', e)
  }
}

export function markLessonComplete(sectionId: SectionId, deckId: string): LearnerProgress {
  const progress = loadProgress()
  progress.totalLessonsCompleted += 1
  progress.completedLessonsBySection[sectionId] = (progress.completedLessonsBySection[sectionId] || 0) + 1
  progress.completedLessonsByDeck[deckId] = (progress.completedLessonsByDeck[deckId] || 0) + 1
  
  // Note: we let the UI component call getNewlyUnlockedRewards to figure out what was just unlocked
  // and then the UI can append it to unlockedRewards if needed, or we just compute unlocked on the fly based on totalLessonsCompleted.
  
  saveProgress(progress)
  return progress
}

export function markStoryComplete(storyId: string): LearnerProgress {
  const progress = loadProgress()
  if (!progress.storyCompletions[storyId]) {
    progress.storyCompletions[storyId] = 0
  }
  progress.storyCompletions[storyId] += 1
  
  // For rewards, maybe completing a story counts as a lesson
  progress.totalLessonsCompleted += 1
  progress.completedLessonsBySection.stories = (progress.completedLessonsBySection.stories || 0) + 1
  
  saveProgress(progress)
  return progress
}

export function getSectionProgress(sectionId: SectionId): number {
  return loadProgress().completedLessonsBySection[sectionId] || 0
}

export function selectReward(rewardId: string) {
  const progress = loadProgress()
  progress.selectedRewardId = rewardId
  saveProgress(progress)
}
