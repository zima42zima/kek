import FoldsLettersIcon from './FoldsLettersIcon'

/** P.S. mark — own profile (inbox) or other fren (send letter when open). */
export default function ProfileOwlPost({ open, pendingCount = 0, onClick }) {
  const label = 'P.S.'
  const title = open ? 'P.S.' : 'P.S. closed'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/folds frens-btn-outline w-11 h-11 rounded-full flex items-center justify-center relative shrink-0 transition ${
        open ? 'ring-2 ring-black dark:ring-white' : 'opacity-50'
      }`}
      title={title}
      aria-label={title}
    >
      <FoldsLettersIcon className="w-5 h-5 group-hover/folds:hidden" />
      <span
        aria-hidden
        className="hidden group-hover/folds:block text-[11px] font-medium tracking-tight leading-none"
      >
        {label}
      </span>
      {pendingCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black text-white text-[9px] frens-badge-count flex items-center justify-center">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </button>
  )
}
