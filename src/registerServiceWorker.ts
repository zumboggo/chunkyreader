const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(serviceWorkerUrl).catch((error: unknown) => {
      console.info('Chunky Reader offline mode is unavailable right now.', error)
    })
  })
}
