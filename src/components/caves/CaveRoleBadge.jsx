import { ShieldIcon } from '../icons/UiIcons'
import { activeFunTitle, activeModRole } from '../../lib/caveRoles'

export default function CaveRoleBadge({ member, compact = false }) {
  const title = activeFunTitle(member)
  const mod = activeModRole(member)
  if (!title && !mod) return null

  if (compact) {
    if (!mod && (!title || title.id === 'dweller')) return null
    return (
      <span className="inline-flex items-center" title={mod ? mod.label : title.label}>
        {mod ? <ShieldIcon className="w-3.5 h-3.5" /> : null}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {mod ? (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full border frens-border bg-black/5 dark:bg-white/5 inline-flex items-center gap-1"
          title={mod.blurb}
        >
          <ShieldIcon className="w-3 h-3 shrink-0" />
          {mod.label}
        </span>
      ) : null}
      {title && title.id !== 'dweller' ? (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full border frens-border"
          title={title.blurb}
        >
          {title.label}
        </span>
      ) : null}
    </span>
  )
}
