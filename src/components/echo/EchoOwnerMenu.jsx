import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreIcon } from '../icons/UiIcons'

const MENU_Z = 1200

function useMenuPosition(open, anchorRef, menuRef) {
  const [style, setStyle] = useState(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setStyle(null)
      return undefined
    }

    function update() {
      const anchor = anchorRef.current
      const menu = menuRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const menuH = menu?.offsetHeight ?? 132
      const menuW = menu?.offsetWidth ?? 168
      const gap = 6
      const spaceBelow = window.innerHeight - rect.bottom
      const openDown = spaceBelow >= menuH + gap || spaceBelow >= rect.top

      let top
      if (openDown) top = rect.bottom + gap
      else top = Math.max(gap, rect.top - menuH - gap)

      let left = rect.right - menuW
      left = Math.max(gap, Math.min(left, window.innerWidth - menuW - gap))

      setStyle({ top, left })
    }

    update()
    requestAnimationFrame(update)

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef, menuRef])

  return style
}

export default function EchoOwnerMenu({ mine, saved, onView, onShowOnMap, onEdit, onDelete, onUnsave }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const menuStyle = useMenuPosition(open, rootRef, menuRef)

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(e) {
      const root = rootRef.current
      const menu = menuRef.current
      if (root?.contains(e.target) || menu?.contains(e.target)) return
      setOpen(false)
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

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      style={{
        top: menuStyle?.top ?? -9999,
        left: menuStyle?.left ?? -9999,
        zIndex: MENU_Z,
        visibility: menuStyle ? 'visible' : 'hidden',
      }}
      className="fixed min-w-[10.5rem] frens-surface border frens-border rounded-lg shadow-lg py-1"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => { close(); onView?.() }}
        className="flex w-full items-center gap-2 text-left text-xs px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
      >
        View full echo
      </button>
      {onShowOnMap ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { close(); onShowOnMap?.() }}
          className="flex w-full items-center gap-2 text-left text-xs px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Show on map
        </button>
      ) : null}
      {saved && !mine && onUnsave ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { close(); onUnsave?.() }}
          className="flex w-full items-center gap-2 text-left text-xs px-3 py-2 text-red-600 dark:text-red-400 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Remove from collection
        </button>
      ) : null}
      {mine ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { close(); onEdit?.() }}
          className="flex w-full items-center gap-2 text-left text-xs px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Edit audience & range…
        </button>
      ) : null}
      {mine ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { close(); onDelete?.() }}
          className="flex w-full items-center gap-2 text-left text-xs px-3 py-2 text-red-600 dark:text-red-400 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Delete echo
        </button>
      ) : null}
    </div>
  ) : null

  return (
    <>
      <div ref={rootRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Echo options"
          aria-expanded={open}
          aria-haspopup="menu"
          className="w-8 h-8 rounded-full flex items-center justify-center frens-action hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <MoreIcon className="w-4 h-4" />
        </button>
      </div>
      {menu ? createPortal(menu, document.body) : null}
    </>
  )
}
