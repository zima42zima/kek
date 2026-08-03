import { useAuth } from '../../context/AuthContext'
import PlaylistIcon from './PlaylistIcon'
import { requestOpenPlaylists } from '../../lib/notificationNav'

/** Music note chip on your profile — opens your playlists section. */
export default function ProfilePlaylists({ userId, onOpenPlaylists, onNavigate }) {
  const { user } = useAuth()

  function openPlaylists() {
    if (onOpenPlaylists) {
      onOpenPlaylists(userId)
      return
    }
    requestOpenPlaylists(userId)
    onNavigate?.('playlists')
  }

  if (!user?.id || user.id !== userId) return null

  return (
    <button
      type="button"
      onClick={openPlaylists}
      className="frens-btn-outline w-[2.34rem] h-[2.34rem] rounded-full flex items-center justify-center relative shrink-0 text-black dark:text-white"
      title="Your playlists"
      aria-label="Your playlists"
    >
      <PlaylistIcon className="w-[1.06rem] h-[1.06rem]" />
    </button>
  )
}
