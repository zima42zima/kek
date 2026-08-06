import { useEffect, useRef, useState } from 'react'
import { MoreIcon, PinIcon } from './icons/UiIcons'
import ConfirmDialog from './ConfirmDialog'

export default function PostOwnerMenu({ isPinned, onPin, onUnpin, onDelete }) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function close() {
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Post options"
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-8 h-8 rounded-full flex items-center justify-center frens-action hover:bg-black/5 dark:hover:bg-white/10 transition"
      >
        <MoreIcon className="w-4 h-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[10.5rem] frens-surface border frens-border rounded-lg shadow-lg py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close()
              if (isPinned) onUnpin?.()
              else onPin?.()
            }}
            className="flex w-full items-center gap-2 text-left text-xs px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <PinIcon className="w-3.5 h-3.5 shrink-0" />
            {isPinned ? 'Unpin from profile' : 'Pin to profile'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close()
              setConfirmDelete(true)
            }}
            className="flex w-full items-center gap-2 text-left text-xs px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Delete post
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete post?"
        message="This can’t be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          onDelete?.()
        }}
      />
    </div>
  )
}
