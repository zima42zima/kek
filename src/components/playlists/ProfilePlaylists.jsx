import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import PlaylistIcon from './PlaylistIcon'
import { listUserPlaylists } from '../../lib/playlists'
import { requestOpenPlaylists } from '../../lib/notificationNav'

/** Music note chip on your profile — opens your playlists section. */
export default function ProfilePlaylists({ userId, onOpenPlaylists, onNavigate }) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    listUserPlaylists(userId)
      .then((rows) => {
        if (!cancelled) {
          setCount(rows.reduce((n, p) => n + p.trackCount, 0))
        }
      })
      .catch(() => { if (!cancelled) setCount(0) })
    return () => { cancelled = true }
  }, [userId])

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
      className="frens-btn-outline w-11 h-11 rounded-full flex items-center justify-center relative shrink-0"
      title="Your playlists"
      aria-label="Your playlists"
    >
      <PlaylistIcon className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
