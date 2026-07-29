import AudienceIcon from './AudienceIcon'
import { LockIcon } from './icons/UiIcons'

export default function CaveAccessLabel({ access, className = '' }) {
  const isPublic = access === 'public'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] frens-muted ${className}`}>
      {isPublic ? (
        <AudienceIcon id="everyone" className="w-3 h-3 shrink-0" />
      ) : (
        <LockIcon className="w-3 h-3 shrink-0" />
      )}
      {isPublic ? 'public' : 'invite only'}
    </span>
  )
}
