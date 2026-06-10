import { createClient, type Session, type User } from '@supabase/supabase-js'
import type { AppSettings } from './appSettings'
import { normalizeRewardProgress } from './rewards'
import type { LearnerProgress, SectionId } from './types'

const FALLBACK_SUPABASE_URL = 'https://nvrofeaaewwdeefxtmqu.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_YaSTM-n-eBSDWPkY4IigOg_vFHmdYSB'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || FALLBACK_SUPABASE_ANON_KEY

const SNAPSHOT_ID = 'chunky-reader-progress-v1'
const SNAPSHOT_VERSION = 1
const METADATA_KEY = 'chunky-reader:cloud-sync:metadata:v1'
export const PROGRESS_CHANGED_EVENT = 'chunkyReaderProgressChanged'

const EXACT_SYNC_KEYS = [
  'chunkyLearnerProgress.v1',
  'chunkyLearnerSettings.v1',
  'chunkyLearnerContinue.v1',
  'completed-lessons-anna',
  'completed-lessons-sarah',
  'completed-lessons-100',
  '100-lessons-progress',
]

const PREFIX_SYNC_KEYS = [
  'sarah-progress-',
  'chunky-reader:story:',
  'chunky-reader:card-progress:',
  'chunky-reader:older-reader-phonemes:',
  'chunky-reader:flashcard-states:',
]

const DEFAULT_APP_SETTINGS: AppSettings = {
  autoplayAudio: true,
  darkMode: false,
  showProgress: true,
}

export type CloudSyncStatus =
  | 'unconfigured'
  | 'signed-out'
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'

export interface CloudAuthState {
  configured: boolean
  session: Session | null
  user: User | null
}

export interface CloudSyncResult {
  pushedSnapshot: boolean
  pulledSnapshot: boolean
  mergedSnapshot: boolean
  syncedAt: string
}

interface CloudProgressSnapshot {
  version: number
  id: string
  capturedAt: string
  localUpdatedAt: string
  keys: Record<string, string>
}

interface CloudProgressRow {
  user_id: string
  progress_id: string
  progress_data: CloudProgressSnapshot
  updated_at: string
}

interface SyncMetadata {
  userId?: string
  lastLocalUpdatedAt?: string
  lastSyncedAt?: string
  lastRemoteUpdatedAt?: string
}

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null

export function recordLocalProgressChange() {
  const now = new Date().toISOString()
  saveSyncMetadata({ ...loadSyncMetadata(), lastLocalUpdatedAt: now })
  window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT, { detail: { changedAt: now } }))
}

export async function getCloudAuthState(): Promise<CloudAuthState> {
  if (!supabase) return { configured: false, session: null, user: null }
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return {
    configured: true,
    session: data.session,
    user: data.session?.user ?? null,
  }
}

export function onCloudAuthChange(callback: (state: CloudAuthState) => void): () => void {
  if (!supabase) {
    callback({ configured: false, session: null, user: null })
    return () => undefined
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback({
      configured: true,
      session,
      user: session?.user ?? null,
    })
  })
  return () => data.subscription.unsubscribe()
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUrl() },
  })
  if (error) throw error
}

export async function signInWithMagicLink(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const trimmedEmail = email.trim()
  if (!trimmedEmail) throw new Error('Enter an email address first.')
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmedEmail,
    options: { emailRedirectTo: authRedirectUrl() },
  })
  if (error) throw error
}

