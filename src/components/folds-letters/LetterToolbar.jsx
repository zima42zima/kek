import { useEffect, useRef, useState } from 'react'
import {
  owlFontMeta,
  ensureOwlLetterFonts,
  preloadOwlFont,
} from '../../lib/owlLetterFonts'
import { LETTER_SIZE_STEPS, LETTER_MAX_FONT_SIZE } from '../../lib/letterStudio'
import LetterFontMenu from './LetterFontMenu'

function ToolBtn({ active, disabled, title, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`letter-tool ${active ? 'letter-tool--active' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-2.5 h-2.5 opacity-50" aria-hidden>
      <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
      <path d="M3 3.5h10v1.2H9.2V12H6.8V4.7H3V3.5z" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.2" />
      <circle cx="5.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <path d="M2 11l3.5-3 2.5 2 2-1.5L14 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <rect x="5" y="5" width="8" height="8" rx="1" />
      <path d="M4 11H3.5A1.5 1.5 0 0 1 2 9.5v-7A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5V3" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <path d="M3 4.5h10M6 4.5V3h4v1.5M5.5 4.5l.5 8h4l.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CursorAnywhereIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <path d="M3.5 2.5v9M2.5 3.5h2" strokeLinecap="round" />
      <circle cx="11" cy="11" r="2.5" strokeDasharray="1.5 1.5" />
      <path d="M11 8.5V6.5M9.5 11h2" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <path d="M8 1.5l1 4.5 4.5 1-4.5 1-1 4.5-1-4.5L2.5 7 7 5.5 8 1.5z" strokeLinejoin="round" />
    </svg>
  )
}

function FontMenu({ value, onChange, previewText, onClose }) {
  return (
    <LetterFontMenu
      activeId={value}
      sampleText={previewText}
      onPick={(id) => { onChange(id); onClose() }}
    />
  )
}

function SizeMenu({ value, onChange, onClose }) {
  return (
    <div className="letter-tool-menu letter-tool-menu--sizes">
      {LETTER_SIZE_STEPS.map((px) => (
        <button
          key={px}
          type="button"
          onClick={() => { onChange(px); onClose() }}
          className={`letter-tool-menu__item letter-tool-menu__item--row ${value === px ? 'letter-tool-menu__item--active' : ''}`}
        >
          {px}px
        </button>
      ))}
      <p className="letter-tool-menu__meta">Max {LETTER_MAX_FONT_SIZE}px — one letter ≈ A4 wide</p>
    </div>
  )
}

function TemplateMenu({ onPick, onClose }) {
  const items = [
    ['general', 'General'],
    ['birthday', 'Birthday'],
    ['thankyou', 'Thank you'],
    ['casual', 'Thinking of you'],
  ]
  return (
    <div className="letter-tool-menu">
      {items.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => { onPick(id); onClose() }}
          className="letter-tool-menu__item letter-tool-menu__item--row"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function LetterToolbar({
  font,
  onFontChange,
  fontPreview,
  fontSize,
  onFontSizeChange,
  bold,
  onBoldToggle,
  hasSelection,
  onAddText,
  onAddImage,
  onDuplicate,
  onDelete,
  onTemplate,
  typeAnywhere,
  onTypeAnywhereChange,
}) {
  const rootRef = useRef(null)
  const [menu, setMenu] = useState(null)

  useEffect(() => {
    ensureOwlLetterFonts()
  }, [])

  useEffect(() => {
    if (!menu) return
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setMenu(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menu])

  const fontLabel = owlFontMeta(font).label

  return (
    <div ref={rootRef} className="letter-studio-toolbar" role="toolbar" aria-label="Letter formatting">
      <ToolBtn
        title="Typeface"
        active={menu === 'font'}
        onClick={() => setMenu((m) => (m === 'font' ? null : 'font'))}
        className="letter-tool--wide"
      >
        <span className="letter-tool__label">{fontLabel}</span>
        <ChevronDownIcon />
      </ToolBtn>

      <span className="letter-tool-divider" aria-hidden />

      <ToolBtn
        title="Size"
        active={menu === 'size'}
        onClick={() => setMenu((m) => (m === 'size' ? null : 'size'))}
      >
        <span className="letter-tool__size">{fontSize}px</span>
        <ChevronDownIcon />
      </ToolBtn>

      <span className="letter-tool-divider" aria-hidden />

      <ToolBtn
        title="Bold"
        active={bold}
        disabled={!hasSelection}
        onClick={onBoldToggle}
      >
        <span className="letter-tool__glyph letter-tool__glyph--bold">B</span>
      </ToolBtn>

      <span className="letter-tool-divider" aria-hidden />

      <ToolBtn title="Add text" onClick={onAddText}>
        <TextIcon />
      </ToolBtn>
      <ToolBtn title="Add image" onClick={onAddImage}>
        <ImageIcon />
      </ToolBtn>

      <span className="letter-tool-divider" aria-hidden />

      <ToolBtn
        title="Type anywhere — click the page to place text"
        active={typeAnywhere}
        onClick={() => onTypeAnywhereChange?.(!typeAnywhere)}
        className="letter-tool--wide"
      >
        <CursorAnywhereIcon />
        <span className="letter-tool__label letter-tool__label--short">Anywhere</span>
      </ToolBtn>

      {hasSelection && (
        <>
          <span className="letter-tool-divider" aria-hidden />
          <ToolBtn title="Duplicate" onClick={onDuplicate}>
            <CopyIcon />
          </ToolBtn>
          <ToolBtn title="Delete" onClick={onDelete}>
            <TrashIcon />
          </ToolBtn>
        </>
      )}

      <span className="letter-tool-divider" aria-hidden />

      <ToolBtn
        title="Templates"
        active={menu === 'template'}
        onClick={() => setMenu((m) => (m === 'template' ? null : 'template'))}
      >
        <SparkIcon />
      </ToolBtn>

      {menu === 'font' && (
        <FontMenu
          value={font}
          previewText={fontPreview}
          onChange={(id) => {
            onFontChange(id)
            preloadOwlFont(id)
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {menu === 'size' && (
        <SizeMenu
          value={fontSize}
          onChange={onFontSizeChange}
          onClose={() => setMenu(null)}
        />
      )}
      {menu === 'template' && (
        <TemplateMenu
          onPick={onTemplate}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

export { LETTER_SIZE_STEPS }
