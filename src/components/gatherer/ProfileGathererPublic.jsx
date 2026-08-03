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
      className="frens-btn-outline w-[2.34rem] h-[2.34rem] rounded-full flex items-center justify-center relative shrink-0 text-black dark:text-white"
      title={`${frenName}'s moodboard`}
      aria-label={`${frenName}'s moodboard`}
    >
      <GathererIcon className="w-[1.06rem] h-[1.06rem]" />
    </button>
  )
}
