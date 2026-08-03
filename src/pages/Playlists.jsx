import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePlaylistPlayback } from '../context/PlaylistPlaybackContext'
import { fetchProfileForUser } from '../lib/profile'
import PlaylistIcon from '../components/playlists/PlaylistIcon'
import ProfileShareToggle from '../components/ProfileShareToggle'
import SavePlaylistButton from '../components/playlists/SavePlaylistButton'
import { VideoTimelineCard } from '../components/YouTubeEmbed'
import PlaylistTrackAuraButton from '../components/playlists/PlaylistTrackAuraButton'
import PlaylistComments from '../components/playlists/PlaylistComments'
import PlaylistTrackEditList from '../components/playlists/PlaylistTrackEditList'
import PlaylistCoverEditor, { PlaylistCoverBanner, PlaylistCoverThumb } from '../components/playlists/PlaylistCover'
import {
  addPlaylistTrack,
  createPlaylist,
  deletePlaylist,
  listPlaylistTracks,
  listSavedPlaylists,
  listUserPlaylists,
  removePlaylistTrack,
  reorderPlaylistTracks,
  setPlaylistCover,
  trackToEmbed,
  validatePlaylistVideoUrl,
  PlaylistsNotInstalledError,
} from '../lib/playlists'

function PlaylistRow({ playlist, subtitle, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(playlist)}
      className="w-full text-left border frens-border rounded-xl p-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
    >
      <div className="flex items-center gap-3">
        <PlaylistCoverThumb coverUrl={playlist.coverUrl} name={playlist.name} />
        <div className="min-w-0 flex-1">
          <h3 className="frens-title-sm truncate">{playlist.name}</h3>
          <p className="text-xs frens-muted mt-0.5">
            {subtitle || (playlist.trackCount === 1 ? '1 track' : `${playlist.trackCount} tracks`)}
          </p>
        </div>
        <span className="text-xs frens-muted">→</span>
      </div>
    </button>
  )
}

