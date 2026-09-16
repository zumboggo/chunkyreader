const CACHE_VERSION = 'chunky-learner-v18'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const AUDIO_CACHE = 'chunky-audio-pack-v2'
const MAX_ENTRIES = 384
const MAX_BYTES = 96 * 1024 * 1024
const MEDIA_BASE = 'https://nvrofeaaewwdeefxtmqu.supabase.co/storage/v1/object/public/chunky-reader-media/'
const CORE_ASSETS = [
  './',
  'media-manifest.json',
  'manifest.webmanifest',
  'assets/mascots/mascot-reading.png',
  'assets/mascots/mascot-expressions.png',
  'assets/100-lessons/reading-well-journey.png',
  'assets/100-lessons/panda-walk-1.png',
  'assets/100-lessons/panda-walk-2.png',
  'assets/100-lessons/panda-walk-3.png',
  'assets/profiles/anna-red-shirt.png',
  'assets/profiles/sarah-reading.png',
  'assets/sections/letters.webp',
  'assets/sections/sounds.webp',
  'assets/sections/words.webp',
  'assets/sections/stories.webp',
  'assets/sections/math.webp',
  'assets/sections/chinese.webp',

  // Core App Data
  'decks/index.json',
  'decks/sarah-letters-level-1.json',
  'decks/sarah-phonemes-level-2.json',
  'decks/annas-reading-deck/deck.json',
  'decks/math-addition-0-12.json',
  'decks/math-subtraction-0-12.json',
  'decks/chinese-level-1.json',
  'stories/anne-stories.json',
  'clip-packs/index.json',
  'clip-packs/chunky-reader-audio/clips_manifest.json',
  'clip-packs/annas-reading-deck/clips_manifest.json',
  'clip-packs/annas-reading-deck/vocab.csv',
  'clip-packs/annas-reading-deck/sentences.csv',
]
const toScopeUrl = path => new URL(path, self.registration.scope).toString()
let cacheWrites = Promise.resolve()

function isSharedMedia(url) {
  return url.href.startsWith(MEDIA_BASE) && !url.search && /^v1\/[a-f0-9]{64}\.[a-z0-9]+$/.test(url.href.slice(MEDIA_BASE.length))
}
async function putBounded(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return
  const blob = await response.blob()
  if (blob.size > MAX_BYTES) return
  const headers = new Headers(response.headers)
  headers.set('x-reader-bytes', String(blob.size))
  const cached = new Response(blob, { status:200, headers })
  cacheWrites = cacheWrites.catch(() => {}).then(async () => {
    const cache = await caches.open(RUNTIME_CACHE)
    await cache.delete(request)
    await cache.put(request, cached)
    const requests = await cache.keys()
    let bytes = 0
    const sizes = []
    for (const key of requests) {
      const value = await cache.match(key)
      const size = Number(value?.headers.get('x-reader-bytes') || 0)
      sizes.push(size); bytes += size
    }
    let remaining = requests.length
    for (let i = 0; i < requests.length && (remaining > MAX_ENTRIES || bytes > MAX_BYTES); i++) {
      await cache.delete(requests[i]); bytes -= sizes[i]; remaining--
    }
  })
  await cacheWrites
}
async function mediaResponse(request, response) {
  const range = request.headers.get('range')
  if (!range || response.status !== 200) return response
  const match = /^bytes=(\d+)-(\d*)$/.exec(range)
  if (!match) return response
  const blob = await response.blob()
  const start = Number(match[1])
  const end = Math.min(match[2] ? Number(match[2]) : blob.size - 1, blob.size - 1)
  if (start >= blob.size || end < start) return new Response(null, { status:416, headers:{'Content-Range':`bytes */${blob.size}`} })
  return new Response(blob.slice(start,end+1), { status:206, headers:{
    'Content-Type':response.headers.get('content-type') || 'application/octet-stream',
    'Content-Range':`bytes ${start}-${end}/${blob.size}`, 'Content-Length':String(end-start+1), 'Accept-Ranges':'bytes',
  } })
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE)
    let manifest
    try {
      const response = await fetch(toScopeUrl('media-manifest.json'))
      if (response.ok) { manifest = await response.clone().json(); await cache.put(toScopeUrl('media-manifest.json'), response) }
    } catch { /* Existing local asset paths remain the fallback. */ }
    // The app bundle loaded before first-time SW registration. Cache its exact
    // hashed JS/CSS now so the next visit works offline without an extra online reload.
    try {
      const shell = await fetch(toScopeUrl('./'))
      if (shell.ok) {
        const html = await shell.clone().text()
        await cache.put(toScopeUrl('./'), shell)
        const bundles = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => new URL(match[1], self.registration.scope))
        for (const bundle of bundles) {
          if (bundle.origin !== new URL(self.registration.scope).origin) continue
          const response = await fetch(bundle.href)
          if (response.ok) await cache.put(bundle.href, response)
        }
      }
    } catch { /* Preserve the rest of the offline install. */ }
    await Promise.all(CORE_ASSETS.map(async path => {
      const file = manifest?.enabled && manifest.files[path]
      const url = file ? `${manifest.baseUrl}/${file.object}` : toScopeUrl(path)
      try { const response = await fetch(url, { mode:'cors' }); if (response.ok) await cache.put(url,response) }
      catch { /* One optional file must not prevent all other files being saved. */ }
    }))
    await self.skipWaiting()
  })())
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if ((key.startsWith('chunky-reader-') || key.startsWith('chunky-learner-')) && ![STATIC_CACHE,RUNTIME_CACHE].includes(key)) await caches.delete(key)
    }
    // Explicitly installed audio has its own cache and survives app updates.
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const scope = new URL(self.registration.scope)
  const shared = isSharedMedia(url)
  const local = url.origin === scope.origin && url.pathname.startsWith(scope.pathname)
  // Never intercept Auth, database APIs, private objects, or signed URLs.
  if (!local && !shared) return
  event.respondWith((async () => {
    const key = request.mode === 'navigate' ? toScopeUrl('./') : request.url
    const cached = await caches.match(key)
    const freshFirst = request.mode === 'navigate' || /\.(json|csv)$/.test(url.pathname)
    if (cached && !freshFirst) return mediaResponse(request, cached)
    try {
      const response = await fetch(shared ? request.url : request, shared ? {mode:'cors',credentials:'omit'} : undefined)
      if (!response.ok && cached) return mediaResponse(request, cached)
      event.waitUntil(putBounded(key, response.clone()).catch(() => {}))
      return mediaResponse(request, response)
    } catch {
      if (cached) return mediaResponse(request, cached)
      const audio = await (await caches.open(AUDIO_CACHE)).match(key)
      return audio ? mediaResponse(request, audio) : new Response('Not available offline yet', {status:503})
    }
  })())
})
