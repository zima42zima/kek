import { useCallback, useRef, useState } from 'react'
import Modal from '../Modal'
import {
  DEFAULT_IMAGE_TRANSFORM,
  normalizeImageTransform,
  foldPrintMarginCss,
  foldPrintMarginInset,
  FOLD_PRINT_MARGIN_MM,
} from '../../lib/foldFormats'

/** Explicit dark-safe button styles (letter-btn white boxes break in dark UI). */
const btnGhost =
  'px-3 py-2.5 text-xs rounded-xl border border-black/20 dark:border-white/30 text-black dark:text-white bg-transparent hover:bg-black/5 dark:hover:bg-white/10 transition'
const btnDanger =
  'px-3 py-2.5 text-xs rounded-xl border border-red-500/50 text-red-600 dark:text-red-400 bg-transparent hover:bg-red-500/10 transition'
const btnPrimary =
  'flex-1 py-2.5 text-sm rounded-xl font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-40'
const btnSecondary =
  'flex-1 py-2.5 text-sm rounded-xl font-medium border border-black/25 dark:border-white/35 text-black dark:text-white bg-transparent hover:bg-black/5 dark:hover:bg-white/10 transition'

/**
 * Adjust imported art: pan, zoom, rotate, delete.
 */
export default function FoldPanelAdjust({
  slot,
  label = 'Panel',
  /** @deprecated */
  margins: _legacyMargins,
  /** Fixed A4 print margin preview (pages only). Zine cells use false. */
  sheetMargins = false,
  aspect = 'zine',
  onSave,
  onClose,
  onReplace,
  onDelete,
}) {
  const [local, setLocal] = useState(() => ({
    ...slot,
    transform: normalizeImageTransform(slot?.transform || DEFAULT_IMAGE_TRANSFORM),
  }))
  const dragRef = useRef(null)
  const stageRef = useRef(null)
  const t = normalizeImageTransform(local.transform)

  const patchT = useCallback((partial) => {
    setLocal((prev) => ({
      ...prev,
      transform: normalizeImageTransform({ ...prev.transform, ...partial }),
    }))
  }, [])

  function onPointerDown(e) {
    if (local.kind !== 'image') return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      x0: e.clientX,
      y0: e.clientY,
      tx: t.x,
      ty: t.y,
    }
  }

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const rect = (stageRef.current || e.currentTarget).getBoundingClientRect()
    const dx = ((e.clientX - d.x0) / Math.max(rect.width, 1)) * 100
    const dy = ((e.clientY - d.y0) / Math.max(rect.height, 1)) * 100
    patchT({ x: d.tx + dx, y: d.ty + dy })
  }

  function onPointerUp(e) {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch { /* ignore */ }
  }

  // Zine cell ≈ 2.83:1; keep a usable height on phone
  const aspectStyle =
    aspect === 'a4'
      ? { aspectRatio: '210 / 297', maxHeight: 'min(42vh, 360px)' }
      : { aspectRatio: '1 / 1', maxHeight: 'min(42vh, 320px)', width: '100%', maxWidth: '320px', margin: '0 auto' }

  return (
    <Modal title={`Adjust · ${label}`} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs frens-muted text-center">
          Full image at 1× · drag to move · zoom &amp; rotate yourself
          {sheetMargins ? ` · ${FOLD_PRINT_MARGIN_MM} mm print margin` : ''}
        </p>

        {/* Fixed-size stage — absolute fill so image always has a real box */}
        <div
          ref={stageRef}
          className="relative mx-auto w-full overflow-hidden rounded-xl border frens-border bg-neutral-300 dark:bg-neutral-800 touch-none cursor-grab active:cursor-grabbing"
          style={aspectStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {local.kind === 'image' && local.dataUrl ? (
            <div
              className="absolute inset-0 overflow-hidden"
              style={sheetMargins ? { ...foldPrintMarginCss(false), boxSizing: 'border-box' } : undefined}
            >
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={local.dataUrl}
                  alt=""
                  draggable={false}
                  className="select-none pointer-events-none"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center',
                    maxWidth: 'none',
                    transform: `translate(-50%, -50%) translate(${t.x}%, ${t.y}%) rotate(${t.rotate}deg) scale(${t.scale})`,
                    transformOrigin: 'center center',
                  }}
                />
              </div>
            </div>
          ) : local.kind === 'pdf' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3">
              <span className="text-xs font-medium text-black dark:text-white">PDF</span>
              <span className="text-[10px] frens-muted truncate max-w-full">{local.name}</span>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs frens-muted">
              No image
            </div>
          )}
          {sheetMargins ? (
            <div
              className="pointer-events-none absolute border border-dashed border-black/40 dark:border-white/40 rounded-sm"
              style={foldPrintMarginInset(false)}
              aria-hidden
            />
          ) : null}
        </div>

        {local.kind === 'image' ? (
          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="frens-muted flex justify-between mb-1">
                <span>Zoom</span>
                <span className="text-black dark:text-white">{t.scale.toFixed(2)}×</span>
              </span>
              <input
                type="range"
                min={0.5}
                max={3.5}
                step={0.05}
                value={t.scale}
                onChange={(e) => patchT({ scale: Number(e.target.value) })}
                className="w-full"
              />
            </label>

            <label className="block">
              <span className="frens-muted flex justify-between mb-1">
                <span>Rotate</span>
                <span className="text-black dark:text-white">{Math.round(t.rotate)}°</span>
              </span>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={t.rotate}
                onChange={(e) => patchT({ rotate: Number(e.target.value) })}
                className="w-full"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => patchT({ rotate: deg })}
                  className={`px-2.5 py-1.5 rounded-full border text-[11px] transition ${
                    Math.round(t.rotate) === deg
                      ? 'border-transparent bg-black text-white dark:bg-white dark:text-black'
                      : 'border-black/20 dark:border-white/30 text-black dark:text-white'
                  }`}
                >
                  {deg}°
                </button>
              ))}
              <button
                type="button"
                onClick={() => patchT({ ...DEFAULT_IMAGE_TRANSFORM })}
                className="px-2.5 py-1.5 rounded-full border border-black/20 dark:border-white/30 text-[11px] text-black dark:text-white ml-auto"
              >
                Reset
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs frens-muted text-center">
            PDF prints as-is — replace with a JPG to crop and zoom.
          </p>
        )}

        <div className="space-y-2 pt-2 border-t frens-border">
          <div className="flex flex-wrap gap-2">
            {onReplace ? (
              <button type="button" onClick={onReplace} className={btnGhost}>
                Replace
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Remove this image from the panel?')) onDelete()
                }}
                className={btnDanger}
              >
                Delete image
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancel
            </button>
            <button type="button" onClick={() => onSave?.(local)} className={btnPrimary}>
              Done
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
