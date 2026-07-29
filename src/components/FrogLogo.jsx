import monadLogo from '../assets/monad-logo.svg'

import { APP_NAME } from '../lib/brand'

/** App mark — unity symbol. */
export default function FrogLogo({ className = 'w-8 h-8', alt = APP_NAME }) {
  return (
    <img
      src={monadLogo}
      alt={alt}
      className={`frens-app-mark object-contain ${className}`}
      draggable={false}
    />
  )
}

/** Small monad glyph — marks plain text-only thoughts. */
export function ThoughtMark({ className = 'w-[0.62em] h-[0.62em] translate-y-[0.04em] opacity-75' }) {
  return (
    <img
      src={monadLogo}
      alt=""
      aria-hidden
      className={`frens-app-mark object-contain shrink-0 ${className}`}
      draggable={false}
    />
  )
}

/** Default profile avatar when no photo is set. */
export function FrogAvatar({ className = 'w-10 h-10', logoClassName = 'w-7 h-auto' }) {
  return (
    <div
      className={`shrink-0 rounded-full frens-avatar-ring flex items-center justify-center overflow-hidden ${className}`}
    >
      <img
        src={monadLogo}
        alt=""
        className={`frens-app-mark object-contain ${logoClassName}`}
        draggable={false}
      />
    </div>
  )
}

export function ProfileAvatar({
  profile,
  className = 'w-10 h-10',
  logoClassName = 'w-7 h-auto',
}) {
  if (profile?.avatarType === 'photo' && profile?.avatarUrl) {
    return (
      <div
        className={`shrink-0 rounded-full frens-avatar-ring overflow-hidden ${className}`}
      >
        <img src={profile.avatarUrl} alt="" key={profile.avatarUrl} className="w-full h-full object-cover" />
      </div>
    )
  }

  if (profile?.avatarType === 'photo' && profile?.avatarPreview) {
    return (
      <div
        className={`shrink-0 rounded-full frens-avatar-ring overflow-hidden ${className}`}
      >
        <img src={profile.avatarPreview} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  return <FrogAvatar className={className} logoClassName={logoClassName} />
}
