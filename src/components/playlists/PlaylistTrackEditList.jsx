import { useRef, useState } from 'react'

function reorderList(items, fromIndex, toIndex) {
  if (fromIndex === toIndex) return items
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

/**
 * Compact draggable track list for playlist edit mode.
 * Supports mouse drag-and-drop and touch pointer drag via the ⋮⋮ handle.
 */
export default function PlaylistTrackEditList({
  tracks,
  busy,
  onReorder,
  onRemove,
}) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const overIndexRef = useRef(null)
  const pointerDrag = useRef({ active: false, index: -1, pointerId: null })

  function setDropIndex(index) {
    overIndexRef.current = index
    setOverIndex(index)
  }

  function finishDrag(from, to) {
    pointerDrag.current = { active: false, index: -1, pointerId: null }
    setDragIndex(null)
    setDropIndex(null)
    if (from == null || to == null || from === to) return
    onReorder(reorderList(tracks, from, to))
  }

  function indexFromPoint(clientY) {
    const el = document.elementFromPoint(window.innerWidth / 2, clientY)
    const row = el?.closest('[data-track-index]')
    if (!row) return null
    const idx = Number(row.getAttribute('data-track-index'))
    return Number.isNaN(idx) ? null : idx
  }

  function onHandlePointerDown(e, index) {
    if (busy) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerDrag.current = { active: true, index, pointerId: e.pointerId }
    setDragIndex(index)
    setDropIndex(index)
  }

  function onHandlePointerMove(e) {
    if (!pointerDrag.current.active || pointerDrag.current.pointerId !== e.pointerId) return
    const idx = indexFromPoint(e.clientY)
    if (idx != null) setDropIndex(idx)
  }

  function onHandlePointerUp(e) {
    if (!pointerDrag.current.active || pointerDrag.current.pointerId !== e.pointerId) return
    const from = pointerDrag.current.index
    const to = overIndexRef.current ?? from
    finishDrag(from, to)
  }

  function onDragStart(e, index) {
    if (busy) {
      e.preventDefault()
      return
    }
    setDragIndex(index)
    setDropIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  function onDragOver(e, index) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIndex(index)
  }

  function onDrop(e, index) {
    e.preventDefault()
    const raw = e.dataTransfer.getData('text/plain')
    const from = dragIndex ?? (raw === '' ? null : Number(raw))
    finishDrag(from, index)
  }

  return (
    <div className="space-y-2">
      {tracks.map((track, index) => {
        const isDragging = dragIndex === index
        const isOver = overIndex === index && dragIndex !== null && dragIndex !== index
        return (
          <div
            key={track.id}
            data-track-index={index}
            draggable={!busy}
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDrop={(e) => onDrop(e, index)}
            onDragEnd={() => finishDrag(null, null)}
            className={`flex items-center gap-2 border frens-border rounded-xl p-3 transition-colors ${
              isDragging ? 'opacity-50 scale-[0.98]' : 'bg-black/[0.02] dark:bg-white/[0.02]'
            } ${isOver ? 'ring-2 ring-[#6BC06B] border-[#6BC06B]/50' : ''}`}
          >
            <button
              type="button"
              disabled={busy}
              onPointerDown={(e) => onHandlePointerDown(e, index)}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              className="shrink-0 w-8 h-8 rounded-lg frens-muted hover:bg-black/5 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing touch-none disabled:opacity-40"
              aria-label={`Drag to reorder ${track.title || 'track'}`}
            >
              ⋮⋮
            </button>
            <span className="text-xs frens-muted w-5 text-center shrink-0">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{track.title?.trim() || 'Untitled track'}</p>
              <p className="text-[10px] frens-muted truncate">{track.videoUrl}</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(track.id)}
              className="frens-btn-outline px-2 h-8 rounded-full text-[11px] disabled:opacity-50 shrink-0"
            >
              Remove
            </button>
          </div>
        )
      })}
    </div>
  )
}