export async function signOutOfCloud(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

let activeSync: Promise<CloudSyncResult> | null = null

export async function syncNow(): Promise<CloudSyncResult> {
  if (activeSync) return activeSync
  activeSync = runSyncNow().finally(() => {
    activeSync = null
  })
  return activeSync
}

async function runSyncNow(): Promise<CloudSyncResult> {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  if (!navigator.onLine) throw new Error('Offline. Changes will sync when this device reconnects.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const user = userData.user
  if (!user) throw new Error('Sign in before syncing.')

  const metadata = loadSyncMetadata()
  const localSnapshot = captureProgressSnapshot(metadata)
  const remoteRow = await fetchRemoteSnapshot()
  const syncedAt = new Date().toISOString()

  if (!remoteRow) {
    await upsertSnapshot(user.id, localSnapshot)
    saveSyncMetadata({
      userId: user.id,
      lastLocalUpdatedAt: localSnapshot.localUpdatedAt,
      lastSyncedAt: syncedAt,
      lastRemoteUpdatedAt: localSnapshot.capturedAt,
    })
    return { pushedSnapshot: true, pulledSnapshot: false, mergedSnapshot: false, syncedAt }
  }

  const remoteSnapshot = normalizeSnapshot(remoteRow.progress_data, remoteRow.updated_at)
  const firstSyncForUser = metadata.userId !== user.id
  const localChangedSinceSync = timeValue(metadata.lastLocalUpdatedAt) > timeValue(metadata.lastSyncedAt)
  const remoteChangedSinceSync = timeValue(remoteRow.updated_at) > timeValue(metadata.lastRemoteUpdatedAt)

  if (firstSyncForUser || (localChangedSinceSync && remoteChangedSinceSync)) {
    const mergedSnapshot = mergeSnapshots(localSnapshot, remoteSnapshot)
    applyProgressSnapshot(mergedSnapshot)
    await upsertSnapshot(user.id, mergedSnapshot)
    saveSyncMetadata({
      userId: user.id,
      lastLocalUpdatedAt: mergedSnapshot.localUpdatedAt,
      lastSyncedAt: syncedAt,
      lastRemoteUpdatedAt: mergedSnapshot.capturedAt,
    })
    return { pushedSnapshot: true, pulledSnapshot: true, mergedSnapshot: true, syncedAt }
  }

  if (remoteChangedSinceSync && timeValue(remoteRow.updated_at) >= timeValue(localSnapshot.localUpdatedAt)) {
    applyProgressSnapshot(remoteSnapshot)
    saveSyncMetadata({
      userId: user.id,
      lastLocalUpdatedAt: remoteSnapshot.localUpdatedAt,
      lastSyncedAt: syncedAt,
      lastRemoteUpdatedAt: remoteRow.updated_at,
    })
    return { pushedSnapshot: false, pulledSnapshot: true, mergedSnapshot: false, syncedAt }
  }

  if (localChangedSinceSync || timeValue(localSnapshot.localUpdatedAt) > timeValue(remoteRow.updated_at)) {
    await upsertSnapshot(user.id, localSnapshot)
    saveSyncMetadata({
      userId: user.id,
      lastLocalUpdatedAt: localSnapshot.localUpdatedAt,
      lastSyncedAt: syncedAt,
      lastRemoteUpdatedAt: localSnapshot.capturedAt,
    })
    return { pushedSnapshot: true, pulledSnapshot: false, mergedSnapshot: false, syncedAt }
  }

  saveSyncMetadata({
    ...metadata,
    userId: user.id,
    lastSyncedAt: syncedAt,
    lastRemoteUpdatedAt: remoteRow.updated_at,
  })
  return { pushedSnapshot: false, pulledSnapshot: false, mergedSnapshot: false, syncedAt }
}

async function fetchRemoteSnapshot(): Promise<CloudProgressRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('chunky_reader_progress')
    .select('user_id, progress_id, progress_data, updated_at')
    .eq('progress_id', SNAPSHOT_ID)
    .maybeSingle()
  if (error) throw error
  return (data as CloudProgressRow | null) ?? null
}

async function upsertSnapshot(userId: string, snapshot: CloudProgressSnapshot): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('chunky_reader_progress').upsert(
    {
      user_id: userId,
      progress_id: SNAPSHOT_ID,
      progress_data: snapshot,
      updated_at: snapshot.capturedAt,
    },
    { onConflict: 'user_id,progress_id' },
  )
  if (error) throw error
}

function captureProgressSnapshot(metadata: SyncMetadata): CloudProgressSnapshot {
  const capturedAt = new Date().toISOString()
  const keys: Record<string, string> = {}
  for (const key of trackedLocalStorageKeys()) {
    const value = window.localStorage.getItem(key)
    if (value !== null) keys[key] = value
  }

  return normalizeSnapshot({
    version: SNAPSHOT_VERSION,
    id: SNAPSHOT_ID,
    capturedAt,
    localUpdatedAt: metadata.lastLocalUpdatedAt ?? capturedAt,
    keys,
  }, capturedAt)
}

function applyProgressSnapshot(snapshot: CloudProgressSnapshot) {
  const trackedKeys = trackedLocalStorageKeys()
  for (const key of trackedKeys) {
    if (!(key in snapshot.keys)) window.localStorage.removeItem(key)
  }
  for (const [key, value] of Object.entries(snapshot.keys)) {
    window.localStorage.setItem(key, value)
  }
}

function mergeSnapshots(local: CloudProgressSnapshot, remote: CloudProgressSnapshot): CloudProgressSnapshot {
  const keySet = new Set([...Object.keys(local.keys), ...Object.keys(remote.keys)])
  const keys: Record<string, string> = {}
  for (const key of keySet) {
    const localValue = local.keys[key]
    const remoteValue = remote.keys[key]
    const mergedValue = mergeStorageValue(key, localValue, remoteValue, local, remote)
    if (mergedValue !== undefined) keys[key] = mergedValue
  }

  const capturedAt = new Date().toISOString()
  return normalizeSnapshot({
    version: SNAPSHOT_VERSION,
    id: SNAPSHOT_ID,
    capturedAt,
    localUpdatedAt: capturedAt,
    keys,
  }, capturedAt)
}

