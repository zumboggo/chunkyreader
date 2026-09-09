import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import './index.css'
import App from './App'
import { registerServiceWorker } from './registerServiceWorker'
import { getCloudAuthState } from './cloudProgressSync'
import { ACCOUNT_CHANGED_EVENT, progressStorage } from './progressStorage'
import { initializeMediaAssets } from './mediaAssets'
import { stopAudioPlayback } from './audioClipPack'

const root = createRoot(document.getElementById('root')!)
async function start() {
  // Resolve account ownership before any component reads or writes progress.
  // An offline persisted Supabase session is enough; no network auth call is needed.
  await Promise.all([getCloudAuthState(), initializeMediaAssets()])
  const render = () => root.render(<StrictMode><App key={progressStorage.epoch} /></StrictMode>)
  window.addEventListener(ACCOUNT_CHANGED_EVENT, () => {
    stopAudioPlayback()
    flushSync(render)
  })
  render()
  registerServiceWorker()
}
void start().catch(() => {
  root.render(<main><h1>Let’s reconnect</h1><p>Your saved progress is safe. Reconnect and reload to open your lessons.</p><button onClick={() => window.location.reload()}>Retry</button></main>)
})
