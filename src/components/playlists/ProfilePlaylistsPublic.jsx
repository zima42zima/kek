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

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    listUserPlaylists(userId)
      .then((rows) => {
        if (!cancelled) setPlaylistCount(rows.length)
      })
      .catch(() => {
        if (!cancelled) setPlaylistCount(0)
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
      className="frens-btn-outline w-[2.34rem] h-[2.34rem] rounded-full flex items-center justify-center relative shrink-0 text-black dark:text-white"
      title={`${frenName}'s playlists`}
      aria-label={`${frenName}'s playlists`}
    >
      <PlaylistIcon className="w-[1.06rem] h-[1.06rem]" />
    </button>
  )
}
