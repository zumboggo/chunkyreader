import type { SectionId } from './types'

export interface AppSettings {
  autoplayAudio: boolean
  darkMode: boolean
  showProgress: boolean
  controllerKeys: ControllerKeyMap
  lockedSection: SectionId | null
}

const SETTINGS_KEY = 'chunkyLearnerSettings.v1'

export type ControllerChoice = 'A' | 'B' | 'C' | 'D' | 'E'
export type ControllerKeyMap = Record<ControllerChoice, string>

export const controllerChoices: ControllerChoice[] = ['A', 'B', 'C', 'D', 'E']

export const defaultControllerKeys: ControllerKeyMap = {
  A: '3',
  B: '4',
  C: '1',
  D: '2',
  E: '5',
}

export const defaultAppSettings: AppSettings = {
  autoplayAudio: true,
  darkMode: false,
  showProgress: true,
  controllerKeys: defaultControllerKeys,
  lockedSection: null,
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultAppSettings
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...defaultAppSettings,
      ...parsed,
      controllerKeys: {
        ...defaultControllerKeys,
        ...(parsed.controllerKeys ?? {}),
      },
    }
  } catch {
    return defaultAppSettings
  }
}

export function saveAppSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    window.dispatchEvent(new CustomEvent('chunkyReaderProgressChanged', { detail: { changedAt: Date.now() } }))
    window.dispatchEvent(new CustomEvent('chunkyLearnerSettingsChanged', { detail: settings }))
  } catch {
    // Settings are helpful, but the app must still run if storage is unavailable.
  }
}

export function applyAppSettings(settings: AppSettings) {
  document.body.classList.toggle('dark-mode', settings.darkMode)
  document.body.classList.toggle('hide-progress', !settings.showProgress)
}
