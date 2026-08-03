import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchProfileForUser, getSupabaseProjectRef } from '../lib/profile'
import { linkLabel } from '../lib/urls'
import GathererIcon from '../components/gatherer/GathererIcon'
import ProfileShareToggle from '../components/ProfileShareToggle'
import {
  addMoodboardItemFromFile,
  addMoodboardItemFromUrl,
  checkMoodboardsInstalled,
  createMoodboard,
  deleteMoodboard,
  isLegacyMoodboardId,
  listMoodboardItems,
  listUserMoodboards,
  removeGalleryItem,
  reorderMoodboardItems,
  updateMoodboard,
  setMoodboardCover,
  GalleryNotInstalledError,
} from '../lib/gallery'

function MoodboardsSqlBanner() {
  const project = getSupabaseProjectRef()
  return (
    <div className="border border-amber-400/50 rounded-xl p-3 bg-amber-50 dark:bg-amber-950/20">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        Named boards, public/private, and reorder need{' '}
        <code className="text-[11px]">supabase-patch-moodboards.sql</code> in Supabase SQL Editor.
      </p>
      {project ? (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1.5">
          Your app points to project <strong>{project}</strong> — run the patch there, then hard-refresh.
        </p>
      ) : null}
      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
        Gallery is working; you can still add images to My moodboard below.
      </p>
    </div>
  )
}

function MoodboardCoverThumb({ coverUrl, name }) {
  const [broken, setBroken] = useState(false)
  if (coverUrl && !broken) {
    return (
      <img
        src={coverUrl}
        alt=""
        className="w-12 h-12 rounded-xl object-cover shrink-0 border frens-border bg-black/5 dark:bg-white/5"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span
      className="w-12 h-12 rounded-xl border frens-border bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0"
      aria-hidden
      title={name}
    >
      <GathererIcon className="w-5 h-5 opacity-70" />
    </span>
  )
}

function MoodboardRow({ board, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(board)}
      className="w-full text-left border frens-border rounded-xl p-3.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
    >
      <div className="flex items-center gap-3">
        <MoodboardCoverThumb coverUrl={board.coverUrl} name={board.name} />
        <div className="min-w-0 flex-1">
          <h3 className="frens-title-sm truncate">{board.name}</h3>
          <p className="text-xs frens-muted mt-0.5">
            {board.itemCount === 1 ? '1 image' : `${board.itemCount} images`}
          </p>
        </div>
        <span className="text-xs frens-muted">→</span>
      </div>
    </button>
  )
}

function MoodboardTile({
  item,
  index,
  total,
  editing,
  editable,
  isCover,
  onSetCover,
  onRemove,
  onMoveEarlier,
  onMoveLater,
}) {
  const [broken, setBroken] = useState(false)
  const href = item.sourceUrl || item.imageUrl
  const label = href ? linkLabel(href) : null

  const image = broken ? (
    <div className="w-full h-full flex items-center justify-center p-4 text-center min-h-[12rem]">
      <span className="text-xs frens-muted">
        {editing ? 'Preview unavailable' : 'Tap to open source'}
      </span>
    </div>
  ) : (
    <img
      src={item.imageUrl}
      alt={item.caption || 'Moodboard image'}
      className="w-full h-full object-cover transition group-hover:scale-[1.02]"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      draggable={false}
    />
  )

  return (
    <figure className="relative group">
      {editing ? (
        <div className="block rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 aspect-[4/5] ring-2 ring-[#6BC06B]/40">
          {image}
        </div>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 aspect-[4/5] focus:outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#6BC06B]"
          title={href ? `Open on ${label}` : 'Open image'}
        >
          {image}
        </a>
      )}

      {isCover ? (
        <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-black text-white dark:bg-white dark:text-black">
          Cover
        </span>
      ) : null}

      {editable && editing ? (
        <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMoveEarlier(index)}
            className="frens-btn-outline w-8 h-8 rounded-full text-xs disabled:opacity-30"
            aria-label="Move earlier"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="frens-btn-outline px-2 h-8 rounded-full text-[11px]"
          >
            Remove
          </button>
          <button
            type="button"
            disabled={index >= total - 1}
            onClick={() => onMoveLater(index)}
            className="frens-btn-outline w-8 h-8 rounded-full text-xs disabled:opacity-30"
            aria-label="Move later"
          >
            →
          </button>
          <button
            type="button"
            disabled={isCover}
            onClick={() => onSetCover?.(item)}
            className="frens-btn-outline px-2 h-8 rounded-full text-[11px] disabled:opacity-40"
          >
            {isCover ? 'Cover' : 'Use as cover'}
          </button>
        </div>
      ) : editable && !editing ? (
        <>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white text-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label="Remove"
          >
            ×
          </button>
          {!isCover && onSetCover ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSetCover(item)
              }}
              className="absolute bottom-2 left-2 px-2 h-7 rounded-full bg-black/70 text-white text-[10px] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              Cover
            </button>
          ) : null}
        </>
      ) : null}
    </figure>
  )
}

