import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
      const menuH = menu?.offsetHeight ?? 200
      const menuW = menu?.offsetWidth ?? rect.width
      const gap = 6
      const spaceBelow = window.innerHeight - rect.bottom
      const openDown = spaceBelow >= Math.min(menuH, 240) + gap || spaceBelow >= rect.top

      let top
      if (openDown) top = rect.bottom + gap
      else top = Math.max(gap, rect.top - Math.min(menuH, 240) - gap)

      let left = rect.left
      left = Math.max(gap, Math.min(left, window.innerWidth - menuW - gap))

      setStyle({ top, left, width: rect.width })
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

/** App-styled select — avoids native OS dropdown chrome. */
export default function FrensSelect({
  value,
  onChange,
  options,
  disabled = false,
  ariaLabel,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const menuStyle = useMenuPosition(open, rootRef, menuRef)

  const selected = options.find((opt) => opt.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return undefined

    function onPointerDown(e) {
      if (rootRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function pick(next) {
    onChange?.(next)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || selected?.label}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="frens-input py-1.5 px-2 text-xs w-full mt-0.5 disabled:opacity-50 flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{selected?.label ?? 'Choose…'}</span>
        <span className="frens-muted text-[10px] shrink-0" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={ariaLabel}
              className="fixed frens-surface border frens-border rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto frens-cave-scroll"
              style={{ ...menuStyle, zIndex: MENU_Z }}
            >
              {options.map((opt) => {
                const active = opt.value === value
                return (
                  <button
                    key={opt.value || '__empty__'}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(opt.value)}
                    className={`w-full text-left text-xs px-3 py-2 transition flex items-center gap-2 ${
                      active
                        ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                        : 'hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="w-3 shrink-0 text-[10px]" aria-hidden>{active ? '✓' : ''}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