function mergeStorageValue(
  key: string,
  localValue: string | undefined,
  remoteValue: string | undefined,
  local: CloudProgressSnapshot,
  remote: CloudProgressSnapshot,
): string | undefined {
  if (localValue === undefined) return remoteValue
  if (remoteValue === undefined) return localValue
  if (localValue === remoteValue) return localValue

  if (key === 'chunkyLearnerProgress.v1') return stringify(mergeLearnerProgress(parseJson(localValue), parseJson(remoteValue)))
  if (key === 'chunkyLearnerSettings.v1' || key === 'chunkyLearnerContinue.v1') {
    return timeValue(local.localUpdatedAt) >= timeValue(remote.localUpdatedAt) ? localValue : remoteValue
  }
  if (key === 'completed-lessons-anna' || key === 'completed-lessons-sarah' || key === 'completed-lessons-100') {
    return String(Math.max(parseInteger(localValue), parseInteger(remoteValue)))
  }
  if (key === '100-lessons-progress' || key.startsWith('sarah-progress-') || key.startsWith('chunky-reader:story:')) {
    return String(Math.max(parseInteger(localValue), parseInteger(remoteValue)))
  }
  if (key.startsWith('chunky-reader:card-progress:')) return stringify(mergeMaxNumberObject(parseJson(localValue), parseJson(remoteValue)))
  if (key.startsWith('chunky-reader:older-reader-phonemes:')) {
    return stringify(mergeOlderReaderPhonemeProgress(parseJson(localValue), parseJson(remoteValue)))
  }
  if (key.startsWith('chunky-reader:flashcard-states:')) {
    return stringify(mergeFlashcardStates(parseJson(localValue), parseJson(remoteValue)))
  }
  return timeValue(local.localUpdatedAt) >= timeValue(remote.localUpdatedAt) ? localValue : remoteValue
}

function mergeLearnerProgress(localRaw: unknown, remoteRaw: unknown): LearnerProgress {
  const local = normalizeRewardProgress(localRaw as LearnerProgress)
  const remote = normalizeRewardProgress(remoteRaw as LearnerProgress)
  return normalizeRewardProgress({
    ...local,
    ...remote,
    totalLessonsCompleted: Math.max(local.totalLessonsCompleted || 0, remote.totalLessonsCompleted || 0),
    completedLessonsBySection: mergeSectionCounts(local.completedLessonsBySection, remote.completedLessonsBySection),
    completedLessonsByDeck: mergeNumberRecords(local.completedLessonsByDeck, remote.completedLessonsByDeck),
    unlockedRewards: unionStrings(local.unlockedRewards, remote.unlockedRewards),
    selectedRewardId: remote.selectedRewardId ?? local.selectedRewardId,
    storyCompletions: mergeNumberRecords(local.storyCompletions, remote.storyCompletions),
    rewardSystemVersion: Math.max(local.rewardSystemVersion || 0, remote.rewardSystemVersion || 0),
    unopenedBoxes: Math.max(local.unopenedBoxes || 0, remote.unopenedBoxes || 0),
    rewardedCompletionCount: Math.max(local.rewardedCompletionCount || 0, remote.rewardedCompletionCount || 0),
    sparklePoints: Math.max(local.sparklePoints || 0, remote.sparklePoints || 0),
    rewardInventory: mergeNumberRecords(local.rewardInventory, remote.rewardInventory),
    equippedRewards: { ...(local.equippedRewards || {}), ...(remote.equippedRewards || {}) },
    rewardHistory: mergeRewardHistory(local.rewardHistory, remote.rewardHistory),
    rarePityCount: Math.max(local.rarePityCount || 0, remote.rarePityCount || 0),
    epicPityCount: Math.max(local.epicPityCount || 0, remote.epicPityCount || 0),
  })
}

function mergeSectionCounts(
  local: Record<SectionId, number>,
  remote: Record<SectionId, number>,
): Record<SectionId, number> {
  return {
    letters: Math.max(local?.letters || 0, remote?.letters || 0),
    sounds: Math.max(local?.sounds || 0, remote?.sounds || 0),
    words: Math.max(local?.words || 0, remote?.words || 0),
    stories: Math.max(local?.stories || 0, remote?.stories || 0),
    math: Math.max(local?.math || 0, remote?.math || 0),
    chinese: Math.max(local?.chinese || 0, remote?.chinese || 0),
  }
}

function mergeNumberRecords<T extends string>(
  local: Partial<Record<T, number>> | undefined,
  remote: Partial<Record<T, number>> | undefined,
): Record<T, number> {
  const merged = {} as Record<T, number>
  for (const key of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]) as Set<T>) {
    merged[key] = Math.max(Number(local?.[key] || 0), Number(remote?.[key] || 0))
  }
  return merged
}

