import { useEffect, useRef, useState } from 'react'

function ToolBtn({ active, title, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`letter-tool ${active ? 'letter-tool--active' : ''} ${className}`}
    >
      {children}
    </button>
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

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <path d="M8 1.5l1 4.5 4.5 1-4.5 1-1 4.5-1-4.5L2.5 7 7 5.5 8 1.5z" strokeLinejoin="round" />
    </svg>
  )
}

function TemplateMenu({ onPick, onClose }) {
  const items = [
    ['general', 'General letter'],
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onPick(id); onClose() }}
          className="letter-tool-menu__item letter-tool-menu__item--row"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Letter page tools — photo + templates only. */
export default function LetterPageToolbar({ onAddImage, onTemplate }) {
  const rootRef = useRef(null)
  const [menu, setMenu] = useState(null)

  useEffect(() => {
    if (!menu) return
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setMenu(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menu])

  return (
    <div ref={rootRef} className="letter-studio-toolbar letter-studio-toolbar--page" role="toolbar" aria-label="Page tools">
      <ToolBtn title="Add photo" onClick={onAddImage}>
        <ImageIcon />
      </ToolBtn>
      <span className="letter-tool-divider" aria-hidden />
      <ToolBtn
        title="Start from template"
        active={menu === 'template'}
        onClick={() => setMenu((m) => (m === 'template' ? null : 'template'))}
      >
        <SparkIcon />
      </ToolBtn>
      {menu === 'template' && (
        <TemplateMenu onPick={onTemplate} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
