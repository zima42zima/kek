import { useEffect } from 'react'

/** In-app confirm — Misao surface, not the browser alert. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="frens-confirm-title"
        aria-describedby={message ? 'frens-confirm-desc' : undefined}
        className="frens-surface border frens-border rounded-2xl p-5 w-full max-w-xs"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="frens-confirm-title" className="frens-title-lg mb-2">
          {title}
        </h2>
        {message ? (
          <p id="frens-confirm-desc" className="text-sm frens-muted mb-5 leading-snug">
            {message}
          </p>
        ) : (
          <div className="mb-5" />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="frens-btn-outline flex-1 py-2.5 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="frens-btn-outline flex-1 py-2.5 text-sm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