function mergeRewardHistory(
  local: LearnerProgress['rewardHistory'],
  remote: LearnerProgress['rewardHistory'],
): NonNullable<LearnerProgress['rewardHistory']> {
  const byId = new Map<string, NonNullable<LearnerProgress['rewardHistory']>[number]>()
  for (const drop of [...(local || []), ...(remote || [])]) {
    if (drop?.id) byId.set(drop.id, drop)
  }
  return [...byId.values()]
    .sort((a, b) => timeValue(b.openedAt) - timeValue(a.openedAt))
    .slice(0, 50)
}

function mergeMaxNumberObject(localRaw: unknown, remoteRaw: unknown): Record<string, number> {
  const local = isRecord(localRaw) ? localRaw : {}
  const remote = isRecord(remoteRaw) ? remoteRaw : {}
  const merged: Record<string, number> = {}
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    merged[key] = Math.max(Number(local[key] || 0), Number(remote[key] || 0))
  }
  return merged
}

function mergeOlderReaderPhonemeProgress(localRaw: unknown, remoteRaw: unknown) {
  const local = isRecord(localRaw) ? localRaw : {}
  const remote = isRecord(remoteRaw) ? remoteRaw : {}
  return {
    learnedIds: unionStrings(asStringArray(local.learnedIds), asStringArray(remote.learnedIds)),
    nextIndex: Math.max(Number(local.nextIndex || 0), Number(remote.nextIndex || 0)),
    cycle: Math.max(Number(local.cycle || 1), Number(remote.cycle || 1)),
  }
}

interface FlashcardStateSync {
  cardId: string
  deckId: string
  state: string
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  last_review?: number
}

function mergeFlashcardStates(localRaw: unknown, remoteRaw: unknown): FlashcardStateSync[] {
  const localArray = Array.isArray(localRaw) ? localRaw : []
  const remoteArray = Array.isArray(remoteRaw) ? remoteRaw : []
  const merged = new Map<string, FlashcardStateSync>()

  for (const card of localArray) {
    if (card && typeof card === 'object' && 'cardId' in card) {
      merged.set(card.cardId as string, card as FlashcardStateSync)
    }
  }

  for (const card of remoteArray) {
    if (card && typeof card === 'object' && 'cardId' in card) {
      const existing = merged.get(card.cardId as string)
      if (!existing) {
        merged.set(card.cardId as string, card as FlashcardStateSync)
      } else {
        const localReview = existing.last_review ?? 0
        const remoteReview = (card as FlashcardStateSync).last_review ?? 0
        if (remoteReview > localReview) {
          merged.set(card.cardId as string, card as FlashcardStateSync)
        }
      }
    }
  }

  return [...merged.values()]
}

function trackedLocalStorageKeys(): string[] {
  const keys = new Set(EXACT_SYNC_KEYS)
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key && PREFIX_SYNC_KEYS.some((prefix) => key.startsWith(prefix))) keys.add(key)
  }
  return [...keys]
}

function normalizeSnapshot(snapshot: Partial<CloudProgressSnapshot>, fallbackUpdatedAt: string): CloudProgressSnapshot {
  const settings = normalizeSettingsValue(snapshot.keys?.['chunkyLearnerSettings.v1'])
  const keys = { ...(snapshot.keys || {}) }
  if (settings) keys['chunkyLearnerSettings.v1'] = settings
  return {
    version: SNAPSHOT_VERSION,
    id: SNAPSHOT_ID,
    capturedAt: snapshot.capturedAt || fallbackUpdatedAt,
    localUpdatedAt: snapshot.localUpdatedAt || snapshot.capturedAt || fallbackUpdatedAt,
    keys,
  }
}

function normalizeSettingsValue(value: string | undefined): string | undefined {
  if (!value) return value
  const parsed = parseJson(value) as Partial<AppSettings>
  return stringify({ ...DEFAULT_APP_SETTINGS, ...parsed })
}

function loadSyncMetadata(): SyncMetadata {
  try {
    const raw = window.localStorage.getItem(METADATA_KEY)
    return raw ? JSON.parse(raw) as SyncMetadata : {}
  } catch {
    return {}
  }
}

function saveSyncMetadata(metadata: SyncMetadata) {
  try {
    window.localStorage.setItem(METADATA_KEY, JSON.stringify(metadata))
  } catch {
    // Cloud sync metadata is helpful, but local learning should never depend on it.
  }
}

function authRedirectUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value)
}

function parseInteger(value: string | undefined): number {
  const parsed = Number.parseInt(value || '0', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function unionStrings(first: string[] | undefined, second: string[] | undefined): string[] {
  return [...new Set([...(first || []), ...(second || [])].filter((value): value is string => typeof value === 'string'))]
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function timeValue(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}
