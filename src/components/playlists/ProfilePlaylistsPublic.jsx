import { useEffect, useState } from 'react'
import PlaylistIcon from './PlaylistIcon'
import { listUserPlaylists } from '../../lib/playlists'
import { requestOpenPlaylists } from '../../lib/notificationNav'

/** Music chip on another fren's profile — browse their playlists. */
export default function ProfilePlaylistsPublic({
  userId,
  frenName = 'this fren',
  onOpenPlaylists,
  onNavigate,
  onCloseProfile,
}) {
  const [playlistCount, setPlaylistCount] = useState(0)
  const [trackCount, setTrackCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    listUserPlaylists(userId)
      .then((rows) => {
        if (!cancelled) {
          setPlaylistCount(rows.length)
          setTrackCount(rows.reduce((n, p) => n + p.trackCount, 0))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlaylistCount(0)
          setTrackCount(0)
        }
      })
    return () => { cancelled = true }
  }, [userId])

  if (playlistCount === 0) return null

  function openPlaylists() {
    if (onOpenPlaylists) {
      onOpenPlaylists(userId)
    } else {
      requestOpenPlaylists(userId)
      onNavigate?.('playlists')
    }
    onCloseProfile?.()
  }

  return (
    <button
      type="button"
      onClick={openPlaylists}
      className="frens-btn-outline w-11 h-11 rounded-full flex items-center justify-center relative shrink-0"
      title={`${frenName}'s playlists`}
      aria-label={`${frenName}'s playlists`}
    >
      <PlaylistIcon className="w-5 h-5" />
      {trackCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
          {trackCount > 9 ? '9+' : trackCount}
        </span>
      )}
    </button>
  )
}
