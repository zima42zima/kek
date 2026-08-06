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
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setReady(false)
    listUserMoodboards(userId)
      .then((rows) => {
        if (cancelled) return
        // Only boards marked public are returned for other frens.
        setCount(rows.filter((b) => b.isPublic !== false).length)
      })
      .catch(() => {
        if (!cancelled) setCount(0)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => { cancelled = true }
  }, [userId])

  if (!ready || count === 0) return null

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
      className="profile-hub-chip"
      title={`${frenName}'s moodboard`}
      aria-label={`${frenName}'s moodboard`}
    >
      <GathererIcon className="profile-hub-icon--gatherer" />
    </button>
  )
}
