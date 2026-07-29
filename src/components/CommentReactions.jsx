import {
  FREN_COMMENT_REACTION_DEFS,
  commentReactionLabel,
} from '../lib/commentReactions'

function reactionCount(reactions, emoji) {
  return reactions?.find((r) => r.emoji === emoji)?.count ?? 0
}

function reactionMine(reactions, emoji) {
  return Boolean(reactions?.find((r) => r.emoji === emoji)?.mine)
}

export default function CommentReactions({ reactions = [], onReact, disabled = false }) {
  if (!onReact && !(reactions?.length)) return null

  const defs = onReact
    ? FREN_COMMENT_REACTION_DEFS
    : FREN_COMMENT_REACTION_DEFS.filter((def) => reactionCount(reactions, def.emoji) > 0)

  if (defs.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      {defs.map(({ emoji, label }) => {
        const count = reactionCount(reactions, emoji)
        const mine = reactionMine(reactions, emoji)
        const active = mine || count > 0

        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact?.(emoji)}
            disabled={disabled || !onReact}
            title={mine ? 'Remove your reaction' : `React · ${commentReactionLabel(emoji)}`}
            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border transition ${
              mine
                ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                : active
                  ? 'frens-border text-gray-700 dark:text-gray-300'
                  : 'frens-border frens-muted opacity-60 hover:opacity-100'
            } disabled:opacity-40`}
          >
            <span className="leading-none">{label}</span>
            {count > 0 ? (
              <span className={`ml-1 ${mine ? 'opacity-80' : 'frens-muted'}`}>{count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
