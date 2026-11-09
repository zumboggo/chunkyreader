import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const base = process.env.GITHUB_PAGES === 'true' ? '/chunkyreader/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), {
    name: 'offline-library-manifest',
    async closeBundle() {
      const files = new Map<string, { url: string; revision: string; bytes: number }>()
      const media = JSON.parse(await readFile('dist/media-manifest.json', 'utf8'))
      async function walk(dir: string) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const filename = path.join(dir, entry.name)
          if (entry.isDirectory()) { await walk(filename); continue }
          const relative = path.relative('dist', filename).split(path.sep).join('/')
          if (!/\.(html|js|css|json|csv|webmanifest|png|jpe?g|webp|svg|gif|mp3|mp4|m4a|ogg|wav|woff2?|ico)$/i.test(relative) || ['sw.js', 'offline-manifest.json'].includes(relative)) continue
          if (media.enabled && media.files[relative]) continue
          const data = await readFile(filename)
          const url = relative === 'index.html' ? './' : relative
          files.set(url, { url, revision: createHash('sha256').update(data).digest('hex'), bytes: data.length })
        }
      }
      await walk('dist')
      if (media.enabled) for (const file of Object.values(media.files) as { object: string; sha256: string; bytes: number }[]) {
        const url = `${media.baseUrl}/${file.object}`
        files.set(url, { url, revision: file.sha256, bytes: file.bytes })
      }
      await writeFile('dist/offline-manifest.json', JSON.stringify({ files: [...files.values()] }))
    },
  }],
})
