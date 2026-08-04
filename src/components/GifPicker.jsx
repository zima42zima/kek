import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { giphyEnabled, searchGifs, trendingGifs, GIF_PICKER_LIMIT } from '../lib/gif'

const PICKER_WIDTH = 320

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function PickerPanel({
  wrapRef,
  className,
  style,
  children,
}) {
  return (
    <div
      ref={wrapRef}
      style={style}
      className={className}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

export default function GifPicker({
  onPick,
  onClose,
  align = 'left',
  direction = 'down',
  anchorRef,
}) {
  const enabled = giphyEnabled()
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [coords, setCoords] = useState(null)
  const wrapRef = useRef(null)

  function updatePosition() {
    if (!anchorRef?.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const estHeight = wrapRef.current?.offsetHeight || 420
    let top = direction === 'up' ? rect.top - estHeight - 8 : rect.bottom + 8
    let left = align === 'right' ? rect.right - PICKER_WIDTH : rect.left
    top = clamp(top, 8, window.innerHeight - estHeight - 8)
    left = clamp(left, 8, window.innerWidth - PICKER_WIDTH - 8)
    setCoords({ top, left })
  }

  useLayoutEffect(() => {
    if (!anchorRef) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, align, direction, gifs.length, loading, error])

  useEffect(() => {
    let removeListener = () => {}
    const timer = window.setTimeout(() => {
      function onDocPointer(e) {
        if (e.target.closest?.('[data-gif-trigger]')) return
        if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose?.()
      }
      function onEsc(e) {
        if (e.key === 'Escape') onClose?.()
      }
      document.addEventListener('pointerdown', onDocPointer)
      document.addEventListener('keydown', onEsc)
      removeListener = () => {
        document.removeEventListener('pointerdown', onDocPointer)
        document.removeEventListener('keydown', onEsc)
      }
    }, 0)
    return () => {
      window.clearTimeout(timer)
      removeListener()
    }
  }, [onClose])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError('')
    const t = window.setTimeout(async () => {
      try {
        const results = query.trim()
          ? await searchGifs(query, GIF_PICKER_LIMIT)
          : await trendingGifs(GIF_PICKER_LIMIT)
        if (!cancelled) setGifs(results)
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load GIFs.')
          setGifs([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, query.trim() ? 350 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query, enabled])

  const panelClass =
    'frens-surface border frens-border rounded-2xl p-3 shadow-xl w-80'

  const content = enabled ? (
    <>
      <div className="flex items-center gap-2 mb-3 border-b frens-border pb-2">
        <span className="text-sm frens-muted pointer-events-none">🔍</span>
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs…"
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-400 dark:placeholder-gray-600"
        />
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{error}</p>}
      <div className="max-h-[15.5rem] overflow-y-auto -mr-1 pr-1">
        <div className="grid grid-cols-2 gap-2">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse"
              />
            ))}
          {!loading && gifs.length === 0 && (
            <p className="col-span-2 text-xs frens-muted text-center py-8">
              {query.trim() ? 'No GIFs found — try another word.' : 'No GIFs right now.'}
            </p>
          )}
          {!loading &&
            gifs.map((g) => (
              <button
                key={g.id}
                type="button"
                title={g.title}
                onClick={() => {
                  onPick?.(g.full)
                  onClose?.()
                }}
                className="group relative h-28 rounded-xl overflow-hidden focus:outline-none"
              >
                <img
                  src={g.preview}
                  alt={g.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  Add
                </span>
              </button>
            ))}
        </div>
      </div>
      {!loading && gifs.length > 4 && (
        <p className="text-[10px] frens-hint mt-1.5 text-center">Scroll for more</p>
      )}
      <p className="text-[10px] frens-hint mt-2 text-center">Powered by GIPHY</p>
    </>
  ) : (
    <p className="text-xs frens-muted text-center py-6">
      GIF search is unavailable right now. Check the GIPHY server key and try again.
    </p>
  )

  if (anchorRef) {
    return createPortal(
      <PickerPanel
        wrapRef={wrapRef}
        className={panelClass}
        style={{
          position: 'fixed',
          top: coords?.top ?? -9999,
          left: coords?.left ?? -9999,
          width: PICKER_WIDTH,
          zIndex: 1300,
        }}
      >
        {content}
      </PickerPanel>,
      document.body,
    )
  }

  return (
    <PickerPanel
      wrapRef={wrapRef}
      className={`absolute z-50 ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} ${align === 'right' ? 'right-0' : 'left-0'} ${panelClass}`}
    >
      {content}
    </PickerPanel>
  )
}
