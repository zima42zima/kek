import EmojiButton from './EmojiButton'
import { PlusIcon } from './icons/UiIcons'

/**
 * Pill emoji reactions + small + picker — shared by cave chat, DMs, comments, etc.
 * Home feed posts keep PostReactionButton (fire/thunder icons).
 */
export default function EmojiReactions({
  reactions = [],
  mine = false,
  canReact = false,
  onReact,
  extra = null,
  className = '',
}) {
  const hasReactions = reactions.length > 0
  if (!canReact && !hasReactions && !extra) return null

  return (
    <div className={`flex flex-wrap items-center gap-0.5 mt-0.5 ${mine ? 'justify-end' : 'justify-start'} ${className}`}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onReact?.(r.emoji)}
          disabled={!canReact}
          title={r.mine ? 'Remove your reaction' : 'Add this reaction'}
          className={`text-xs rounded-full px-1.5 py-0.5 border transition leading-none ${
            r.mine
              ? 'border-[#6BC06B] bg-[#6BC06B]/15 dark:border-white dark:bg-white/10'
              : 'frens-border hover:bg-black/5 dark:hover:bg-white/10'
          } disabled:opacity-60`}
        >
          <span>{r.emoji}</span>
          {r.count > 1 ? <span className="ml-0.5 text-[10px] frens-muted">{r.count}</span> : null}
        </button>
      ))}
      {canReact ? (
        <EmojiButton
          onPick={onReact}
          direction="up"
          align={mine ? 'right' : 'left'}
          label={<PlusIcon className="w-3 h-3" />}
          className="frens-action w-5 h-5 rounded-full border frens-border flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
        />
      ) : null}
      {extra}
    </div>
  )
}
