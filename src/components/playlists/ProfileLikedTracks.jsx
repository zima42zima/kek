import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { VideoTimelineCard } from '../YouTubeEmbed'
import {
  listMyLikedTracks,
  trackToEmbed,
  PlaylistsNotInstalledError,
} from '../../lib/playlists'
import { requestOpenPlaylists } from '../../lib/notificationNav'
import AuraIcon, { AURA_COLORS } from '../AuraIcon'

/** On your profile — songs you gave aura to across frens' playlists. */
export default function ProfileLikedTracks({ onOpenPlaylists }) {
  const { user } = useAuth()
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [needsSql, setNeedsSql] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(true)
    listMyLikedTracks()
      .then((rows) => { if (!cancelled) setTracks(rows) })
      .catch((err) => {
        if (!cancelled && err instanceof PlaylistsNotInstalledError) setNeedsSql(true)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.id])

  if (needsSql || (!loading && tracks.length === 0)) return null

  function openTrack(item) {
    requestOpenPlaylists(item.ownerId)
    onOpenPlaylists?.(item.ownerId)
  }

  return (
    <div className="mt-4 border-t frens-border pt-4">
      <p className="text-sm font-medium frens-body-text inline-flex items-center gap-1.5">
        <AuraIcon color={AURA_COLORS[0]} className="w-4 h-4" />
        Songs you liked
      </p>
      <p className="text-xs frens-hint mt-0.5 mb-3">
        Tracks you gave aura to — from any fren&apos;s playlist.
      </p>

      {loading ? (
        <p className="text-xs frens-muted">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {tracks.map((item) => {
            const embed = trackToEmbed({
              videoType: item.videoType,
              videoId: item.videoId,
              videoUrl: item.videoUrl,
            })
            return (
              <li key={`${item.trackId}-${item.likedAt}`} className="border frens-border rounded-xl p-2">
                <button
                  type="button"
                  onClick={() => openTrack(item)}
                  className="w-full text-left mb-1"
                >
                  <p className="text-xs font-medium truncate">
                    {item.title || 'Untitled track'}
                  </p>
                  <p className="text-[10px] frens-muted truncate">
                    {item.playlistName} · {item.ownerName}
                  </p>
                </button>
                <VideoTimelineCard embed={embed} caption={item.title} showAddToPlaylist={false} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
