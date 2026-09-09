interface MediaManifest {
  enabled: boolean
  baseUrl: string
  files: Record<string, { object: string; bytes: number; sha256: string }>
}
let manifest: MediaManifest | undefined
const legacyMediaPaths = new Map<string, string>()

export async function initializeMediaAssets() {
  const response = await fetch(`${import.meta.env.BASE_URL}media-manifest.json`)
  if (!response.ok) throw new Error('The media catalog could not be loaded. Please reconnect and retry.')
  manifest = await response.json() as MediaManifest
  for (const [path, file] of Object.entries(manifest.files)) {
    legacyMediaPaths.set(`${manifest.baseUrl}/${file.object}`, `${import.meta.env.BASE_URL}${path}`)
  }
}

export function legacyAssetUrl(path: string) {
  return legacyMediaPaths.get(path) ?? (/^https?:/u.test(path) ? path : `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`)
}

export function assetUrl(path: string): string {
  if (/^(https?:|data:|blob:)/u.test(path)) return path
  const clean = path.replace(/^\/+/, '')
  const file = manifest?.enabled ? manifest.files[clean] : undefined
  return file ? `${manifest!.baseUrl}/${file.object}` : `${import.meta.env.BASE_URL}${clean}`
}

export function joinAssetPath(base: string | undefined, path: string) {
  if (/^(https?:|data:|blob:)/u.test(path)) return path
  if (/^https?:/u.test(base ?? '')) return new URL(path, `${base!.replace(/\/+$/, '')}/`).href
  return assetUrl(path.startsWith('/') ? path : [base, path].filter(Boolean).join('/'))
}
