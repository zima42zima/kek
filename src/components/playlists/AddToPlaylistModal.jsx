import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Modal from '../Modal'
import {
  addEmbedToPlaylist,
  createPlaylist,
  listUserPlaylists,
  PlaylistsNotInstalledError,
} from '../../lib/playlists'
import { MusicAddIcon } from '../icons/UiIcons'

export default function AddToPlaylistModal({ embed, onClose, onAdded }) {
  const { user } = useAuth()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [needsSql, setNeedsSql] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    listUserPlaylists(user.id)
      .then((rows) => { if (!cancelled) setPlaylists(rows) })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof PlaylistsNotInstalledError) {
          setNeedsSql(true)
          return
        }
        setError(err.message || 'Could not load playlists.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.id])

  async function handleAdd(playlistId) {
    setBusy(true)
    setError('')
    try {
      await addEmbedToPlaylist(playlistId, embed)
      onAdded?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not add track.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const id = await createPlaylist(newName)
      await addEmbedToPlaylist(id, embed)
      onAdded?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not create playlist.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add to playlist" onClose={onClose} maxWidth="max-w-sm">
      {needsSql ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Run <code className="text-[11px]">supabase-patch-playlists.sql</code> in Supabase SQL Editor first.
        </p>
      ) : loading ? (
        <p className="text-sm frens-muted text-center py-4">Loading…</p>
      ) : (
        <div className="space-y-3">
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New playlist name"
              className="frens-input flex-1 text-sm"
              maxLength={40}
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
            >
              Create
            </button>
          </form>

          {playlists.length > 0 ? (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {playlists.map((pl) => (
                <li key={pl.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAdd(pl.id)}
                    className="w-full text-left border frens-border rounded-xl px-3 py-2.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition disabled:opacity-50"
                  >
                    <span className="font-medium text-sm">{pl.name}</span>
                    <span className="text-xs frens-muted ml-2">
                      {pl.trackCount === 1 ? '1 track' : `${pl.trackCount} tracks`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs frens-muted text-center py-2">
              No playlists yet — create one above.
            </p>
          )}

          {error ? <p className="text-xs text-red-500 dark:text-red-400">{error}</p> : null}
        </div>
      )}
    </Modal>
  )
}

export function AddToPlaylistButton({ embed, className = '' }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user || !embed || (embed.type !== 'youtube' && embed.type !== 'vimeo')) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={`absolute bottom-2 left-2 z-10 w-8 h-8 rounded-full bg-black/70 text-white text-sm hover:bg-black/90 transition flex items-center justify-center ${className}`}
        aria-label="Add to playlist"
        title="Add to playlist"
      >
        <MusicAddIcon className="w-4 h-4" />
      </button>
      {open ? (
        <AddToPlaylistModal embed={embed} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}
