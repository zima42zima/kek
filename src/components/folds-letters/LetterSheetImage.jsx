import { forwardRef, useRef } from 'react'
import { normalizeImageLayout } from '../../lib/letterImageLayout'

const LetterSheetImage = forwardRef(function LetterSheetImage({
  src,
  layout: rawLayout,
  selected = false,
  onSelect,
  onChange,
  onLayoutChange,
}, ref) {
  const layout = normalizeImageLayout(rawLayout)
  const dragRef = useRef(null)

  function sheetRect(node) {
    return node?.closest('.letter-standard-sheet')?.getBoundingClientRect()
  }

  function emit(next) {
    const normalized = normalizeImageLayout(next)
    onChange?.(normalized)
    onLayoutChange?.()
  }

  function onDragStart(e) {
    if (e.button !== 0 || e.target.closest('[data-image-resize]')) return
    e.preventDefault()
    e.stopPropagation()
    onSelect?.()
    const rect = sheetRect(e.currentTarget)
    if (!rect) return
    dragRef.current = {
      kind: 'move',
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...layout },
      rect,
    }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
  }

  function onResizeStart(e) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    onSelect?.()
    const rect = sheetRect(e.currentTarget)
    if (!rect) return
    dragRef.current = {
      kind: 'resize',
      startX: e.clientX,
      orig: { ...layout },
      rect,
    }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
  }

  function onDragMove(e) {
    const d = dragRef.current
    if (!d) return
    const dxPct = ((e.clientX - d.startX) / d.rect.width) * 100
    const dyPct = ((e.clientY - d.startY) / d.rect.height) * 100

    if (d.kind === 'move') {
      emit({
        x: d.orig.x + dxPct,
        y: d.orig.y + dyPct,
        w: d.orig.w,
      })
      return
    }

    emit({ ...d.orig, w: d.orig.w + dxPct })
  }

  function onDragEnd() {
    dragRef.current = null
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
    onLayoutChange?.()
  }

  return (
    <div
      ref={ref}
      className={`letter-sheet-image ${selected ? 'letter-sheet-image--active' : ''}`}
      style={{ left: `${layout.x}%`, top: `${layout.y}%`, width: `${layout.w}%` }}
      onPointerDown={onDragStart}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      role="presentation"
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="letter-sheet-image__img"
        onLoad={() => onLayoutChange?.()}
      />
      {selected ? (
        <button
          type="button"
          data-image-resize
          aria-label="Resize photo"
          className="letter-sheet-image__resize"
          onPointerDown={onResizeStart}
        />
      ) : null}
    </div>
  )
})

export default LetterSheetImage
