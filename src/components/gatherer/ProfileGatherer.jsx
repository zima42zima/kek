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
      className="frens-btn-outline w-[2.34rem] h-[2.34rem] rounded-full flex items-center justify-center relative shrink-0 text-black dark:text-white"
      title="Your moodboard"
      aria-label="Your moodboard"
    >
      <GathererIcon className="w-[1.06rem] h-[1.06rem]" />
    </button>
  )
}
