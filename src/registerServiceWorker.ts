const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  const register = () => {
    navigator.serviceWorker.register(serviceWorkerUrl).catch((error: unknown) => {
      console.info('Chunky Reader offline mode is unavailable right now.', error)
    })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
