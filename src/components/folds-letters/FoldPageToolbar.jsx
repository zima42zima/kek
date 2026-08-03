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

function CursorAnywhereIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <path d="M3.5 2.5v9M2.5 3.5h2" strokeLinecap="round" />
      <circle cx="11" cy="11" r="2.5" strokeDasharray="1.5 1.5" />
    </svg>
  )
}

/** Freeform fold canvas tools. Use bare when nested in unified top bar. */
export default function FoldPageToolbar({
  typeAnywhere,
  onTypeAnywhereChange,
  onAddText,
  onAddImage,
  bare = false,
}) {
  const tools = (
    <>
      <ToolBtn title="Add text block" onClick={onAddText}>
        <TextIcon />
      </ToolBtn>
      <ToolBtn title="Add photo" onClick={onAddImage}>
        <ImageIcon />
      </ToolBtn>
      <span className="letter-tool-divider" aria-hidden />
      <ToolBtn
        title="Type anywhere — click the page to place text"
        active={typeAnywhere}
        onClick={() => onTypeAnywhereChange?.(!typeAnywhere)}
      >
        <CursorAnywhereIcon />
      </ToolBtn>
    </>
  )

  if (bare) {
    return (
      <div className="letter-studio-toolbar-group" role="group" aria-label="Fold tools">
        {tools}
      </div>
    )
  }

  return (
    <div className="letter-studio-toolbar letter-studio-toolbar--page" role="toolbar" aria-label="Fold tools">
      {tools}
    </div>
  )
}
