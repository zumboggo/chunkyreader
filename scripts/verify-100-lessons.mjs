import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const lessonsDir = path.join(root, 'public', '100-lessons')
const indexPath = path.join(lessonsDir, 'index.json')
const errors = []

const index = JSON.parse(await fs.readFile(indexPath, 'utf8'))

for (const entry of index) {
  const lessonPath = path.join(lessonsDir, `${entry.id}.json`)
  const lesson = JSON.parse(await fs.readFile(lessonPath, 'utf8'))
  if (!lesson.id || !Number.isFinite(lesson.lessonNumber)) {
    errors.push(`${entry.id}: missing id or lessonNumber`)
  }
  if (!Array.isArray(lesson.chunks) || lesson.chunks.length === 0) {
    errors.push(`${entry.id}: missing chunks`)
    continue
  }

  for (const [chunkIndex, chunk] of lesson.chunks.entries()) {
    const label = `${entry.id} chunk ${chunkIndex} (${chunk.type})`
    if (!Array.isArray(chunk.items) || chunk.items.length === 0) {
      errors.push(`${label}: missing items`)
      continue
    }

    if (chunk.type === 'rhyme-puzzle') {
      const rime = deriveSharedRime(chunk.items)
      if (!rime) errors.push(`${label}: could not derive a rhyme ending`)
      for (const word of chunk.items) {
        const { onset, rime: displayedRime } = splitRimeWord(word, rime)
        const rendered = `${onset}${displayedRime || rime}`
        if (rendered !== word) {
          errors.push(`${label}: would render "${word}" as "${rendered}"`)
        }
        if (!word.toLowerCase().endsWith(rime.toLowerCase())) {
          errors.push(`${label}: "${word}" does not end with shared rime "${rime}"`)
        }
      }
    }

    if (chunk.audioPaths) {
      for (const audioPath of chunk.audioPaths) {
        await requirePublicFile(entry.id, audioPath, label)
      }
    }
    if (chunk.wordAudioPaths) {
      for (const row of chunk.wordAudioPaths) {
        for (const audioPath of row) {
          await requirePublicFile(entry.id, audioPath, label)
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Verified ${index.length} 100 Lessons files.`)

async function requirePublicFile(lessonId, relativePath, label) {
  const filePath = path.join(lessonsDir, relativePath)
  try {
    await fs.access(filePath)
  } catch {
    errors.push(`${label}: missing asset ${lessonId}/${relativePath}`)
  }
}

function deriveSharedRime(words) {
  const cleanWords = words.map((word) => word.toLowerCase().replace(/[^a-z]/gu, '')).filter(Boolean)
  if (cleanWords.length === 0) return ''
  const shortest = cleanWords.reduce((current, word) => (word.length < current.length ? word : current), cleanWords[0])

  for (let length = Math.max(1, shortest.length - 1); length >= 1; length -= 1) {
    const suffix = shortest.slice(-length)
    if (cleanWords.every((word) => word.endsWith(suffix))) return suffix
  }

  return shortest.length <= 2 ? shortest.slice(-1) : shortest.slice(1)
}

function splitRimeWord(word, rime) {
  if (!rime || !word.toLowerCase().endsWith(rime.toLowerCase())) {
    return { onset: word, rime: '' }
  }
  const onset = word.slice(0, word.length - rime.length)
  return { onset, rime: word.slice(word.length - rime.length) }
}
