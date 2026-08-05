import { withLiveAuthorAvatar } from './posts'

/** Extract author/owner id from posts, echoes, comments, DMs, etc. */
export function authorUserId(item) {
  if (!item) return null
  return (
    item.userId
    ?? item.user_id
    ?? item.senderId
    ?? item.authorId
    ?? item.author_id
    ?? item.ownerId
    ?? null
  )
}

/** Overlay current profile photo + optional display name onto a content item. */
export function hydrateItemAvatar(item, profileById, { selfUserId, selfProfile } = {}) {
  if (!item) return item
  if (item.anonymous && item.ownerId !== selfUserId) return item

  const id = authorUserId(item)
  if (!id) return item

  const live = id === selfUserId && selfProfile
    ? {
      id: selfUserId,
      avatarType: selfProfile.avatarType,
      avatarUrl: selfProfile.avatarUrl ?? null,
      frenName: selfProfile.frenName,
    }
    : profileById?.[id]

  if (!live?.id) return item

  const next = withLiveAuthorAvatar(item, live)
  if (live.frenName && !item.anonymous) {
    return {
      ...next,
      authorName: live.frenName,
      frenName: live.frenName,
    }
  }
  return next
}

export function hydrateItemAvatars(items, profileById, opts) {
  if (!items?.length) return items ?? []
  return items.map((item) => hydrateItemAvatar(item, profileById, opts))
}

const profileCache = new Map()

export function peekLiveProfile(userId) {
  return userId ? profileCache.get(userId) ?? null : null
}

export function rememberLiveProfile(card) {
  if (!card?.id) return null
  profileCache.set(card.id, card)
  return card
}

/** Fetch and cache a fren's current profile card (avatar, handle, etc.). */
export async function fetchLiveProfile(userId) {
  if (!userId) return null
  const cached = profileCache.get(userId)
  if (cached) return cached

  const { getProfileCard } = await import('./social')
  try {
    const card = await getProfileCard(userId)
    if (card) rememberLiveProfile(card)
    return card ?? null
  } catch {
    return null
  }
}

export async function prefetchLiveProfiles(userIds) {
  const unique = [...new Set((userIds || []).filter(Boolean))]
  const missing = unique.filter((id) => !profileCache.has(id))
  if (missing.length === 0) return profileCache

  await Promise.all(missing.map((id) => fetchLiveProfile(id)))
  return profileCache
}

export function liveProfilesRecord() {
  return Object.fromEntries(profileCache.entries())
}
