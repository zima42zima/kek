import { useEffect, useRef, useState } from 'react'
import {
  owlFontMeta,
  preloadOwlFont,
  ensureOwlLetterFonts,
} from '../../lib/owlLetterFonts'
import LetterFontMenu from '../folds-letters/LetterFontMenu'

function previewSnippet(text, max = 72) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return 'Dear friend,'
  return raw.length <= max ? raw : `${raw.slice(0, max - 1)}…`
}

export default function OwlFontPicker({ value, onChange, previewText = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const sample = previewSnippet(previewText)

  useEffect(() => {
    ensureOwlLetterFonts()
  }, [])

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function pick(id) {
    onChange(id)
    preloadOwlFont(id)
    setOpen(false)
  }

  const active = owlFontMeta(value)

  return (
    <div ref={rootRef} className="relative">
      <label className="owl-field-label">Typeface</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="owl-field flex items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="font-medium">{active.label}</span>
          <span className="text-black/50 text-xs ml-2">{active.hint}</span>
        </span>
        <span className="text-black/40 text-xs shrink-0">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 border border-black bg-white shadow-[4px_4px_0_#000] overflow-hidden">
          <LetterFontMenu
            variant="panel"
            activeId={value}
            sampleText={sample}
            onPick={pick}
          />
        </div>
      )}
    </div>
  )
}
