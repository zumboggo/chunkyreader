import { useEffect, useRef, useState } from 'react'

// Text-to-audio mapping:
// - every kid-facing narration clip has a stable manifest id, for example
//   `story:anne-red-hat:page:1` or `older-reader:prompt:picture-to-word`.
// - generated MP3 files live under public/clip-packs/chunky-reader-audio/audio/narration/.
// - installAudioClipPack() stores those MP3 responses in Cache Storage so normal PWA
//   service-worker updates do not remove them.
// - autoplay is attempted on screen changes; when the browser blocks it, the caller can
//   show a friendly replay button. A successful user tap unlocks later autoplay attempts.

export interface AudioClipEntry {
  id: string
  text: string
  language: string
  audioPath: string
  voice?: string
  type?: string
  version?: string
}

export interface AudioClipPackManifest {
  id: string
  title: string
  version?: string
  createdAt?: string
  clips: AudioClipEntry[]
}

export interface AudioPackInstallProgress {
  done: number
  total: number
  current?: string
}

type NarrationStatus = 'idle' | 'playing' | 'blocked' | 'missing'

const manifestPath = 'clip-packs/chunky-reader-audio/clips_manifest.json'
const installedAudioCache = 'chunky-audio-pack-v2'
const installedManifestKey = 'chunky-reader:audio-pack:manifest:v2'
const autoplayUnlockedKey = 'chunky-reader:audio-pack:autoplay-unlocked'

let manifestPromise: Promise<AudioClipPackManifest | undefined> | undefined
let activeAudio: HTMLAudioElement | null = null
let autoplayUnlocked = readAutoplayUnlocked()

export function audioPackManifestUrl() {
  return withBase(manifestPath)
}

export async function loadAudioClipPackManifest(): Promise<AudioClipPackManifest | undefined> {
  if (!manifestPromise) {
    manifestPromise = fetch(audioPackManifestUrl())
      .then((response) => (response.ok ? response.json() : undefined))
      .catch(() => undefined)
  }
  return manifestPromise
}

export async function findAudioClip(id: string): Promise<AudioClipEntry | undefined> {
  const manifest = await loadAudioClipPackManifest()
  return manifest?.clips.find((clip) => clip.id === id)
}

export async function playNarrationClip(
  id: string,
  fallbackText?: string,
  directAudioPath?: string,
): Promise<NarrationStatus> {
  if (directAudioPath) {
    try {
      await playAudioUrl(await resolveInstalledOrNetworkUrl(directAudioPath))
      autoplayUnlocked = true
      try {
        localStorage.setItem(autoplayUnlockedKey, 'true')
      } catch {
        // Autoplay unlock memory is a convenience only.
      }
      return 'playing'
    } catch {
      // Fall through to the manifest lookup and, if needed, browser speech.
    }
  }

  const clip = await findAudioClip(id)
  if (!clip?.audioPath) {
    if (fallbackText) speakFallback(fallbackText)
    return 'missing'
  }

  try {
    await playAudioUrl(await resolveInstalledOrNetworkUrl(clip.audioPath))
    autoplayUnlocked = true
    try {
      localStorage.setItem(autoplayUnlockedKey, 'true')
    } catch {
      // Autoplay unlock memory is a convenience only.
    }
    return 'playing'
  } catch {
    return 'blocked'
  }
}

export function useNarration(
  clipId: string | undefined,
  fallbackText: string | undefined,
  key: string,
  directAudioPath?: string,
) {
  const lastKey = useRef('')
  const [status, setStatus] = useState<NarrationStatus>('idle')

  useEffect(() => {
    if (!clipId || lastKey.current === key) return
    lastKey.current = key
    setStatus('idle')
    const timer = window.setTimeout(() => {
      void playNarrationClip(clipId, fallbackText, directAudioPath).then(setStatus)
    }, autoplayUnlocked ? 220 : 360)
    return () => window.clearTimeout(timer)
  }, [clipId, directAudioPath, fallbackText, key])

  async function replay() {
    if (!clipId) return
    setStatus('idle')
    const nextStatus = await playNarrationClip(clipId, fallbackText, directAudioPath)
    setStatus(nextStatus)
  }

  return {
    status,
    replay,
    shouldShowPlayButton: Boolean(clipId) && (status === 'blocked' || status === 'missing'),
  }
}

export async function installAudioClipPack(onProgress?: (progress: AudioPackInstallProgress) => void) {
  if (!('caches' in window)) throw new Error('This browser does not support offline audio storage.')
  const manifest = await loadAudioClipPackManifest()
  if (!manifest) throw new Error('Audio clip pack manifest could not be loaded.')

  const cache = await caches.open(installedAudioCache)
  const files = [manifestPath, ...manifest.clips.map((clip) => clip.audioPath)]
  let done = 0

  for (const file of files) {
    const url = withBase(file)
    onProgress?.({ done, total: files.length, current: file })
    const response = await fetch(url)
    if (response.ok) await cache.put(url, response)
    done += 1
    onProgress?.({ done, total: files.length, current: file })
  }

  try {
    localStorage.setItem(
      installedManifestKey,
      JSON.stringify({
        id: manifest.id,
        title: manifest.title,
        version: manifest.version || manifest.createdAt || '',
        clipCount: manifest.clips.length,
        installedAt: new Date().toISOString(),
      }),
    )
  } catch {
    // Cached audio still works even if localStorage is unavailable.
  }

  return manifest
}

export function getInstalledAudioPackSummary(): { version?: string; clipCount?: number } | undefined {
  try {
    const value = localStorage.getItem(installedManifestKey)
    return value ? JSON.parse(value) : undefined
  } catch {
    return undefined
  }
}

export function stopAudioPlayback() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.currentTime = 0
    activeAudio = null
  }
}

export function playAudioUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stopAudioPlayback()
    const audio = new Audio(url)
    activeAudio = audio
    audio.addEventListener('ended', () => {
      if (activeAudio === audio) activeAudio = null
      resolve()
    }, { once: true })
    audio.addEventListener('error', () => {
      if (activeAudio === audio) activeAudio = null
      reject(new Error('Audio failed'))
    }, { once: true })
    audio.play().catch(reject)
  })
}

async function resolveInstalledOrNetworkUrl(path: string): Promise<string> {
  const url = withBase(path)
  if (!('caches' in window)) return url
  const cache = await caches.open(installedAudioCache)
  const cached = await cache.match(url)
  if (!cached) return url
  const blob = await cached.blob()
  return URL.createObjectURL(blob)
}

function speakFallback(text: string) {
  if (!('speechSynthesis' in window)) return
  stopAudioPlayback()
  const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/gu, ' ').trim())
  utterance.lang = 'en-US'
  utterance.rate = 0.82
  window.speechSynthesis.speak(utterance)
}

function withBase(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`.replace(/([^:]\/)\/+/gu, '$1')
}

function readAutoplayUnlocked() {
  try {
    return localStorage.getItem(autoplayUnlockedKey) === 'true'
  } catch {
    return false
  }
}
