import clips from './content/guided-sounds.json'
import { assetUrl } from './mediaAssets'

import { READING_LEXICON, type SoundUnit } from './guidedWords'
export function guidedSoundUnits(text: string): SoundUnit[] {
  const word = READING_LEXICON[text.toLowerCase()]
  if (!word) throw new Error(`No explicit pronunciation mapping for ${text}`)
  return word.sounds
}
const soundClips: Record<string, { path: string; start: number; duration: number }> = clips

let context: AudioContext | undefined
const decoded = new Map<string, Promise<AudioBuffer>>()
let generation = 0
let nodes: AudioBufferSourceNode[] = []
let timers: ReturnType<typeof setTimeout>[] = []
let cancelPending: (() => void) | undefined
function audioContext() { return context ??= new AudioContext() }
async function buffer(sound: string) {
  if (!decoded.has(sound)) {
    const promise = cachedSound(assetUrl(soundClips[sound].path))
      .then(response => { if (!response.ok) throw new Error('Sound unavailable'); return response.arrayBuffer() })
      .then(bytes => audioContext().decodeAudioData(bytes))
      .catch(error => { decoded.delete(sound); throw error })
    decoded.set(sound, promise)
  }
  return decoded.get(sound)!
}
async function cachedSound(url: string) {
  // The existing installed-audio cache survives PWA updates. At most 30 tiny shared clips.
  let cache: Cache | undefined
  try {
    if ('caches' in globalThis) {
      cache = await caches.open('chunky-audio-pack-v2')
      const cached = await cache.match(url)
      if (cached) return cached
    }
  } catch { /* Restricted browsers can still stream the sound. */ }
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (response.ok && cache) { try { await cache.put(url, response.clone()) } catch { /* Quota: playback still works. */ } }
  return response
}

/** Call on the Start tap: unlock mobile audio and warm this small pocket for the bus. */
export function prepareGuidedSounds(words: { text: string }[]) {
  try {
    void audioContext().resume().catch(() => {})
    const sounds = new Set(words.flatMap(word => guidedSoundUnits(word.text).map(unit => unit.sound)))
    void Promise.all([...sounds].map(buffer)).then(async () => {
      // Prepare later lessons too, without recording any learner information in the audio cache.
      for (const sound of Object.keys(clips) as (string)[]) await buffer(sound)
    }).catch(() => {})
  } catch { /* Replay will show a helpful message if audio is unavailable. */ }
}
export function stopGuidedSounds() {
  generation++
  for (const node of nodes) { node.onended = null; try { node.stop() } catch { /* Already ended. */ } }
  nodes = []
  timers.forEach(clearTimeout); timers = []
  cancelPending?.(); cancelPending = undefined
}

export async function playGuidedSounds(text: string, onSound: (index: number | null) => void, onlyUnit?: number): Promise<'played' | 'cancelled' | 'unavailable'> {
  stopGuidedSounds()
  const request = generation
  try {
    const ctx = audioContext()
    await ctx.resume()
    if (request !== generation) return 'cancelled'
    if (ctx.state !== 'running') return 'unavailable'
    const allUnits = guidedSoundUnits(text)
    const units = onlyUnit === undefined ? allUnits : [allUnits[onlyUnit]]
    if (!units.length) return 'unavailable'
    const buffers = await Promise.all(units.map(unit => buffer(unit.sound)))
    if (request !== generation) return 'cancelled'
    return await new Promise(resolve => {
      cancelPending = () => resolve('cancelled')
      let offset = .04
      units.forEach((unit, index) => {
        const clip = soundClips[unit.sound]
        const node = ctx.createBufferSource()
        node.buffer = buffers[index]
        node.connect(ctx.destination)
        nodes.push(node)
        timers.push(setTimeout(() => { if (generation === request) onSound(index) }, offset * 1000))
        node.start(ctx.currentTime + offset, clip.start, clip.duration)
        offset += clip.duration + .12
        if (index === units.length - 1) node.onended = () => {
          if (generation !== request) return
          onSound(null); cancelPending = undefined; resolve('played')
        }
      })
    })
  } catch {
    // Never substitute browser TTS for isolated spellings: that can say letter names.
    if (request !== generation) return 'cancelled'
    stopGuidedSounds(); onSound(null)
    return 'unavailable'
  }
}
