const CACHE_VERSION = 'chunky-learner-v9'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const CORE_ASSETS = [
  './',
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

const toScopeUrl = (path) => new URL(path, self.registration.scope).toString()

const CONTENT_PATH_PARTS = ['/decks/', '/clip-packs/', '/stories/']
const FRESH_EXTENSIONS = ['.json', '.csv']

function shouldRefreshFirst(url) {
  return (
    CONTENT_PATH_PARTS.some((part) => url.pathname.includes(part)) ||
    FRESH_EXTENSIONS.some((extension) => url.pathname.endsWith(extension))
  )
}

function putSuccessfulResponse(request, response) {
  if (!response || response.status !== 200) {
    return response
  }

  const responseClone = response.clone()
  caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone))
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(CORE_ASSETS.map(toScopeUrl)).catch((error) => {
        console.info('Chunky Reader pre-cache skipped an optional file.', error)
      }),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('chunky-reader-') && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(request.url)
  const scopeUrl = new URL(self.registration.scope)

  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(toScopeUrl('./'), responseClone))
          return response
        })
        .catch(() => caches.match(toScopeUrl('./'))),
    )
    return
  }

  if (shouldRefreshFirst(requestUrl)) {
    event.respondWith(fetch(request).then((response) => putSuccessfulResponse(request, response)).catch(() => caches.match(request)))
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((response) => putSuccessfulResponse(request, response))
    }),
  )
})
