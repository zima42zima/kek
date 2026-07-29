import { useEffect, useRef, useState } from 'react'
import {
  PlusIcon,
  POST_ACTION_BTN,
  POST_ACTION_ICON,
  POST_ACTION_REACTION_ICON,
  POST_ACTION_BADGE,
  POST_ACTION_PICKER_BTN,
  POST_ACTION_PICKER_ICON,
} from './icons/UiIcons'
import PostActionTip from './PostActionTip'
import { POST_REACTION_DEFS, reactionCount, reactionMine } from '../lib/postReactions'

export default function PostReactionButton({
  reactions = [],
  onReact,
  disabled = false,
  className = '',
  label = 'React',
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const visible = POST_REACTION_DEFS.filter((def) => reactionCount(reactions, def.id) > 0)
  const canReact = Boolean(onReact) && !disabled

  if (!canReact && visible.length === 0) return null

  function pick(id) {
    if (!canReact) return
    onReact(id)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`relative z-10 flex items-center gap-1 ${className}`}>
      {visible.map(({ id, icon }) => {
        const count = reactionCount(reactions, id)
        const mine = reactionMine(reactions, id)
        return (
          <button
            key={id}
            type="button"
            onClick={(e) => { e.stopPropagation(); pick(id) }}
            disabled={!canReact}
            aria-pressed={mine}
            className={`${POST_ACTION_BTN} ${
              mine ? 'ring-1 ring-black/20 dark:ring-white/30 bg-black/[0.04] dark:bg-white/[0.06]' : 'opacity-80 hover:opacity-100'
            } ${!canReact ? 'pointer-events-none' : ''}`}
          >
            <img src={icon} alt="" className={`${POST_ACTION_REACTION_ICON} object-contain dark:invert`} draggable={false} />
            {count > 1 ? (
              <span className={POST_ACTION_BADGE}>
                {count}
              </span>
            ) : null}
          </button>
        )
      })}

      {canReact ? (
        <>
          <PostActionTip label="leave a reaction">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
              aria-expanded={open}
              aria-label={label}
              className={POST_ACTION_BTN}
            >
              <PlusIcon className={POST_ACTION_ICON} />
            </button>
          </PostActionTip>

          {open && (
            <div className="flex items-center gap-0.5">
              {POST_REACTION_DEFS.map(({ id, icon }) => {
                const mine = reactionMine(reactions, id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); pick(id) }}
                    aria-pressed={mine}
                    className={`${POST_ACTION_PICKER_BTN} ${
                      mine ? 'ring-1 ring-black/15 dark:ring-white/25' : ''
                    }`}
                  >
                    <img src={icon} alt="" className={POST_ACTION_PICKER_ICON} draggable={false} />
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
