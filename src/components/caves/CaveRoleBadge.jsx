import { ShieldIcon } from '../icons/UiIcons'
import { activeFunTitle, activeModRole, roleMark, DEFAULT_TITLE_ID } from '../../lib/caveRoles'

function TitleMark({ role, className = 'w-3 h-3' }) {
  const { emoji, markUrl } = roleMark(role)
  if (markUrl) {
    return <img src={markUrl} alt="" className={`${className} object-contain shrink-0`} />
  }
  return <span className="leading-none shrink-0 text-[10px]">{emoji}</span>
}

export default function CaveRoleBadge({ member, cave = null, compact = false }) {
  const title = activeFunTitle(member, cave)
  const mod = activeModRole(member)
  if (!title && !mod) return null

  if (compact) {
    if (!mod && (!title || title.id === DEFAULT_TITLE_ID)) return null
    return (
      <span className="inline-flex items-center gap-0.5" title={mod ? mod.label : title?.label}>
        {mod ? <ShieldIcon className="w-3.5 h-3.5" /> : null}
        {!mod && title ? <TitleMark role={title} /> : null}
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
      {title && title.id !== DEFAULT_TITLE_ID ? (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full border frens-border inline-flex items-center gap-1"
          title={title.blurb}
        >
          <TitleMark role={title} />
          {title.label}
        </span>
      ) : null}
    </span>
  )
}