export default function Gatherer({
  userId,
  editable: editableProp,
  onBack,
  initialMoodboardId = null,
  onConsumedInitialMoodboard,
}) {
  const { user, profile } = useAuth()
  const [ownerName, setOwnerName] = useState(profile?.frenName || 'Fren')
  const [boards, setBoards] = useState([])
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [urlDraft, setUrlDraft] = useState('')
  const [needsGallerySql, setNeedsGallerySql] = useState(false)
  const [moodboardsInstalled, setMoodboardsInstalled] = useState(null)
  const [newBoardName, setNewBoardName] = useState('')
  const [editName, setEditName] = useState('')
  const [editPublic, setEditPublic] = useState(true)
  const [listEditing, setListEditing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [layoutEditing, setLayoutEditing] = useState(false)
  const fileRef = useRef(null)

  const editable = editableProp ?? Boolean(user?.id && userId && user.id === userId)
  const legacyBoard = selected ? isLegacyMoodboardId(selected.id) : false

  useEffect(() => {
    checkMoodboardsInstalled().then(setMoodboardsInstalled)
  }, [userId])

  function loadBoards() {
    if (!userId) return
    setLoading(true)
    setError('')
    listUserMoodboards(userId)
      .then(setBoards)
      .catch((err) => {
        if (err instanceof GalleryNotInstalledError) {
          setNeedsGallerySql(true)
          setBoards([])
          return
        }
        setError(err.message || 'Could not load moodboards.')
      })
      .finally(() => setLoading(false))
  }

  function loadItems(moodboardId) {
    setLoading(true)
    setError('')
    listMoodboardItems(moodboardId)
      .then(setItems)
      .catch((err) => {
        if (err instanceof GalleryNotInstalledError) {
          setNeedsGallerySql(true)
          setItems([])
          return
        }
        setError(err.message || 'Could not load moodboard.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadBoards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

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
    setItems([])
    setEditing(false)
    setLayoutEditing(false)
    setListEditing(false)
    loadBoards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!initialMoodboardId) return
    if (boards.length === 0) return
    const board = boards.find((b) => b.id === initialMoodboardId)
    if (board) {
      setSelected(board)
      setEditName(board.name)
      setEditPublic(board.isPublic)
      loadItems(board.id)
      onConsumedInitialMoodboard?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMoodboardId, boards])

  function openBoard(board) {
    setSelected(board)
    setEditName(board.name)
    setEditPublic(board.isPublic)
    setEditing(false)
    setLayoutEditing(false)
    loadItems(board.id)
  }

  function backToList() {
    setSelected(null)
    setItems([])
    setEditing(false)
    setLayoutEditing(false)
    loadBoards()
  }

  function exitEditMode() {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== selected.name) {
      persistBoardMeta(trimmed, editPublic)
    } else {
      setEditName(selected.name)
    }
    setLayoutEditing(false)
    setEditing(false)
  }

  async function persistBoardMeta(name, isPublic) {
    if (!selected || !editable) return
    setBusy(true)
    setError('')
    try {
      await updateMoodboard(selected.id, { name, isPublic })
      const next = { ...selected, name, isPublic }
      setSelected(next)
      setBoards((prev) => prev.map((b) => (b.id === selected.id ? { ...b, name, isPublic } : b)))
    } catch (err) {
      setError(err.message || 'Could not update moodboard.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateBoard(e) {
    e.preventDefault()
    if (!newBoardName.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const id = await createMoodboard(newBoardName, true)
      setNewBoardName('')
      await loadBoards()
      const created = (await listUserMoodboards(userId)).find((b) => b.id === id)
      if (created) openBoard(created)
    } catch (err) {
      setError(err.message || 'Could not create moodboard.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteBoard() {
    if (!selected || busy) return
    if (!window.confirm(`Delete "${selected.name}" and all its images?`)) return
    setBusy(true)
    setError('')
    try {
      await deleteMoodboard(selected.id)
      backToList()
    } catch (err) {
      setError(err.message || 'Could not delete moodboard.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddUrl(e) {
    e.preventDefault()
    if (!selected || !urlDraft.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await addMoodboardItemFromUrl(selected.id, urlDraft)
      setUrlDraft('')
      loadItems(selected.id)
      loadBoards()
    } catch (err) {
      setError(err.message || 'Could not add image.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!selected || !file || busy) return
    setBusy(true)
    setError('')
    try {
      await addMoodboardItemFromFile(selected.id, file)
      loadItems(selected.id)
      loadBoards()
    } catch (err) {
      setError(err.message || 'Could not upload image.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSetCover(item) {
    if (!selected || !item?.id || busy) return
    setBusy(true)
    setError('')
    try {
      await setMoodboardCover(selected.id, item.id, { imageUrl: item.imageUrl })
      const next = {
        ...selected,
        coverUrl: item.imageUrl || selected.coverUrl,
        coverItemId: item.id,
      }
      setSelected(next)
      setBoards((prev) => prev.map((b) => (b.id === selected.id ? { ...b, ...next } : b)))
    } catch (err) {
      setError(err.message || 'Could not set cover.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id) {
    setBusy(true)
    setError('')
    try {
      await removeGalleryItem(id)
      const next = items.filter((item) => item.id !== id)
      setItems(next)
      loadBoards()
    } catch (err) {
      setError(err.message || 'Could not remove image.')
      if (selected) loadItems(selected.id)
    } finally {
      setBusy(false)
    }
  }

  async function persistOrder(nextItems) {
    if (!selected) return
    setItems(nextItems)
    setBusy(true)
    setError('')
    try {
      await reorderMoodboardItems(selected.id, nextItems.map((item) => item.id))
    } catch (err) {
      setError(err.message || 'Could not reorder images.')
      loadItems(selected.id)
    } finally {
      setBusy(false)
    }
  }

  function moveEarlier(index) {
    if (index <= 0) return
    const next = [...items]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    persistOrder(next)
  }

  function moveLater(index) {
    if (index >= items.length - 1) return
    const next = [...items]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    persistOrder(next)
  }

  if (needsGallerySql) {
    return (
      <div className="border border-amber-400/50 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Moodboards need <code className="text-[11px]">supabase-patch-profile-gallery.sql</code> in Supabase SQL Editor.
        </p>
        {getSupabaseProjectRef() ? (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1.5">
            Your app points to project <strong>{getSupabaseProjectRef()}</strong>.
          </p>
        ) : null}
      </div>
    )
  }

  if (selected) {
    const tileEditable = editable && (editing || layoutEditing)

    return (
      <div className="space-y-4">
        {moodboardsInstalled === false ? <MoodboardsSqlBanner /> : null}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={backToList}
            className="frens-btn-outline w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            aria-label="Back to moodboards"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="frens-title-lg truncate">{selected.name}</h2>
            {!editing && items.length > 0 ? (
              <p className="text-xs frens-muted mt-0.5">
                {items.length === 1 ? '1 image' : `${items.length} images`}
              </p>
            ) : null}
          </div>
          {editable && !legacyBoard ? (
            <button
              type="button"
              onClick={() => (editing ? exitEditMode() : setEditing(true))}
              className={`frens-btn-outline px-3 py-1.5 text-xs shrink-0 ${editing ? 'ring-2 ring-black/20 dark:ring-white/20' : ''}`}
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          ) : null}
        </div>

        {editable && editing && !legacyBoard ? (
          <div className="space-y-3 border frens-border rounded-xl p-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                const trimmed = editName.trim()
                if (!trimmed || trimmed === selected.name) {
                  setEditName(selected.name)
                  return
                }
                persistBoardMeta(trimmed, editPublic)
              }}
              maxLength={48}
              className="frens-input w-full text-sm"
              aria-label="Board name"
              placeholder="Name"
            />
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editPublic}
                onChange={(e) => {
                  const next = e.target.checked
                  setEditPublic(next)
                  persistBoardMeta(editName.trim() || selected.name, next)
                }}
                className="ps-checkbox"
              />
              <span>Public</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {items.length > 0 ? (
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
                onClick={handleDeleteBoard}
                className="text-xs text-red-500 dark:text-red-400 hover:underline disabled:opacity-50 ml-auto"
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}

        {editable && editing && !layoutEditing ? (
          <form onSubmit={handleAddUrl} className="flex flex-wrap gap-2">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="Paste link"
              className="frens-input flex-1 min-w-[10rem] text-sm"
            />
            <button
              type="submit"
              disabled={busy || !urlDraft.trim()}
              className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
            >
              {busy ? '…' : 'Add'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
            >
              Upload
            </button>
          </form>
        ) : null}

        {error ? <p className="text-xs text-red-500 dark:text-red-400">{error}</p> : null}

        {loading ? (
          <p className="text-sm frens-muted text-center py-8">Loading…</p>
        ) : items.length === 0 ? (
          editable && editing ? (
            <p className="text-sm frens-muted text-center py-8">Add a link or photo.</p>
          ) : (
            <p className="text-sm frens-muted text-center py-8">Empty.</p>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, index) => {
              const isCover = selected?.coverItemId
                ? selected.coverItemId === item.id
                : Boolean(selected?.coverUrl && item.imageUrl === selected.coverUrl)
              return (
                <MoodboardTile
                  key={item.id}
                  item={item}
                  index={index}
                  total={items.length}
                  editing={layoutEditing}
                  editable={tileEditable}
                  isCover={isCover}
                  onSetCover={editable && editing ? handleSetCover : undefined}
                  onRemove={handleRemove}
                  onMoveEarlier={moveEarlier}
                  onMoveLater={moveLater}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {moodboardsInstalled === false ? <MoodboardsSqlBanner /> : null}
      <div className="flex items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="frens-btn-outline w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            aria-label="Back"
          >
            ←
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="frens-title-lg inline-flex items-center gap-2">
            <GathererIcon className="w-5 h-5" />
            Moodboards
          </h2>
          {!editable ? (
            <p className="text-xs frens-muted mt-0.5">{ownerName}</p>
          ) : null}
        </div>
        {editable ? (
          <button
            type="button"
            onClick={() => setListEditing((v) => !v)}
            className={`frens-btn-outline px-3 py-1.5 text-xs shrink-0 ${listEditing ? 'ring-2 ring-black/20 dark:ring-white/20' : ''}`}
          >
            {listEditing ? 'Done' : 'Edit'}
          </button>
        ) : null}
      </div>

      {editable && listEditing ? (
        <ProfileShareToggle
          showcaseKey="moodboards"
          label="Show on profile"
          hint=""
        />
      ) : null}

      {editable && moodboardsInstalled ? (
        <form onSubmit={handleCreateBoard} className="flex gap-2">
          <input
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            placeholder="New board"
            maxLength={48}
            className="frens-input flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !newBoardName.trim()}
            className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
          >
            Create
          </button>
        </form>
      ) : null}

      {error ? <p className="text-xs text-red-500 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm frens-muted text-center py-8">Loading…</p>
      ) : boards.length === 0 ? (
        <p className="text-sm frens-muted text-center py-8">
          {editable ? 'Nothing here yet.' : 'Nothing shared yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {boards.map((board) => (
            <MoodboardRow
              key={board.id}
              board={board}
              onOpen={openBoard}
            />
          ))}
        </div>
      )}
    </div>
  )
}
