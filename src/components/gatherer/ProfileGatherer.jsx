import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import GathererIcon from './GathererIcon'
import { listUserMoodboards } from '../../lib/gallery'
import { requestOpenGatherer } from '../../lib/notificationNav'

export default function ProfileGatherer({ userId, onOpenGatherer, onNavigate }) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    listUserMoodboards(userId)
      .then((rows) => { if (!cancelled) setCount(rows.length) })
      .catch(() => { if (!cancelled) setCount(0) })
    return () => { cancelled = true }
  }, [userId])

  function open() {
    if (onOpenGatherer) {
      onOpenGatherer(userId)
      return
    }
    requestOpenGatherer(userId)
    onNavigate?.('gatherer')
  }

  if (!user?.id || user.id !== userId) return null

  return (
    <button
      type="button"
      onClick={open}
      className="frens-btn-outline w-11 h-11 rounded-full flex items-center justify-center relative shrink-0"
      title="Your moodboard"
      aria-label="Your moodboard"
    >
      <GathererIcon className="w-5 h-5" />
      {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
