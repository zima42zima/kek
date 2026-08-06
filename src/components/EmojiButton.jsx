import { lazy, Suspense, useEffect, useRef, useState, Component } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../context/ThemeContext'

// Lazy-loaded so the emoji dataset lands in its own chunk, not the main bundle.
// Normalize CJS/ESM default export so React.lazy always gets a component.
const EmojiPicker = lazy(async () => {
  const mod = await import('emoji-picker-react')
  let Comp = mod.default
  // CJS interop / dual package: default may nest again
  if (Comp && typeof Comp === 'object' && Comp.default && (typeof Comp.default === 'function' || Comp.default.$$typeof)) {
    Comp = Comp.default
  }
  if (!Comp || (typeof Comp !== 'function' && !Comp.$$typeof)) {
    throw new Error('Emoji picker module did not export a component')
  }
  return { default: Comp }
})

const MY_EMOJI_KEY = 'frens-my-emojis'

function loadMyEmojis() {
  try {
    const raw = localStorage.getItem(MY_EMOJI_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// Split a pasted string into individual emoji graphemes (handles multi-codepoint
// emoji like 👨‍👩‍👧 via Intl.Segmenter, falling back to a plain spread).
function splitEmojis(str) {
  const text = (str || '').trim()
  if (!text) return []
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      return [...seg.segment(text)].map((s) => s.segment).filter((c) => c.trim())
    }
  } catch { /* fall through */ }
  return [...text].filter((c) => c.trim())
}

/** Catch picker load/render failures so the whole cave page does not white-screen. */
class PickerErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-xs frens-muted text-center">
          Could not load emoji picker.
          <button
            type="button"
            className="block mx-auto mt-2 underline"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function EmojiButton({ onPick, label = '😊', align = 'left', direction = 'down', className }) {
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  const [mine, setMine] = useState(loadMyEmojis)
  const [entry, setEntry] = useState('')
  const [panelPos, setPanelPos] = useState(null)
  const wrapRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function place() {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = 300
      const pad = 8
      let left = align === 'right' ? r.right - width : r.left
      left = Math.max(pad, Math.min(left, window.innerWidth - width - pad))
      const openUp = direction === 'up'
      const top = openUp ? undefined : r.bottom + 8
      const bottom = openUp ? window.innerHeight - r.top + 8 : undefined
      setPanelPos({ left, top, bottom, width })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align, direction])

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (wrapRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onEsc(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function saveMine(next) {
    setMine(next)
    try {
      localStorage.setItem(MY_EMOJI_KEY, JSON.stringify(next))
    } catch {
      // ignore quota errors — the set is tiny anyway
    }
  }

  function addMine() {
    const parts = splitEmojis(entry)
    if (!parts.length) return
    saveMine([...new Set([...mine, ...parts])].slice(0, 40))
    setEntry('')
  }

  function pick(emoji) {
    if (!emoji) return
    try {
      onPick?.(emoji)
    } catch (err) {
      console.error('Emoji pick failed:', err)
    }
    setOpen(false)
  }

  const panel = open && panelPos && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[1300] frens-surface border frens-border rounded-2xl shadow-xl overflow-hidden"
          style={{
            left: panelPos.left,
            top: panelPos.top,
            bottom: panelPos.bottom,
            width: panelPos.width,
          }}
        >
          {/* Personal collection */}
          <div className="p-3 border-b frens-border">
            <p className="frens-label mb-2">My emojis</p>
            {mine.length > 0 ? (
              <div className="flex flex-wrap gap-1 mb-2">
                {mine.map((e) => (
                  <span key={e} className="relative group/emoji">
                    <button
                      type="button"
                      onClick={() => pick(e)}
                      className="text-lg leading-none px-1.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
                    >
                      {e}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveMine(mine.filter((x) => x !== e))}
                      aria-label="Remove emoji"
                      className="absolute -top-1 -right-1 hidden group-hover/emoji:flex w-4 h-4 rounded-full bg-black/70 text-white text-[9px] items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs frens-hint mb-2">Paste emojis below to save your own set.</p>
            )}
            <div className="flex gap-2">
              <input
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addMine()
                  }
                }}
                placeholder="Paste emojis…"
                className="frens-input text-sm flex-1"
              />
              <button
                type="button"
                onClick={addMine}
                disabled={!entry.trim()}
                className="frens-btn-primary px-3 text-xs disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>

          <PickerErrorBoundary>
            <Suspense
              fallback={
                <div className="p-4 text-xs frens-muted">Loading emojis…</div>
              }
            >
              <EmojiPicker
                theme={theme === 'dark' ? 'dark' : 'light'}
                onEmojiClick={(data) => {
                  pick(data?.emoji)
                }}
                width={300}
                height={320}
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
                searchPlaceHolder="Search emoji…"
              />
            </Suspense>
          </PickerErrorBoundary>
        </div>,
        document.body,
      )
    : null

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-label="Add emoji"
        aria-expanded={open}
        className={className ?? 'frens-action text-base leading-none'}
      >
        {label}
      </button>
      {panel}
    </div>
  )
}
