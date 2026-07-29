import { useEffect, useState } from 'react'
import { isPlaylistSaved, savePlaylist, unsavePlaylist } from '../../lib/playlists'

export default function SavePlaylistButton({ playlistId, onChange, className = '' }) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!playlistId) return
    let cancelled = false
    isPlaylistSaved(playlistId)
      .then((v) => { if (!cancelled) { setSaved(v); setChecked(true) } })
      .catch(() => { if (!cancelled) setChecked(true) })
    return () => { cancelled = true }
  }, [playlistId])

  if (!playlistId || !checked) return null

  async function toggle(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      if (saved) {
        await unsavePlaylist(playlistId)
        setSaved(false)
      } else {
        await savePlaylist(playlistId)
        setSaved(true)
      }
      onChange?.()
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`text-xs rounded-full px-3 py-1.5 border frens-border transition shrink-0 disabled:opacity-50 ${
        saved ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
      } ${className}`}
    >
      {saved ? '★ Saved' : '☆ Save playlist'}
    </button>
  )
}
