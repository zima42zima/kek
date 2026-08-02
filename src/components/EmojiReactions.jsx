import EmojiButton from './EmojiButton'
import { PlusIcon } from './icons/UiIcons'

/**
 * Pill emoji reactions + small + picker — shared by cave chat, DMs, comments, etc.
 * Home feed posts keep PostReactionButton (fire/thunder icons).
 *
 * Layout: tiny + sits beside the message (side); existing reaction chips sit under.
 */
export default function EmojiReactions({
  reactions = [],
  mine = false,
  canReact = false,
  onReact,
  extra = null,
  className = '',
  /** When true, only the + / extra controls (parent places them beside the bubble). */
  controlsOnly = false,
  /** When true, only the reaction chips (parent places them under the bubble). */
  chipsOnly = false,
}) {
  const hasReactions = reactions.length > 0
  if (!canReact && !hasReactions && !extra) return null

  const chips = hasReactions ? (
    <div
      className={`flex flex-wrap items-center gap-0.5 ${mine ? 'justify-end' : 'justify-start'}`}
    >
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onReact?.(r.emoji)}
          disabled={!canReact}
          title={r.mine ? 'Remove your reaction' : 'Add this reaction'}
          className={`text-[11px] rounded-full px-1.5 py-0.5 border transition leading-none ${
            r.mine
              ? 'border-black/25 bg-black/[0.04] dark:border-white/30 dark:bg-white/10'
              : 'frens-border hover:bg-black/5 dark:hover:bg-white/10'
          } disabled:opacity-60`}
        >
          <span>{r.emoji}</span>
          {r.count > 1 ? <span className="ml-0.5 text-[10px] frens-muted">{r.count}</span> : null}
        </button>
      ))}
    </div>
  ) : null

  const controls = (canReact || extra) ? (
    <div className={`flex items-center gap-0.5 shrink-0 ${mine ? 'flex-row-reverse' : ''}`}>
      {canReact ? (
        <EmojiButton
          onPick={onReact}
          direction="up"
          align={mine ? 'right' : 'left'}
          label={<PlusIcon className="w-2.5 h-2.5" />}
          className="frens-muted w-4 h-4 rounded-full border frens-border flex items-center justify-center opacity-55 hover:opacity-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition shrink-0"
        />
      ) : null}
      {extra}
    </div>
  ) : null

  if (controlsOnly) return controls
  if (chipsOnly) {
    if (!chips) return null
    return <div className={`mt-0.5 ${className}`.trim()}>{chips}</div>
  }

  // Default: chips then controls in a row under the message (comments, etc.)
  return (
    <div
      className={`flex flex-wrap items-center gap-1 mt-0.5 ${mine ? 'justify-end' : 'justify-start'} ${className}`}
    >
      {chips}
      {controls}
    </div>
  )
}
