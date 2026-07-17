import frogIcon from '../assets/icons/frog-icon.svg'

export default function FrogLogo({ className = 'w-8 h-auto', alt = 'FRENS frog' }) {
  return <img src={frogIcon} alt={alt} className={`frens-logo ${className}`} draggable={false} />
}

export function FrogAvatar({ className = 'w-10 h-10', logoClassName = 'w-7 h-auto' }) {
  return (
    <div
      className={`shrink-0 rounded-full frens-avatar-ring flex items-center justify-center overflow-hidden ${className}`}
    >
      <FrogLogo className={logoClassName} alt="" />
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
        <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
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
