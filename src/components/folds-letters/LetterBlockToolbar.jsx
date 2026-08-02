import { useEffect, useRef, useState } from 'react'
import {
  owlFontMeta,
  ensureOwlLetterFonts,
} from '../../lib/owlLetterFonts'
import LetterFontMenu from './LetterFontMenu'
import {
  LETTER_ALIGN,
  LETTER_LAYOUTS,
  LETTER_SIZE_STEPS,
  LETTER_TEXT_ROLES,
  roleForBlock,
} from '../../lib/letterStudio'

function ToolBtn({ active, disabled, title, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
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

function AlignIcon({ align }) {
  const bars = align === 'center'
    ? [10, 7, 9]
    : align === 'right'
      ? [10, 7, 9]
      : [10, 7, 9]
  const x = align === 'center' ? 3 : align === 'right' ? 4 : 2
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
      {bars.map((w, i) => (
        <rect
          key={i}
          x={align === 'center' ? (16 - w) / 2 : align === 'right' ? 16 - w - 2 : 2}
          y={3 + i * 4}
          width={w}
          height="1.2"
          rx="0.3"
        />
      ))}
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

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <rect x="5" y="5" width="8" height="8" rx="1" />
      <path d="M4 11H3.5A1.5 1.5 0 0 1 2 9.5v-7A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5V3" strokeLinecap="round" />
    </svg>
  )
}

function DropdownMenu({ children, className = '' }) {
  return <div className={`letter-tool-menu ${className}`}>{children}</div>
}

export default function LetterBlockToolbar({
  block,
  hasSelection,
  onPatch,
  onFontChange,
  onDuplicate,
  onDelete,
  bare = false,
}) {
  const rootRef = useRef(null)
  const [menu, setMenu] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    ensureOwlLetterFonts()
  }, [])

  useEffect(() => {
    setConfirmDelete(false)
    setMenu(null)
  }, [block?.id])

  useEffect(() => {
    if (!menu && !confirmDelete) return
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) {
        setMenu(null)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menu, confirmDelete])

  if (!block || block.kind === 'date') return null

  const roleId = roleForBlock(block)
  const roleLabel = LETTER_TEXT_ROLES[roleId]?.label || 'Body'
  const fontLabel = owlFontMeta(block.font).label
  const scopeHint = hasSelection ? '' : ' — applies to new text'

  const tools = (
    <>
      <ToolBtn
        title={`Text style${scopeHint}`}
        active={menu === 'role'}
        onClick={() => setMenu((m) => (m === 'role' ? null : 'role'))}
        className="letter-tool--wide"
      >
        <span className="letter-tool__label">{roleLabel}</span>
        <ChevronDownIcon />
      </ToolBtn>

      <ToolBtn
        title="Size"
        active={menu === 'size'}
        onClick={() => setMenu((m) => (m === 'size' ? null : 'size'))}
      >
        <span className="letter-tool__size">{block.fontSize}</span>
        <ChevronDownIcon />
      </ToolBtn>

      <span className="letter-tool-divider" aria-hidden />

      <ToolBtn title="Bold" active={block.bold} onClick={() => onPatch?.({ bold: !block.bold })}>
        <span className="letter-tool__glyph letter-tool__glyph--bold">B</span>
      </ToolBtn>
      <ToolBtn title="Italic" active={block.italic} onClick={() => onPatch?.({ italic: !block.italic })}>
        <span className="letter-tool__glyph letter-tool__glyph--italic">I</span>
      </ToolBtn>
      <ToolBtn title="Underline" active={block.underline} onClick={() => onPatch?.({ underline: !block.underline })}>
        <span className="letter-tool__glyph letter-tool__glyph--underline">U</span>
      </ToolBtn>

      <span className="letter-tool-divider" aria-hidden />

      <ToolBtn
        title="Alignment"
        active={menu === 'align'}
        onClick={() => setMenu((m) => (m === 'align' ? null : 'align'))}
      >
        <AlignIcon align={block.align || 'left'} />
        <ChevronDownIcon />
      </ToolBtn>

      <ToolBtn
        title="Layout"
        active={menu === 'layout'}
        onClick={() => setMenu((m) => (m === 'layout' ? null : 'layout'))}
      >
        <span className="letter-tool__label letter-tool__label--short">
          {LETTER_LAYOUTS[block.layout]?.label?.split(' ')[0] || 'Body'}
        </span>
        <ChevronDownIcon />
      </ToolBtn>

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

      <ToolBtn title="Duplicate" disabled={!hasSelection} onClick={onDuplicate}>
        <CopyIcon />
      </ToolBtn>

      <div className="relative">
        <ToolBtn
          title={confirmDelete ? 'Confirm delete' : 'Delete'}
          active={confirmDelete}
          disabled={!hasSelection}
          onClick={() => {
            if (!hasSelection) return
            if (confirmDelete) onDelete?.()
            else setConfirmDelete(true)
          }}
        >
          <TrashIcon />
        </ToolBtn>
        {confirmDelete && (
          <span className="letter-tool-confirm">Delete?</span>
        )}
      </div>

      {menu === 'role' && (
        <DropdownMenu>
          {Object.entries(LETTER_TEXT_ROLES).map(([id, role]) => (
            <button
              key={id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className={`letter-tool-menu__item letter-tool-menu__item--row ${roleId === id ? 'letter-tool-menu__item--active' : ''}`}
              onClick={() => { onPatch?.({ role: id, fontSize: role.fontSize, bold: role.bold, w: role.w, layout: role.layout, align: role.align, lineHeight: LETTER_LAYOUTS[role.layout]?.lineHeight }); setMenu(null) }}
            >
              {role.label}
            </button>
          ))}
        </DropdownMenu>
      )}

      {menu === 'size' && (
        <DropdownMenu>
          {LETTER_SIZE_STEPS.map((px) => (
            <button
              key={px}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className={`letter-tool-menu__item letter-tool-menu__item--row ${block.fontSize === px ? 'letter-tool-menu__item--active' : ''}`}
              onClick={() => { onPatch?.({ fontSize: px }); setMenu(null) }}
            >
              {px}px
            </button>
          ))}
        </DropdownMenu>
      )}

      {menu === 'align' && (
        <DropdownMenu>
          {Object.entries(LETTER_ALIGN).map(([id, meta]) => (
            <button
              key={id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className={`letter-tool-menu__item letter-tool-menu__item--row flex items-center gap-2 ${block.align === id ? 'letter-tool-menu__item--active' : ''}`}
              onClick={() => { onPatch?.({ align: id }); setMenu(null) }}
            >
              <AlignIcon align={id} />
              {meta.label}
            </button>
          ))}
        </DropdownMenu>
      )}

      {menu === 'layout' && (
        <DropdownMenu>
          {Object.entries(LETTER_LAYOUTS).map(([id, meta]) => (
            <button
              key={id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className={`letter-tool-menu__item letter-tool-menu__item--row ${block.layout === id ? 'letter-tool-menu__item--active' : ''}`}
              onClick={() => { onPatch?.({ layout: id, w: meta.w, lineHeight: meta.lineHeight }); setMenu(null) }}
            >
              {meta.label}
            </button>
          ))}
        </DropdownMenu>
      )}

      {menu === 'font' && (
        <LetterFontMenu
          activeId={block.font}
          sampleText={block.text}
          onPick={(id) => { onFontChange?.(id); setMenu(null) }}
        />
      )}
    </>
  )

  return (
    <div
      ref={rootRef}
      className={bare
        ? 'letter-studio-toolbar-group relative'
        : 'letter-studio-toolbar letter-studio-toolbar--block'}
      role={bare ? 'group' : 'toolbar'}
      aria-label="Text formatting"
    >
      {tools}
    </div>
  )
}
