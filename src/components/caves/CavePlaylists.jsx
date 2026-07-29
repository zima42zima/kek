import { useEffect, useState } from 'react'
import { usePlaylistPlayback } from '../../context/PlaylistPlaybackContext'
import PlaylistIcon from '../playlists/PlaylistIcon'
import PlaylistCoverEditor, { PlaylistCoverBanner, PlaylistCoverThumb } from '../playlists/PlaylistCover'
import { VideoTimelineCard } from '../YouTubeEmbed'
import PlaylistTrackEditList from '../playlists/PlaylistTrackEditList'
import { PlusIcon } from '../icons/UiIcons'
import { canModerateCavePlaylists } from '../../lib/caveRoles'
import {
  addCavePlaylistTrack,
  createCavePlaylist,
  deleteCavePlaylist,
  listCavePlaylistTracks,
  listCavePlaylists,
  removeCavePlaylistTrack,
  reorderCavePlaylistTracks,
  setCavePlaylistCover,
  trackToEmbed,
  validatePlaylistVideoUrl,
  CavePlaylistsNotInstalledError,
} from '../../lib/cavePlaylists'

function playlistStorageKey(caveId) {
  return `frens-cave-pl-${caveId}`
}

function PlaylistRow({ playlist, onOpen }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(playlist) }}
      className="w-full text-left border frens-border rounded-lg px-3 py-2.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
    >
      <div className="flex items-center gap-2.5">
        <PlaylistCoverThumb coverUrl={playlist.coverUrl} name={playlist.name} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium truncate">{playlist.name}</h3>
          <p className="text-[11px] frens-muted mt-0.5">
            {playlist.trackCount === 1 ? '1 track' : `${playlist.trackCount} tracks`}
          </p>
        </div>
        <span className="text-[11px] frens-muted">→</span>
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
  onPlayTrack,
  onRemove,
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
      {editable ? (
        <div className="flex items-center gap-2 -mt-1 mb-1 px-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemove(track.id)}
            className="text-[11px] frens-action ml-auto disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function CavePlaylists({ cave, currentUserId }) {
  const playback = usePlaylistPlayback()
  const canModerate = canModerateCavePlaylists(cave, currentUserId)

  const [playlists, setPlaylists] = useState([])
  const [tracks, setTracks] = useState([])
  const [selected, setSelected] = useState(null)
  const [listLoading, setListLoading] = useState(true)
  const [tracksLoading, setTracksLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsSql, setNeedsSql] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [urlDraft, setUrlDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [layoutEditing, setLayoutEditing] = useState(false)
  const [editing, setEditing] = useState(false)

  const isThisQueue = Boolean(selected && playback?.isActivePlaylist(`cave-${selected.id}`))
  const queueActive = Boolean(playback?.meta?.playlistId && playback.tracks?.length > 0)
  const activeIndex = isThisQueue ? playback.activeIndex : -1
  const isPlaying = isThisQueue && playback.isPlaying

  function queueMeta() {
    return {
      playlistId: `cave-${selected?.id}`,
      playlistName: `${cave.name} · ${selected?.name}`,
      ownerId: cave.id,
      ownerName: cave.name,
    }
  }

  function loadPlaylists() {
    setListLoading(true)
    setError('')
    listCavePlaylists(cave.id)
      .then(setPlaylists)
      .catch((err) => {
        if (err instanceof CavePlaylistsNotInstalledError) {
          setNeedsSql(true)
          setPlaylists([])
          return
        }
        setError(err.message || 'Could not load cave playlists.')
      })
      .finally(() => setListLoading(false))
  }

  function loadTracks(playlistId) {
    setTracksLoading(true)
    setError('')
    listCavePlaylistTracks(playlistId)
      .then(setTracks)
      .catch((err) => {
        if (err instanceof CavePlaylistsNotInstalledError) {
          setNeedsSql(true)
          setTracks([])
          return
        }
        setError(err.message || 'Could not load tracks.')
      })
      .finally(() => setTracksLoading(false))
  }

  useEffect(() => {
    loadPlaylists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cave.id])

  useEffect(() => {
    if (listLoading || selected || playlists.length === 0) return
    let savedId = null
    try {
      savedId = sessionStorage.getItem(playlistStorageKey(cave.id))
    } catch { /* ignore */ }
    if (!savedId) return
    const pl = playlists.find((p) => p.id === savedId)
    if (!pl) return
    setSelected(pl)
    setLayoutEditing(false)
    setEditing(false)
    loadTracks(pl.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listLoading, playlists, selected, cave.id])

  function openPlaylist(pl) {
    setSelected(pl)
    setTracks([])
    setLayoutEditing(false)
    setEditing(false)
    try {
      sessionStorage.setItem(playlistStorageKey(cave.id), pl.id)
    } catch { /* ignore */ }
    loadTracks(pl.id)
  }

  function backToList() {
    setSelected(null)
    setTracks([])
    setLayoutEditing(false)
    setEditing(false)
    try {
      sessionStorage.removeItem(playlistStorageKey(cave.id))
    } catch { /* ignore */ }
    loadPlaylists()
  }

  function exitEditMode() {
    setEditing(false)
    setLayoutEditing(false)
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
      await createCavePlaylist(cave.id, newPlaylistName)
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
      await addCavePlaylistTrack(selected.id, urlDraft, titleDraft)
      setUrlDraft('')
      setTitleDraft('')
      loadTracks(selected.id)
      loadPlaylists()
      if (isThisQueue) {
        const updated = await listCavePlaylistTracks(selected.id)
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
      await removeCavePlaylistTrack(id)
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
      await reorderCavePlaylistTracks(selected.id, nextTracks.map((t) => t.id))
      if (isThisQueue) {
        const nextIndex = nextTracks.findIndex((t) => t.id === oldActiveId)
        playback.setQueue(nextTracks, queueMeta(), nextIndex >= 0 ? nextIndex : 0)
      }
    } catch (err) {
      setError(err.message || 'Could not reorder tracks.')
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
      await deleteCavePlaylist(selected.id)
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
      await setCavePlaylistCover(selected.id, url)
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
      await setCavePlaylistCover(selected.id, null)
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
      <div className="border border-amber-400/50 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 m-3 space-y-2">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Cave playlists need <code className="text-[11px]">supabase-patch-cave-playlists.sql</code> in Supabase SQL Editor.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Open the file in this project, paste the full contents into SQL Editor, and run it.
          Then hard-refresh the app (or wait ~30s for the API cache to reload).
        </p>
      </div>
    )
  }

  const trackCount = selected?.trackCount ?? tracks.length

  return (
    <div className="pb-8">
      <div className="sticky top-[var(--frens-cave-chrome-h,4.75rem)] z-10 shrink-0 frens-surface border-b frens-border px-3 pt-2.5 pb-2 flex items-center gap-2">
        {selected ? (
          <button
            type="button"
            onClick={backToList}
            className="frens-action w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            aria-label="Back to playlists"
          >
            ‹
          </button>
        ) : (
          <PlaylistIcon className="w-4 h-4 shrink-0 frens-muted" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium truncate leading-snug">
            {selected ? selected.name : 'Playlists'}
          </h2>
          {selected ? (
            <p className="text-[11px] frens-muted truncate">
              {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
              {canModerate && editing ? ' · adding tracks' : ''}
            </p>
          ) : (
            <p className="text-[11px] frens-muted truncate">
              {canModerate ? 'Tap + on a playlist to add tracks' : 'Listen together'}
            </p>
          )}
        </div>
        {selected && canModerate ? (
          <button
            type="button"
            onClick={() => (editing ? exitEditMode() : setEditing(true))}
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition ${
              editing
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'frens-btn-outline'
            }`}
            aria-label={editing ? 'Done editing playlist' : 'Add tracks to playlist'}
            title={editing ? 'Done' : 'Add tracks'}
          >
            {editing ? <span className="text-sm leading-none">✓</span> : <PlusIcon className="w-4 h-4" />}
          </button>
        ) : null}
      </div>

      <div className={`px-3 pb-2 space-y-3 ${selected ? 'pt-[calc(0.875rem+3mm)]' : 'pt-2'}`}>
      {error ? (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      ) : null}

      {!selected ? (
        <>
          {canModerate ? (
            <form onSubmit={handleCreatePlaylist} className="flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="New playlist name"
                className="frens-input flex-1 text-sm py-1.5"
                maxLength={40}
              />
              <button
                type="submit"
                disabled={busy || !newPlaylistName.trim()}
                className="frens-btn-outline px-3 py-1.5 text-xs shrink-0 disabled:opacity-50"
              >
                Create
              </button>
            </form>
          ) : null}

          {listLoading ? (
            <p className="text-sm frens-muted text-center py-6">Loading…</p>
          ) : playlists.length === 0 ? (
            <div className="border frens-border rounded-lg p-6 text-center">
              <p className="text-sm frens-muted">
                {canModerate
                  ? 'No playlists yet — create one above.'
                  : 'No playlists in this cave yet.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {playlists.map((pl) => (
                <li key={pl.id}>
                  <PlaylistRow playlist={pl} onOpen={openPlaylist} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {editing ? (
            <PlaylistCoverEditor
              coverUrl={selected.coverUrl}
              name={selected.name}
              editable={canModerate}
              busy={busy}
              onSave={handleCoverSave}
              onRemove={handleCoverRemove}
            />
          ) : (
            <PlaylistCoverBanner coverUrl={selected.coverUrl} />
          )}

          {canModerate && editing ? (
            <div className="flex flex-wrap items-center gap-2">
              {tracks.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setLayoutEditing((v) => !v)}
                  className={`frens-btn-outline px-2.5 py-1 text-[11px] ${layoutEditing ? 'ring-2 ring-black/20 dark:ring-white/20' : ''}`}
                >
                  {layoutEditing ? 'Done reordering' : 'Reorder'}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={handleDeletePlaylist}
                className="text-[11px] text-red-500 dark:text-red-400 hover:underline disabled:opacity-50 ml-auto"
              >
                Delete
              </button>
            </div>
          ) : null}

          {canModerate && editing && !layoutEditing ? (
            <form onSubmit={handleAddTrack} className="space-y-2 border frens-border rounded-lg p-2.5">
              <input
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="YouTube or Vimeo link"
                className="frens-input w-full text-sm py-1.5"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="Title (optional)"
                  className="frens-input flex-1 text-sm py-1.5"
                  maxLength={80}
                />
                <button
                  type="submit"
                  disabled={busy || !urlDraft.trim()}
                  className="frens-btn-outline px-3 py-1.5 text-xs shrink-0 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </form>
          ) : null}

          {layoutEditing ? (
            <p className="text-[11px] frens-hint">Drag the ⋮⋮ handle to reorder tracks.</p>
          ) : null}

          {tracksLoading ? (
            <p className="text-sm frens-muted text-center py-6">Loading…</p>
          ) : tracks.length === 0 ? (
            <p className="text-sm frens-muted text-center py-6">
              {canModerate
                ? (editing ? 'No tracks yet — paste a link above.' : 'Tap + to add tracks.')
                : 'Empty playlist.'}
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
                  className="frens-btn-outline w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  aria-label={isPlaying ? 'Pause playlist' : 'Play playlist'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                {isPlaying && activeIndex >= 0 ? (
                  <p className="text-[11px] frens-muted truncate">
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
                    editable={canModerate && editing}
                    busy={busy}
                    onPlayTrack={playTrack}
                    onRemove={handleRemoveTrack}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  )
}
