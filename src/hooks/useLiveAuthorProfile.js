import { useEffect, useState } from 'react'
import { fetchLiveProfile, peekLiveProfile } from '../lib/liveAvatars'

/** Real-time profile (avatar, handle) for a user id — shared cache across MISAO. */
export default function useLiveAuthorProfile(userId, { enabled = true } = {}) {
  const [profile, setProfile] = useState(() => peekLiveProfile(userId))

  useEffect(() => {
    if (!enabled || !userId) {
      setProfile(null)
      return undefined
    }

    const cached = peekLiveProfile(userId)
    if (cached) {
      setProfile(cached)
      return undefined
    }

    let cancelled = false
    fetchLiveProfile(userId).then((card) => {
      if (!cancelled) setProfile(card)
    })
    return () => { cancelled = true }
  }, [userId, enabled])

  return profile
}
