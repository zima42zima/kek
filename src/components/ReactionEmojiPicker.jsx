import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlusIcon } from './icons/UiIcons'

/** Common phone-style reaction set — native emojis, no heavy picker. */
export const QUICK_REACTION_EMOJIS = [
  '❤️', '😂', '😭', '🔥', '👍', '👎', '😮', '😢',
  '😍', '🥰', '😊', '🙏', '👏', '💯', '✨', '👀',
  '💀', '🫠', '🤔', '😎', '🥳', '😤', '🤝', '💪',
  '🐸', '🦇', '🕳️', '💬', '✉️', '🌙', '⭐', '🎵',
  '✅', '❌', '⚠️', '🎉', '🫂', '🫶', '😉', '🫡',
]

/**
 * + control for message actions.
 * Opens a popover with optional Reply + emoji reaction grid.
 */
export default function ReactionEmojiPicker({
  onPick,
  onReply = null,
  align = 'left',
  direction = 'up',
  className = '',
  label = null,
}) {
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState(null)
  const wrapRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function place() {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = 280
      const pad = 8
      let left = align === 'right' ? r.right - width : r.left
      left = Math.max(pad, Math.min(left, window.innerWidth - width - pad))
      const openUp = direction === 'up'
      setPanelPos({
        left,
        top: openUp ? undefined : r.bottom + 6,
        bottom: openUp ? window.innerHeight - r.top + 6 : undefined,
        width,
      })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align, direction])

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (wrapRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onEsc(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function pick(emoji) {
    onPick?.(emoji)
    setOpen(false)
  }

  function handleReply() {
    onReply?.()
    setOpen(false)
  }

  const panel = open && panelPos && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Message actions"
          className="fixed z-[200] frens-surface border frens-border rounded-2xl shadow-xl p-2.5"
          style={{
            left: panelPos.left,
            top: panelPos.top,
            bottom: panelPos.bottom,
            width: panelPos.width,
          }}
        >
          {onReply ? (
            <button
              type="button"
              onClick={handleReply}
              className="w-full text-left text-sm px-2.5 py-2 mb-2 rounded-xl border frens-border hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition font-medium"
            >
              Reply
            </button>
          ) : null}
          <p className="text-[10px] frens-muted uppercase tracking-wide px-1 mb-1.5">
            {onReply ? 'React' : 'React'}
          </p>
          <div className="grid grid-cols-8 gap-0.5">
            {QUICK_REACTION_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => pick(em)}
                className="text-xl leading-none w-8 h-8 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition flex items-center justify-center"
                title={em}
              >
                {em}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label={onReply ? 'Reply or react' : 'Add reaction'}
        aria-expanded={open}
        className={
          className
          || 'frens-muted w-4 h-4 rounded-full border frens-border flex items-center justify-center opacity-55 hover:opacity-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition shrink-0'
        }
      >
        {label ?? <PlusIcon className="w-2.5 h-2.5" />}
      </button>
      {panel}
    </div>
  )
}
