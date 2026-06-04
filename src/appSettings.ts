import { recordLocalProgressChange } from './cloudProgressSync'

export interface AppSettings {
  autoplayAudio: boolean
  darkMode: boolean
  showProgress: boolean
}

const SETTINGS_KEY = 'chunkyLearnerSettings.v1'

export const defaultAppSettings: AppSettings = {
  autoplayAudio: true,
  darkMode: false,
  showProgress: true,
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultAppSettings
    return { ...defaultAppSettings, ...JSON.parse(raw) }
  } catch {
    return defaultAppSettings
  }
}

export function saveAppSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    recordLocalProgressChange()
    window.dispatchEvent(new CustomEvent('chunkyLearnerSettingsChanged', { detail: settings }))
  } catch {
    // Settings are helpful, but the app must still run if storage is unavailable.
  }
}

export function applyAppSettings(settings: AppSettings) {
  document.body.classList.toggle('dark-mode', settings.darkMode)
  document.body.classList.toggle('hide-progress', !settings.showProgress)
}
