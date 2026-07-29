import { useEffect, useRef, useState } from 'react'

export default function CreateCaveModal({ onCreate, onClose }) {
  const [name, setName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate?.(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="frens-surface border frens-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="frens-title-xl mb-1">Create a cave</h2>
        <p className="text-xs frens-muted mb-5">
          A cozy little room for you and your frens.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cave-name" className="block frens-label mb-2">
              Cave name
            </label>
            <input
              ref={inputRef}
              id="cave-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="the lily pad lounge"
              maxLength={40}
              className="frens-input py-3"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="frens-btn-outline px-4 py-2.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="frens-btn-primary px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Cave
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
