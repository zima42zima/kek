import PsHubIcon from './PsHubIcon'

/** P.S. mark — own profile (inbox) or other fren (send letter when open). */
export default function ProfileOwlPost({ open, badgeCount = 0, onClick }) {
  const label = 'P.S.'
  const title = open ? 'P.S.' : 'P.S. closed'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group/folds profile-hub-chip"
      title={title}
      aria-label={title}
    >
      <PsHubIcon className="w-[1.06rem] h-[0.66rem] group-hover/folds:hidden" />
      <span
        aria-hidden
        className="hidden group-hover/folds:block text-[11px] font-medium tracking-tight leading-none"
      >
        {label}
      </span>
      {badgeCount ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
          {badgeCount}
        </span>
      ) : null}
    </button>
  )
}
