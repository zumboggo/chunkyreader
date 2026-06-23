import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const storyPath = path.join(root, 'public', 'stories', 'anne-stories.json')
const errors = []

if (!fs.existsSync(storyPath)) {
  errors.push('Missing public/stories/anne-stories.json')
} else {
  const stories = JSON.parse(fs.readFileSync(storyPath, 'utf8'))
  if (!Array.isArray(stories) || stories.length === 0) {
    errors.push('Story file must contain a non-empty array.')
  } else {
    for (const story of stories) {
      if (!story.id || !story.title) errors.push(`Story is missing id or title: ${JSON.stringify(story)}`)
      if (!story.coverImage) errors.push(`${story.id || story.title}: missing coverImage`)
      if (typeof story.coverImage === 'string' && story.coverImage.startsWith('/')) {
        errors.push(`${story.id || story.title}: coverImage path should be relative to public/, not root-absolute`)
      }
      if (!Array.isArray(story.pages) || story.pages.length === 0) {
        errors.push(`${story.id || story.title}: expected at least 1 page`)
        continue
      }
      if (story.readingLevel !== 'older reader' && story.pages.length !== 3) {
        errors.push(`${story.id || story.title}: expected exactly 3 pages for early reader stories`)
        continue
      }
      for (const page of story.pages) {
        const label = `${story.id} page ${page.pageNumber}`
        const requiredFields = story.sourceType === 'pdf-import'
          ? ['pageNumber', 'text', 'image', 'altText']
          : ['pageNumber', 'text', 'image', 'imagePrompt', 'negativePrompt', 'altText']
        for (const field of requiredFields) {
          if (!page[field]) errors.push(`${label}: missing ${field}`)
        }
        if (typeof page.image === 'string' && page.image.startsWith('/')) {
          errors.push(`${label}: image path should be relative to public/, not root-absolute`)
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Verified Anne stories.')
