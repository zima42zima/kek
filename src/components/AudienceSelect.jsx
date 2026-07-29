import { useEffect, useRef, useState } from 'react'
import { AUDIENCE_OPTIONS } from '../context/PostsContext'
import AudienceIcon from './AudienceIcon'

export default function AudienceSelect({
  value,
  onChange,
  tagInput,
  onTagInputChange,
  compact = false,
  showTagInput = true,
  showLabel = false,
}) {
  const active = AUDIENCE_OPTIONS.find((o) => o.id === value) ?? AUDIENCE_OPTIONS[0]
  const [open, setOpen] = useState(false)
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

  return (
    <div className={compact ? 'min-w-0' : 'space-y-2'}>
      <div className={`flex items-center gap-2 ${compact ? 'min-w-0' : ''}`}>
        <div ref={wrapRef} className="relative min-w-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={active.label}
            title={active.label}
            className={`inline-flex items-center gap-1 shrink-0 max-w-full ${
              compact
                ? 'frens-action py-1 px-2 rounded-full border frens-border'
                : 'frens-input py-1.5 px-2 text-xs w-auto'
            }`}
          >
            <AudienceIcon id={active.id} className="w-3.5 h-3.5 shrink-0" />
            {showLabel ? (
              <span className="text-xs truncate max-w-[7rem]">{active.label}</span>
            ) : null}
            <span className="frens-muted text-[10px]" aria-hidden>▾</span>
          </button>

          {open && (
            <div
              role="listbox"
              aria-label="Audience"
              className="absolute z-40 top-full mt-1 right-0 frens-surface border frens-border rounded-xl p-1 shadow-lg flex flex-col gap-0.5"
            >
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={opt.id === value}
                  aria-label={opt.label}
                  title={opt.label}
                  onClick={() => {
                    onChange(opt.id)
                    setOpen(false)
                  }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-black/5 dark:hover:bg-white/10 ${
                    opt.id === value ? 'bg-black/5 dark:bg-white/10' : ''
                  }`}
                >
                  <AudienceIcon id={opt.id} className="w-4 h-4 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showTagInput && value === 'other' && (
        <input
          type="text"
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          placeholder="tag frens by name, comma separated (e.g. mossy_toad, lily)"
          className={`frens-input text-xs ${compact ? 'mt-2 py-1.5' : 'py-2'}`}
        />
      )}
    </div>
  )
}
