import OwlPostIcon from './OwlPostIcon'

export function OwlIcon({ className = 'w-5 h-5' }) {
  return <OwlPostIcon className={className} />
}

export default function OwlPostStatus({
  open,
  pendingCount = 0,
  onClick,
  interactive = false,
  compact = false,
}) {
  const label = open ? 'Owl post open' : 'Owl post closed'
  const hint = open
    ? 'Accepting sealed letters'
    : 'Not accepting letters right now'

  const inner = (
    <>
      <span
        className={`inline-flex items-center justify-center rounded-full shrink-0 ${
          compact ? 'w-8 h-8' : 'w-9 h-9'
        } ${open ? 'bg-black text-white dark:bg-white dark:text-black' : 'frens-muted bg-black/5 dark:bg-white/5'}`}
      >
        <OwlIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
      </span>
      {!compact && (
        <span className="text-left min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs frens-muted">{hint}</span>
        </span>
      )}
      {pendingCount > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-black text-white text-[10px] frens-badge-count flex items-center justify-center shrink-0">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </>
  )

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 w-full rounded-xl border frens-border px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition text-left ${
          compact ? 'w-auto inline-flex' : ''
        }`}
        title={label}
      >
        {inner}
      </button>
    )
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border frens-border px-3 py-2 ${
        compact ? 'inline-flex w-auto' : 'w-full'
      }`}
      title={label}
    >
      {inner}
    </div>
  )
}