function TrackRow({
  track,
  index,
  activeIndex,
  isPlaying,
  queueActive,
  editable,
  busy,
  canAura,
  onPlayTrack,
  onRemove,
  onAuraChange,
}) {
  const embed = trackToEmbed(track)
  const isActive = index === activeIndex
  const useGlobal = queueActive && isActive && isPlaying

  return (
    <div className="relative group">
      <VideoTimelineCard
        embed={embed}
        caption={track.title}
        showAddToPlaylist={false}
        externalPlayback={useGlobal}
        forcePlaying={isActive ? isPlaying : false}
        onPlayRequest={() => onPlayTrack(index)}
      />
      <div className="flex items-center gap-2 -mt-1 mb-1 px-0.5">
        {canAura ? (
          <PlaylistTrackAuraButton
            trackId={track.id}
            auraCount={track.auraCount}
            iGaveAura={track.iGaveAura}
            onAuraChange={onAuraChange}
          />
        ) : track.auraCount > 0 ? (
          <span className="text-[11px] frens-muted">Aura {track.auraCount}</span>
        ) : null}
        {editable ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemove(track.id)}
            className="text-[11px] frens-action ml-auto disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function Playlists({
  userId,
  editable: editableProp,
  onBack,
  onOpenFrenPlaylist,
  initialPlaylistId = null,
  onConsumedInitialPlaylist,
}) {
  const { user, profile } = useAuth()
  const playback = usePlaylistPlayback()
  const [ownerName, setOwnerName] = useState(profile?.frenName || 'Fren')
  const [playlists, setPlaylists] = useState([])
  const [savedPlaylists, setSavedPlaylists] = useState([])
  const [tracks, setTracks] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsSql, setNeedsSql] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [urlDraft, setUrlDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [layoutEditing, setLayoutEditing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [listEditing, setListEditing] = useState(false)

  const editable = editableProp ?? Boolean(user?.id && userId && user.id === userId)
  const canAura = Boolean(user?.id && !editable)
  const isThisQueue = Boolean(selected && playback?.isActivePlaylist(selected.id))
  const queueActive = Boolean(playback?.meta?.playlistId && playback.tracks?.length > 0)
  const activeIndex = isThisQueue ? playback.activeIndex : -1
  const isPlaying = isThisQueue && playback.isPlaying

  function queueMeta() {
    return {
      playlistId: selected?.id,
      playlistName: selected?.name,
      ownerId: userId,
      ownerName,
    }
  }

  function loadPlaylists() {
    if (!userId) return
    setLoading(true)
    setError('')
    listUserPlaylists(userId)
      .then(setPlaylists)
      .catch((err) => {
        if (err instanceof PlaylistsNotInstalledError) {
          setNeedsSql(true)
          setPlaylists([])
          return
        }
        setError(err.message || 'Could not load playlists.')
      })
      .finally(() => setLoading(false))
  }

  function loadSaved() {
    listSavedPlaylists()
      .then(setSavedPlaylists)
      .catch(() => setSavedPlaylists([]))
  }

  function loadTracks(playlistId) {
    setLoading(true)
    setError('')
    listPlaylistTracks(playlistId)
      .then(setTracks)
      .catch((err) => {
        if (err instanceof PlaylistsNotInstalledError) {
          setNeedsSql(true)
          setTracks([])
          return
        }
        setError(err.message || 'Could not load tracks.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPlaylists()
    if (editable) loadSaved()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, editable])

  useEffect(() => {
    if (!userId || userId === user?.id) {
      setOwnerName(profile?.frenName || 'You')
      return
    }
    let cancelled = false
    fetchProfileForUser(userId).then((p) => {
      if (!cancelled && p?.frenName) setOwnerName(p.frenName)
    })
    return () => { cancelled = true }
  }, [userId, user?.id, profile?.frenName])

  useEffect(() => {
    setSelected(null)
    setTracks([])
    setEditing(false)
    setLayoutEditing(false)
    setListEditing(false)
    loadPlaylists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!initialPlaylistId) return
    if (playlists.length === 0) return
    const pl = playlists.find((p) => p.id === initialPlaylistId)
    if (pl) {
      setSelected(pl)
      loadTracks(pl.id)
      onConsumedInitialPlaylist?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlaylistId, playlists])

  function openPlaylist(pl) {
    setSelected(pl)
    setLayoutEditing(false)
    setEditing(false)
    loadTracks(pl.id)
  }

  function openSaved(saved) {
    onOpenFrenPlaylist?.(saved.ownerId, saved.id)
    loadSaved()
  }

  function backToList() {
    setSelected(null)
    setTracks([])
    setLayoutEditing(false)
    setEditing(false)
    loadPlaylists()
    loadSaved()
  }

  function exitEditMode() {
    setEditing(false)
    setLayoutEditing(false)
  }

  function handleAuraChange(trackId, result) {
    setTracks((prev) => prev.map((t) => (
      t.id === trackId
        ? { ...t, auraCount: result.auraCount, iGaveAura: result.iGaveAura }
        : t
    )))
  }

  function playTrack(index) {
    if (!selected || !playback) return
    playback.setQueue(tracks, queueMeta(), index)
    playback.play(index)
  }

  function togglePlayPause() {
    if (!selected || !playback || tracks.length === 0) return
    if (isThisQueue) {
      playback.toggle()
      return
    }
    playback.setQueue(tracks, queueMeta(), 0)
    playback.play(0)
  }

  async function handleCreatePlaylist(e) {
    e.preventDefault()
    if (!newPlaylistName.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await createPlaylist(newPlaylistName)
      setNewPlaylistName('')
      loadPlaylists()
    } catch (err) {
      setError(err.message || 'Could not create playlist.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddTrack(e) {
    e.preventDefault()
    if (!selected || !urlDraft.trim() || busy) return
    const check = validatePlaylistVideoUrl(urlDraft)
    if (!check.ok) {
      setError(check.error)
      return
    }
    setBusy(true)
    setError('')
    try {
      await addPlaylistTrack(selected.id, urlDraft, titleDraft)
      setUrlDraft('')
      setTitleDraft('')
      loadTracks(selected.id)
      loadPlaylists()
      if (isThisQueue) {
        const updated = await listPlaylistTracks(selected.id)
        playback.setQueue(updated, queueMeta(), playback.activeIndex)
      }
    } catch (err) {
      setError(err.message || 'Could not add track.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveTrack(id) {
    setBusy(true)
    setError('')
    try {
      await removePlaylistTrack(id)
      const nextTracks = tracks.filter((t) => t.id !== id)
      setTracks(nextTracks)
      if (isThisQueue) {
        const oldActiveId = tracks[activeIndex]?.id
        const nextIndex = nextTracks.findIndex((t) => t.id === oldActiveId)
        playback.setQueue(
          nextTracks,
          queueMeta(),
          nextIndex >= 0 ? nextIndex : Math.max(0, nextTracks.length - 1),
        )
        if (nextTracks.length === 0) playback.pause()
      }
      loadPlaylists()
    } catch (err) {
      setError(err.message || 'Could not remove track.')
      if (selected) loadTracks(selected.id)
    } finally {
      setBusy(false)
    }
  }

  async function persistTrackOrder(nextTracks) {
    if (!selected) return
    const oldActiveId = tracks[activeIndex]?.id
    setTracks(nextTracks)
    setBusy(true)
    setError('')
    try {
      await reorderPlaylistTracks(selected.id, nextTracks.map((t) => t.id))
      if (isThisQueue) {
        const nextIndex = nextTracks.findIndex((t) => t.id === oldActiveId)
        playback.setQueue(nextTracks, queueMeta(), nextIndex >= 0 ? nextIndex : 0)
      }
    } catch (err) {
      const msg = err?.code === 'PGRST202'
        ? 'Run supabase-patch-playlist-reorder.sql in Supabase SQL Editor.'
        : (err.message || 'Could not reorder tracks.')
      setError(msg)
      loadTracks(selected.id)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeletePlaylist() {
    if (!selected || busy) return
    if (!window.confirm(`Delete "${selected.name}" and all its tracks?`)) return
    setBusy(true)
    setError('')
    try {
      if (isThisQueue) playback.stop()
      await deletePlaylist(selected.id)
      backToList()
    } catch (err) {
      setError(err.message || 'Could not delete playlist.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCoverSave(url) {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await setPlaylistCover(selected.id, url)
      const next = { ...selected, coverUrl: url }
      setSelected(next)
      setPlaylists((prev) => prev.map((p) => (p.id === selected.id ? { ...p, coverUrl: url } : p)))
    } catch (err) {
      setError(err.message || 'Could not save cover.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCoverRemove() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await setPlaylistCover(selected.id, null)
      const next = { ...selected, coverUrl: null }
      setSelected(next)
      setPlaylists((prev) => prev.map((p) => (p.id === selected.id ? { ...p, coverUrl: null } : p)))
    } catch (err) {
      setError(err.message || 'Could not remove cover.')
    } finally {
      setBusy(false)
    }
  }

  if (needsSql) {
    return (
      <div className="border border-amber-400/50 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Playlists need <code className="text-[11px]">supabase-patch-playlists.sql</code> and related patches in Supabase SQL Editor.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={selected ? backToList : onBack}
            className="frens-btn-outline w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            aria-label="Back"
          >
            ←
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="frens-title-lg inline-flex items-center gap-2">
            <PlaylistIcon className="w-5 h-5" />
            {selected ? selected.name : 'Playlists'}
          </h2>
          {selected ? (
            !editing && (selected.trackCount ?? tracks.length) > 0 ? (
              <p className="text-xs frens-muted mt-0.5">
                {(selected.trackCount ?? tracks.length) === 1
                  ? '1 track'
                  : `${selected.trackCount ?? tracks.length} tracks`}
              </p>
            ) : null
          ) : !editable ? (
            <p className="text-xs frens-muted mt-0.5">{ownerName}</p>
          ) : null}
        </div>
        {!selected && editable ? (
          <button
            type="button"
            onClick={() => setListEditing((v) => !v)}
            className={`frens-btn-outline px-3 py-1.5 text-xs shrink-0 ${listEditing ? 'ring-2 ring-black/20 dark:ring-white/20' : ''}`}
          >
            {listEditing ? 'Done' : 'Edit'}
          </button>
        ) : null}
        {selected && editable ? (
          <button
            type="button"
            onClick={() => (editing ? exitEditMode() : setEditing(true))}
            className={`frens-btn-outline px-3 py-1.5 text-xs shrink-0 ${editing ? 'ring-2 ring-black/20 dark:ring-white/20' : ''}`}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        ) : null}
        {selected && !editable ? (
          <SavePlaylistButton
            playlistId={selected.id}
            onChange={() => loadSaved()}
          />
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-500 dark:text-red-400">{error}</p> : null}

      {!selected ? (
        <>
          {editable && listEditing ? (
            <ProfileShareToggle
              showcaseKey="playlists"
              label="Show on profile"
              hint=""
            />
          ) : null}
          {editable ? (
            <form onSubmit={handleCreatePlaylist} className="flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="New playlist"
                className="frens-input flex-1 text-sm"
                maxLength={40}
              />
              <button
                type="submit"
                disabled={busy || !newPlaylistName.trim()}
                className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
              >
                Create
              </button>
            </form>
          ) : null}

          {loading ? (
            <p className="text-sm frens-muted text-center py-8">Loading…</p>
          ) : (
            <>
              {editable && savedPlaylists.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs frens-label">Saved</p>
                  <ul className="space-y-2">
                    {savedPlaylists.map((pl) => (
                      <li key={pl.id}>
                        <PlaylistRow
                          playlist={pl}
                          subtitle={`${pl.ownerName} · ${pl.trackCount === 1 ? '1 track' : `${pl.trackCount} tracks`}`}
                          onOpen={() => openSaved(pl)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {playlists.length === 0 && savedPlaylists.length === 0 ? (
                <p className="text-sm frens-muted text-center py-8">
                  {editable ? 'Nothing here yet.' : 'Nothing shared yet.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {playlists.map((pl) => (
                    <li key={pl.id}>
                      <PlaylistRow playlist={pl} onOpen={openPlaylist} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {editing ? (
            <PlaylistCoverEditor
              coverUrl={selected.coverUrl}
              name={selected.name}
              editable={editable}
              busy={busy}
              onSave={handleCoverSave}
              onRemove={handleCoverRemove}
            />
          ) : (
            <PlaylistCoverBanner coverUrl={selected.coverUrl} />
          )}

          {editable && editing ? (
            <div className="flex flex-wrap items-center gap-2">
              {tracks.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setLayoutEditing((v) => !v)}
                  className={`frens-btn-outline px-3 py-1.5 text-xs ${layoutEditing ? 'ring-2 ring-black/20 dark:ring-white/20' : ''}`}
                >
                  {layoutEditing ? 'Done reordering' : 'Reorder'}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={handleDeletePlaylist}
                className="text-xs text-red-500 dark:text-red-400 hover:underline disabled:opacity-50 ml-auto"
              >
                Delete
              </button>
            </div>
          ) : null}

          {editable && editing && !layoutEditing ? (
            <form onSubmit={handleAddTrack} className="flex flex-wrap gap-2">
              <input
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="Paste link"
                className="frens-input flex-1 min-w-[10rem] text-sm"
              />
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="Title"
                className="frens-input w-[7rem] sm:w-36 text-sm"
                maxLength={80}
              />
              <button
                type="submit"
                disabled={busy || !urlDraft.trim()}
                className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
              >
                {busy ? '…' : 'Add'}
              </button>
            </form>
          ) : null}

          {loading ? (
            <p className="text-sm frens-muted text-center py-8">Loading…</p>
          ) : tracks.length === 0 ? (
            <p className="text-sm frens-muted text-center py-8">
              {editable
                ? (editing ? 'Add a link.' : 'Empty.')
                : 'Empty.'}
            </p>
          ) : layoutEditing ? (
            <PlaylistTrackEditList
              tracks={tracks}
              busy={busy}
              onReorder={persistTrackOrder}
              onRemove={handleRemoveTrack}
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="frens-btn-outline w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
                  aria-label={isPlaying ? 'Pause playlist' : 'Play playlist'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                {isPlaying && activeIndex >= 0 ? (
                  <p className="text-xs frens-muted truncate">
                    {tracks[activeIndex]?.title?.trim() || `Track ${activeIndex + 1}`}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                {tracks.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index}
                    activeIndex={activeIndex}
                    isPlaying={isPlaying}
                    queueActive={queueActive}
                    editable={editable && editing}
                    busy={busy}
                    canAura={canAura}
                    onPlayTrack={playTrack}
                    onRemove={handleRemoveTrack}
                    onAuraChange={handleAuraChange}
                  />
                ))}
              </div>
            </>
          )}

          <PlaylistComments playlistId={selected.id} />
        </>
      )}
    </div>
  )
}
