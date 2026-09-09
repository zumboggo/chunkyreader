import { useEffect, useState } from 'react'
import { supabase, hasGuestProgress, importGuestProgress } from './cloudProgressSync'
import { progressStorage, type LearnerScope } from './progressStorage'

interface PrivateAsset {
  id: string
  name: string
  learner_id: LearnerScope
  object_path: string
  bytes: number
}
const BUCKET = 'chunky-reader-private'
const TYPES = ['image/png','image/jpeg','image/webp','audio/mpeg','audio/wav','audio/ogg','text/plain','application/pdf']

export function PrivateLibrary() {
  const [files, setFiles] = useState<PrivateAsset[]>([])
  const [learner, setLearner] = useState<LearnerScope>('anna')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [guestAvailable, setGuestAvailable] = useState(hasGuestProgress)
  const account = progressStorage.account

  useEffect(() => {
    let cancelled = false
    if (!supabase || account === 'guest') return
    void supabase.from('chunky_reader_private_assets').select('id,name,learner_id,object_path,bytes')
      .eq('user_id', account).order('created_at', { ascending: false }).then(({ data, error }) => {
        if (cancelled) return
        if (error) setMessage('Your private library could not be loaded.')
        else setFiles(data ?? [])
      })
    return () => { cancelled = true }
  }, [account])

  if (!supabase || account === 'guest') return null
  const client = supabase
  const assertAccount = () => {
    if (progressStorage.account !== account) throw new Error('Account changed. Please try again.')
  }

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true); setMessage('')
    let inserted: PrivateAsset | undefined
    try {
      if (!TYPES.includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('Choose a supported file no larger than 10 MB.')
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,'0')).join('')
      assertAccount()
      const { data: existing, error: lookupError } = await client.from('chunky_reader_private_assets').select('id')
        .eq('user_id', account).eq('learner_id', learner).eq('sha256', hash).maybeSingle()
      if (lookupError) throw lookupError
      assertAccount()
      if (existing) { setMessage('This file is already in this learner’s library.'); return }
      const id = crypto.randomUUID()
      const row = { id, user_id: account, learner_id: learner, name: file.name.slice(0,200),
        object_path: `${account}/${learner}/${id}`, sha256: hash, bytes: file.size, content_type: file.type }
      const { error: insertError } = await client.from('chunky_reader_private_assets').insert(row)
      if (insertError) throw insertError
      inserted = row
      assertAccount()
      const { error } = await client.storage.from(BUCKET).upload(row.object_path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      assertAccount()
      setFiles(current => [row, ...current]); setMessage('Saved privately to your account.')
    } catch (error) {
      if (inserted && progressStorage.account === account) {
        // Keep metadata if the upload may have succeeded: no orphaned private object.
        const { data } = await client.storage.from(BUCKET).list(`${account}/${learner}`, { search: inserted.id })
        if (data && !data.some(item => item.name === inserted!.id)) await client.from('chunky_reader_private_assets').delete().eq('id', inserted.id).eq('user_id', account)
      }
      setMessage(error instanceof Error ? error.message : 'Could not upload this file.')
    } finally { setBusy(false) }
  }

  async function openFile(file: PrivateAsset) {
    try {
      assertAccount()
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(file.object_path, 60, { download: file.name })
      if (error) throw error
      assertAccount()
      // Private URLs are never saved in browser caches or progress snapshots.
      const link = document.createElement('a')
      link.href = data.signedUrl
      link.rel = 'noopener noreferrer'
      link.click()
    } catch { setMessage('Could not download this private file.') }
  }

  async function importGuest() {
    setBusy(true)
    try {
      await importGuestProgress()
      assertAccount()
      setGuestAvailable(false)
      setMessage('Guest progress imported. Reload to refresh the lesson dashboard.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed. Your guest progress is preserved.') }
    finally { setBusy(false) }
  }

  async function removeFile(file: PrivateAsset) {
    if (!window.confirm(`Remove "${file.name}" from your private library? This cannot be undone.`)) return
    setBusy(true)
    try {
      assertAccount()
      const { error } = await client.storage.from(BUCKET).remove([file.object_path])
      if (error) throw error
      assertAccount()
      const { error: metadataError } = await client.from('chunky_reader_private_assets').delete().eq('id', file.id).eq('user_id', account)
      if (metadataError) throw metadataError
      assertAccount()
      setFiles(current => current.filter(item => item.id !== file.id))
      setMessage('File removed.')
    } catch { setMessage('Could not remove this file. Please try again.') }
    finally { setBusy(false) }
  }

  return <section className="private-library">
    <h3>Your private library</h3>
    <p>Save personal pictures, audio, text, or PDFs to your account. These files stay private; uploading does not turn them into a lesson.</p>
    <label>Learner <select value={learner} onChange={event => setLearner(event.target.value as LearnerScope)}>
      <option value="anna">Growing Reader</option><option value="sarah">Earliest Reader</option>
      <option value="100-lessons">100 Lessons</option><option value="shared">Shared within my account</option>
    </select></label>
    <label>Add a file (up to 10 MB)<input type="file" accept={TYPES.join(',')} disabled={busy}
      onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></label>
    <ul>{files.filter(file => file.learner_id === learner).map(file => <li key={file.id}>
      <button type="button" onClick={() => void openFile(file)}>{file.name}</button>
      <small> {Math.ceil(file.bytes / 1024)} KB</small>
      <button type="button" disabled={busy} onClick={() => void removeFile(file)}>Remove</button>
    </li>)}</ul>
    {guestAvailable && <div><p>Guest progress saved on this device is separate from your account.</p>
      <button type="button" disabled={busy} onClick={() => void importGuest()}>Import this device’s guest progress into my account</button></div>}
    <p role="status">{message}</p>
  </section>
}
