import type { Story } from './types'

const appBase = import.meta.env.BASE_URL

export async function loadAnneStories(): Promise<Story[]> {
  const response = await fetch(withBase('stories/anne-stories.json'))
  if (!response.ok) throw new Error(`Could not load stories/anne-stories.json (${response.status})`)
  const stories = (await response.json()) as Story[]
  return stories
}

export function resolveStoryAssetUrl(path?: string): string | undefined {
  if (!path) return undefined
  if (/^(https?:|data:|blob:)/u.test(path)) return path
  return withBase(path.startsWith('/') ? path.slice(1) : path)
}

function withBase(path: string): string {
  return `${appBase}${path}`.replace(/([^:]\/)\/+/gu, '$1')
}
