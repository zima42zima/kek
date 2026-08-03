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

/**
 * Text-thought mark (Ellipse 4) — solid disc in front of plain text posts.
 * Theme-aware: black in light mode, white in dark. Sized small; parent centers to text.
 * Source: RESOURCE FRENSAPP/Ellipse 4.svg
 */
export function ThoughtMark({
  className = 'w-[6px] h-[6px] shrink-0 block',
}) {
  return (
    <svg
      viewBox="0 0 142 142"
      className={className}
      aria-hidden
      focusable="false"
    >
      <circle cx="71" cy="71" r="71" className="fill-black dark:fill-white" />
    </svg>
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
