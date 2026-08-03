import { useEffect } from 'react'

export default function Modal({ title, onClose, children, maxWidth = 'max-w-md', panelClassName = '' }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={`frens-surface border frens-border rounded-2xl p-6 w-full ${maxWidth} max-h-[88vh] overflow-y-auto ${panelClassName}`}
      >
        {(title || onClose) && (
          <div className={`flex items-center justify-between shrink-0 ${title ? 'mb-3' : 'mb-0'}`}>
            {title ? <h2 className="frens-title-lg">{title}</h2> : <span />}
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Close" className="frens-muted text-xl leading-none ml-auto">
                ×
              </button>
            )}
          </div>
        )}
        <div className="letter-modal-body min-h-0 flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}
