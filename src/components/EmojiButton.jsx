import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'

// Lazy-loaded so the emoji dataset lands in its own chunk, not the main bundle.
const EmojiPicker = lazy(() => import('emoji-picker-react'))

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
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return [...seg.segment(text)].map((s) => s.segment).filter((c) => c.trim())
  } catch {
    return [...text].filter((c) => c.trim())
  }
}

export default function EmojiButton({ onPick, label = '😊', align = 'left', direction = 'down', className }) {
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  const [mine, setMine] = useState(loadMyEmojis)
  const [entry, setEntry] = useState('')
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
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

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Add emoji"
        className={className ?? 'frens-action text-base leading-none'}
      >
        {label}
      </button>
      {open && (
        <div
          className={`absolute z-50 ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} ${align === 'right' ? 'right-0' : 'left-0'} w-[300px] frens-surface border frens-border rounded-2xl shadow-xl overflow-hidden`}
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
                      onClick={() => onPick?.(e)}
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

          {/* Full searchable picker */}
          <Suspense
            fallback={
              <div className="p-4 text-xs frens-muted">Loading emojis…</div>
            }
          >
            <EmojiPicker
              theme={theme === 'dark' ? 'dark' : 'light'}
              onEmojiClick={(data) => {
                onPick?.(data.emoji)
                setOpen(false)
              }}
              width={300}
              height={320}
              lazyLoadEmojis
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
              searchPlaceHolder="Search emoji…"
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}
