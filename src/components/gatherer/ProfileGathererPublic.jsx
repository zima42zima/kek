import { useEffect, useState } from 'react'
import GathererIcon from './GathererIcon'
import { listUserMoodboards } from '../../lib/gallery'
import { requestOpenGatherer } from '../../lib/notificationNav'

export default function ProfileGathererPublic({
  userId,
  frenName = 'this fren',
  onOpenGatherer,
  onNavigate,
  onCloseProfile,
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    listUserMoodboards(userId)
      .then((rows) => { if (!cancelled) setCount(rows.length) })
      .catch(() => { if (!cancelled) setCount(0) })
    return () => { cancelled = true }
  }, [userId])

  if (count === 0) return null

  function open() {
    if (onOpenGatherer) {
      onOpenGatherer(userId)
    } else {
      requestOpenGatherer(userId)
      onNavigate?.('gatherer')
    }
    onCloseProfile?.()
  }

  return (
    <button
      type="button"
      onClick={open}
      className="frens-btn-outline w-11 h-11 rounded-full flex items-center justify-center relative shrink-0"
      title={`${frenName}'s moodboard`}
      aria-label={`${frenName}'s moodboard`}
    >
      <GathererIcon className="w-5 h-5" />
      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
        {count > 9 ? '9+' : count}
      </span>
    </button>
  )
}
