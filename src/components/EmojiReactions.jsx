import ReactionEmojiPicker from './ReactionEmojiPicker'

/**
 * Pill emoji reactions + small + picker — shared by cave chat, DMs, comments, etc.
 * Home feed posts keep PostReactionButton (fire/thunder icons).
 *
 * Layout: tiny + sits beside the message (side); existing reaction chips sit under.
 * Reactions use a simple native emoji grid (always works — no heavy picker chunk).
 */
export default function EmojiReactions({
  reactions = [],
  mine = false,
  canReact = false,
  onReact,
  onReply = null,
  extra = null,
  className = '',
  /** When true, only the + / extra controls (parent places them beside the bubble). */
  controlsOnly = false,
  /** When true, only the reaction chips (parent places them under the bubble). */
  chipsOnly = false,
}) {
  // Defensive: null/non-array reactions used to throw on .length and white-screen caves.
  const list = Array.isArray(reactions) ? reactions.filter((r) => r && r.emoji) : []
  const hasReactions = list.length > 0
  if (!canReact && !hasReactions && !extra && !onReply) return null

  const chips = hasReactions ? (
    <div
      className={`flex flex-wrap items-center gap-0.5 ${mine ? 'justify-end' : 'justify-start'}`}
    >
      {list.map((r) => (
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

  const controls = (canReact || extra || onReply) ? (
    <div className={`flex items-center gap-0.5 shrink-0 ${mine ? 'flex-row-reverse' : ''}`}>
      {canReact || onReply ? (
        <ReactionEmojiPicker
          onPick={canReact ? onReact : undefined}
          onReply={onReply || undefined}
          direction="up"
          align={mine ? 'right' : 'left'}
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
