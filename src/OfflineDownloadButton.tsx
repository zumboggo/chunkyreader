import { useState } from 'react'

const CACHE = 'chunky-offline-library-v1'
type FileEntry = { url: string; revision: string; bytes: number }

export function OfflineDownloadButton() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Includes all built-in episodes, pictures, audio and videos; may use several hundred MB. Keep this app open while saving.')
  async function download() {
    if (busy) return
    setBusy(true)
    try {
      if (!('caches' in window) || !('serviceWorker' in navigator)) throw new Error('Offline downloads need an installed PWA or a supported secure browser.')
      const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      if (!registration?.active) throw new Error('The app is getting ready. Reopen it online, then try again.')
      const response = await fetch(`${import.meta.env.BASE_URL}offline-manifest.json`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load the download list. Reconnect and retry.')
      const { files } = await response.json() as { files: FileEntry[] }
      const cache = await caches.open(CACHE)
      await navigator.storage?.persist?.().catch(() => false)
      let done = 0
      const totalMB = Math.ceil(files.reduce((sum, file) => sum + file.bytes, 0) / 1024 / 1024)
      // Sequential writes keep memory small and make interrupted downloads resumable.
      for (const file of files) {
        setMessage(`Saving ${done} of ${files.length} files (about ${totalMB} MB). Keep this app open.`)
        const url = new URL(file.url, new URL(import.meta.env.BASE_URL, location.href)).href
        const existing = await cache.match(url)
        if (existing?.headers.get('x-offline-revision') !== file.revision) {
          const saved = await fetch(url, { cache: 'reload', credentials: 'omit' })
          if (!saved.ok || saved.status !== 200 || saved.type === 'opaque') throw new Error('A file could not be saved. Reconnect and retry; saved files will be reused.')
          const body = await saved.arrayBuffer()
          const digest = await crypto.subtle.digest('SHA-256', body)
          const revision = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
          if (revision !== file.revision) throw new Error('Content has changed during download. Reopen the app online and retry.')
          const headers = new Headers(saved.headers)
          headers.set('x-offline-revision', file.revision)
          await cache.put(url, new Response(body, { headers }))
        }
        done++
      }
      setMessage('Everything is saved for offline play on this device. Download again after new episodes are added.')
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'This device ran out of storage. Free some space and retry; saved files will be reused.'
        : error instanceof Error ? error.message : 'Download interrupted. Please retry.')
    } finally { setBusy(false) }
  }
  return <div className="offline-download">
    <button type="button" className="audio-pack-button" onClick={() => void download()} disabled={busy}>{busy ? 'Downloading…' : 'Download everything for offline play'}</button>
    <p role="status" aria-live="polite">{message}</p>
  </div>
}
