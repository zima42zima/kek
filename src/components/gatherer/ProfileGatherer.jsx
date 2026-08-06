import { useAuth } from '../../context/AuthContext'
import GathererIcon from './GathererIcon'
import { requestOpenGatherer } from '../../lib/notificationNav'

export default function ProfileGatherer({ userId, onOpenGatherer, onNavigate }) {
  const { user } = useAuth()

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
      className="profile-hub-chip"
      title="Your moodboard"
      aria-label="Your moodboard"
    >
      <GathererIcon className="profile-hub-icon--gatherer" />
    </button>
  )
}
