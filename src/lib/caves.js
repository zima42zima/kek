import { supabase } from '../supabaseClient'
import { applyEmojiReactionToggle } from './emojiReactions'
import { uploadMedia, StorageNotInstalledError } from './storage'
import { isDataImageUrl } from './urls'

export { applyEmojiReactionToggle as applyReactionToggle }

export class CavesNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new CavesNotInstalledError(error.message)
  }
}

function mapReactions(raw) {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : [])
  return (arr || []).map((r) => ({
    emoji: r.emoji,
    count: Number(r.count ?? 0),
    mine: Boolean(r.mine),
  })).filter((r) => r.emoji && r.count > 0)
}

function mapMember(m) {
  if (!m) return m
  return {
    id: m.id,
    name: m.name,
    avatarType: m.avatarType ?? m.avatar_type ?? 'frog',
    avatarUrl: m.avatarUrl ?? m.avatar_url ?? null,
    role: m.role || 'member',
    funTitle: m.funTitle ?? m.fun_title ?? 'dweller',
    titleExpiresAt: m.titleExpiresAt ?? m.title_expires_at ?? null,
    modRole: m.modRole ?? m.mod_role ?? null,
    modExpiresAt: m.modExpiresAt ?? m.mod_expires_at ?? null,
  }
}

function mapMessage(row) {
  const parentId = row.parentId ?? row.parent_id ?? null
  const replyPreview = row.replyPreview ?? row.reply_preview ?? null
  return {
    id: row.id,
    authorId: row.authorId ?? row.author_id,
    authorName: row.authorName ?? row.author_name ?? 'a fren',
    avatarType: row.avatarType ?? row.avatar_type ?? 'frog',
    avatarUrl: row.avatarUrl ?? row.avatar_url ?? null,
    text: row.text ?? row.body ?? '',
    image: row.image || null,
    sticker: row.sticker || null,
    pinned: Boolean(row.pinned),
    hidden: Boolean(row.hidden),
    parentId: parentId != null ? parentId : null,
    replyPreview: replyPreview
      ? {
          authorName: replyPreview.authorName ?? replyPreview.author_name ?? 'a fren',
          text: replyPreview.text ?? replyPreview.body ?? '',
          parentId: replyPreview.parentId ?? replyPreview.parent_id ?? parentId ?? null,
        }
      : null,
    ts: row.ts ?? formatTs(row.created_at ?? row.createdAt),
    createdAt: row.createdAt ?? row.created_at ?? null,
    reactions: mapReactions(row.reactions),
  }
}

function formatTs(iso) {
  if (!iso) return 'just now'
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 45) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function caveToRpcPayload(cave) {
  if (!cave?.id) return cave
  return {
    id: cave.id,
    name: cave.name,
    emoji: cave.emoji,
    ownerId: cave.ownerId,
    access: cave.access,
    coverUrl: cave.coverUrl ?? null,
    banned: cave.banned || [],
    emojiPacks: cave.emojiPacks || [],
    roles: cave.roles || null,
    members: (cave.members || []).map((m) => ({
      id: m.id,
      name: m.name,
      avatarType: m.avatarType,
      avatarUrl: m.avatarUrl,
      role: m.role,
    })),
  }
}

function pickFilled(...candidates) {
  for (const value of candidates) {
    if (value == null) continue
    if (typeof value === 'string' && !value.trim()) continue
    return value
  }
  return null
}

/** Merge member rows without letting null/empty avatars erase a known photo. */
function mergeMemberRows(prev, next) {
  const a = prev ? mapMember(prev) : null
  const b = next ? mapMember(next) : null
  if (!a) return b
  if (!b) return a
  return {
    ...a,
    ...b,
    name: pickFilled(b.name, a.name) || 'a fren',
    avatarType: pickFilled(b.avatarType, a.avatarType) || 'frog',
    avatarUrl: pickFilled(b.avatarUrl, a.avatarUrl),
    role: pickFilled(b.role, a.role) || 'member',
    funTitle: pickFilled(b.funTitle, a.funTitle),
    titleExpiresAt: b.titleExpiresAt ?? a.titleExpiresAt ?? null,
    modRole: pickFilled(b.modRole, a.modRole),
    modExpiresAt: b.modExpiresAt ?? a.modExpiresAt ?? null,
  }
}

/**
 * Union explicit members with owner + anyone who has posted.
 * Keeps member count honest when roster lag behind chat activity.
 */
export function enrichCaveRoster(cave) {
  if (!cave?.id) return cave
  const byId = new Map()
  for (const m of cave.members || []) {
    if (!m?.id) continue
    const key = String(m.id)
    byId.set(key, mergeMemberRows(byId.get(key), m))
  }
  if (cave.ownerId && !byId.has(String(cave.ownerId))) {
    byId.set(String(cave.ownerId), {
      id: cave.ownerId,
      name: 'a fren',
      avatarType: 'frog',
      avatarUrl: null,
      role: 'owner',
    })
  }
  for (const msg of cave.messages || []) {
    const id = msg?.authorId
    if (id == null) continue
    const key = String(id)
    const fromMsg = {
      id,
      name: msg.authorName || 'a fren',
      avatarType: msg.avatarType || 'frog',
      avatarUrl: msg.avatarUrl || null,
      role: String(id) === String(cave.ownerId) ? 'owner' : 'member',
    }
    // Fill gaps from messages — never leave a null owner stub over a real photo.
    byId.set(key, mergeMemberRows(byId.get(key), fromMsg))
  }
  return { ...cave, members: [...byId.values()] }
}

export function caveMemberCount(cave) {
  return enrichCaveRoster(cave)?.members?.length ?? 0
}

export function mapRemoteCave(row) {
  if (!row?.id) return null
  return enrichCaveRoster({
    id: row.id,
    name: row.name,
    emoji: row.emoji || '🕳️',
    ownerId: row.ownerId ?? row.owner_id,
    access: row.access || 'invite',
    banned: Array.isArray(row.banned) ? row.banned.map(String) : [],
    emojiPacks: row.emojiPacks || row.emoji_packs || [],
    hiddenOnProfile: row.hiddenOnProfile ?? row.hidden_on_profile ?? false,
    coverUrl: row.coverUrl ?? row.cover_url ?? null,
    roles: Array.isArray(row.roles) ? row.roles : (row.roles ? row.roles : null),
    members: (row.members || []).map(mapMember),
    messages: (row.messages || []).map(mapMessage),
  })
}

export async function listMyCavesRemote() {
  const { data, error } = await supabase.rpc('list_my_caves')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  if (!data) return []
  const arr = Array.isArray(data)
    ? data
    : (typeof data === 'string' ? JSON.parse(data) : [])
  return (arr || []).map(mapRemoteCave).filter(Boolean)
}

export async function listProfileCaves(userId) {
  if (!userId) return []

  const mapRows = (rows) => (rows ?? [])
    .filter((r) => (r.access || 'invite') === 'public')
    .map((r) => ({
      id: r.cave_id,
      name: r.name,
      emoji: r.emoji || '🕳️',
      access: r.access || 'invite',
      isOwner: r.is_owner ?? true,
      ownerId: r.owner_id ?? userId,
      coverUrl: r.cover_url ?? r.coverUrl ?? null,
    }))

  const { data, error } = await supabase.rpc('list_profile_caves', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    if (import.meta.env.DEV) {
      console.warn('list_profile_caves failed:', error.message)
    }
    return []
  }
  return mapRows(data)
}

/** Discover public caves by name (empty query = recent public). Needs search_public_caves RPC. */
export async function searchPublicCaves(query = '') {
  const { data, error } = await supabase.rpc('search_public_caves', {
    p_query: (query || '').trim() || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((r) => ({
    id: r.cave_id,
    name: r.name,
    emoji: r.emoji || '🕳️',
    ownerId: r.owner_id,
    memberCount: Number(r.member_count ?? 0),
    iMember: Boolean(r.i_member),
    access: 'public',
    coverUrl: r.cover_url ?? r.coverUrl ?? null,
  }))
}

/** Keeper/owner sets or clears cave cover photo. Needs set_cave_cover RPC. */
export async function setCaveCoverRemote(caveId, coverUrl) {
  const { error } = await supabase.rpc('set_cave_cover', {
    p_cave_id: caveId,
    p_cover_url: coverUrl ?? null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

/**
 * Publish a cover so every member can load it.
 * Migrates data:/blob: URLs to public storage first (local-only covers are invisible to others).
 * Returns the public URL stored on the server (or null when cleared).
 */
export async function publishCaveCoverRemote(caveId, coverUrl) {
  if (!caveId) return null
  if (!coverUrl) {
    await setCaveCoverRemote(caveId, null)
    return null
  }

  let url = coverUrl
  if (isDataImageUrl(coverUrl) || String(coverUrl).startsWith('blob:')) {
    try {
      const res = await fetch(coverUrl)
      const blob = await res.blob()
      url = await uploadMedia(blob, { prefix: 'cave-covers' })
    } catch (err) {
      if (err instanceof StorageNotInstalledError) {
        // Last resort: try persisting the data URL (may fail if too large).
        await setCaveCoverRemote(caveId, coverUrl)
        return coverUrl
      }
      throw err
    }
  }

  await setCaveCoverRemote(caveId, url)
  return url
}

/** Owner permanently deletes a cave (notifies former members). Needs delete_cave RPC. */
export async function deleteCaveRemote(caveId) {
  const { error } = await supabase.rpc('delete_cave', { p_cave_id: caveId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

/** Self-join a public cave. Needs join_public_cave RPC. Returns full cave when SQL returns jsonb. */
export async function joinPublicCave(caveId) {
  const { data, error } = await supabase.rpc('join_public_cave', { p_cave_id: caveId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  if (!data) return null
  const row = typeof data === 'string' ? JSON.parse(data) : data
  return mapRemoteCave(row)
}

/** Full cave for a member. Needs get_cave RPC (supabase-patch-get-cave.sql). */
export async function getCaveRemote(caveId) {
  if (!caveId) return null
  const { data, error } = await supabase.rpc('get_cave', { p_cave_id: caveId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  if (!data) return null
  const row = typeof data === 'string' ? JSON.parse(data) : data
  return mapRemoteCave(row)
}

/** Public caves this fren owns and chose to show on profile (not joined caves). */
export function cavesVisibleOnProfile(caves, ownerId) {
  return (caves ?? []).filter((c) => {
    if (c.access !== 'public' || c.hiddenOnProfile) return false
    if (ownerId == null) return true
    return String(c.ownerId) === String(ownerId)
  })
}

export async function createCaveRemote(id, name, emoji = '🕳️') {
  const { error } = await supabase.rpc('create_cave_remote', {
    p_id: id,
    p_name: name,
    p_emoji: emoji,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function syncCaveRemote(cave, { forceOwnerId } = {}) {
  const payload = caveToRpcPayload(cave)
  if (forceOwnerId) payload.ownerId = forceOwnerId
  const { error } = await supabase.rpc('sync_cave', { p_cave: payload })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

/** Owner-only access toggle. Prefer this over sync_cave for public/invite flips. */
export async function setCaveAccessRemote(caveId, access) {
  const { error } = await supabase.rpc('set_cave_access', {
    p_cave_id: caveId,
    p_access: access,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function setCaveProfileHidden(caveId, hidden) {
  const { error } = await supabase.rpc('set_cave_profile_hidden', {
    p_cave_id: caveId,
    p_hidden: hidden,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

/**
 * Ensure an owned cave exists on the server as public/invite and profile-visible.
 * Uses set_cave_access when available; falls back to sync_cave.
 */
export async function publishOwnedCaveRemote(cave, ownerId) {
  if (!cave?.id || !ownerId) return
  await createCaveRemote(cave.id, cave.name, cave.emoji || '🕳️')
  const access = cave.access === 'public' ? 'public' : 'invite'
  try {
    await setCaveAccessRemote(cave.id, access)
  } catch (err) {
    if (!(err instanceof CavesNotInstalledError)) throw err
    await syncCaveRemote({ ...cave, access, ownerId }, { forceOwnerId: ownerId })
  }
  // Push cover so joiners see the same banner the owner set locally.
  let publishedCover = null
  if (cave.coverUrl) {
    try {
      publishedCover = await publishCaveCoverRemote(cave.id, cave.coverUrl)
    } catch (err) {
      if (!(err instanceof CavesNotInstalledError)) {
        console.error('Could not push cave cover:', err.message)
      }
    }
  }
  if (access === 'public' && !cave.hiddenOnProfile) {
    await setCaveProfileHidden(cave.id, false)
  } else if (access === 'invite') {
    await setCaveProfileHidden(cave.id, true)
  }
  return { coverUrl: publishedCover }
}

export async function sendCaveMessageRemote(caveId, fields) {
  const payload = {
    p_cave_id: caveId,
    p_body: fields.text ?? null,
    p_image: fields.image ?? null,
    p_sticker: fields.sticker ?? null,
    p_author_name: fields.authorName ?? null,
    p_avatar_type: fields.avatarType ?? 'frog',
    p_avatar_url: fields.avatarUrl ?? null,
  }
  // Prefer reply-aware RPC when installed; fall back if parent arg is unknown.
  if (fields.parentId != null && fields.parentId !== '') {
    const withParent = { ...payload, p_parent_id: fields.parentId }
    const first = await supabase.rpc('send_cave_message', withParent)
    if (!first.error) return first.data
    // 42883 / PGRST202 = function signature missing — retry without parent.
    if (first.error.code !== 'PGRST202' && first.error.code !== '42883'
      && !/p_parent_id|function.*send_cave_message/i.test(first.error.message || '')) {
      throwIfNotInstalled(first.error)
      throw first.error
    }
  }
  const { data, error } = await supabase.rpc('send_cave_message', payload)
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function listCaveMessagesRemote(caveId) {
  const { data, error } = await supabase.rpc('list_cave_messages', { p_cave_id: caveId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapMessage)
}

export async function addCaveMember(targetId, cave) {
  const payload = caveToRpcPayload(cave)
  const { error } = await supabase.rpc('add_cave_member', {
    p_target: targetId,
    p_cave_id: cave.id,
    p_cave_name: cave.name,
    p_cave_data: payload,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function removeCaveMemberRemote(caveId, targetId, ban = false) {
  const { error } = await supabase.rpc('remove_cave_member', {
    p_cave_id: caveId,
    p_target: targetId,
    p_ban: ban,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

/** Member leaves a cave. Owners must delete instead. Needs leave_cave RPC. */
export async function leaveCaveRemote(caveId) {
  const { error } = await supabase.rpc('leave_cave', { p_cave_id: caveId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function assignCaveTitleRemote(caveId, targetId, titleId, weeks = 2) {
  const { error } = await supabase.rpc('assign_cave_title', {
    p_cave_id: caveId,
    p_target: targetId,
    p_title_id: titleId,
    p_weeks: weeks,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function assignCaveModRoleRemote(caveId, targetId, modRole, weeks = 1) {
  const { error } = await supabase.rpc('assign_cave_mod_role', {
    p_cave_id: caveId,
    p_target: targetId,
    p_mod_role: modRole || '',
    p_weeks: weeks,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function toggleCaveMessagePinRemote(caveId, messageId) {
  const { data, error } = await supabase.rpc('toggle_cave_message_pin', {
    p_cave_id: caveId,
    p_message_id: messageId,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return Boolean(data)
}

export async function hideCaveMessageRemote(caveId, messageId) {
  const { error } = await supabase.rpc('hide_cave_message', {
    p_cave_id: caveId,
    p_message_id: messageId,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

/** Author deletes their own cave message. Needs delete_cave_message RPC. */
export async function deleteCaveMessageRemote(caveId, messageId) {
  const { error } = await supabase.rpc('delete_cave_message', {
    p_cave_id: caveId,
    p_message_id: messageId,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function toggleCaveMessageReaction(messageId, caveId, emoji) {
  const { data, error } = await supabase.rpc('toggle_cave_message_reaction', {
    p_message_id: messageId,
    p_cave_id: caveId,
    p_emoji: emoji,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return mapReactions(data)
}

export async function listCaveMemberships() {
  const { data, error } = await supabase.rpc('list_my_cave_memberships')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data ?? []
}

function isTempMessageId(id) {
  return typeof id === 'string' && String(id).startsWith('tmp-')
}

/** Content fingerprint so optimistic tmp-* rows can match the server row. */
function messageContentKey(m) {
  return [
    String(m?.authorId ?? m?.author_id ?? ''),
    String(m?.text ?? m?.body ?? '').trim(),
    String(m?.image ?? ''),
    String(m?.sticker ?? ''),
  ].join('|')
}

function pickCoverUrl(...candidates) {
  for (const value of candidates) {
    const url = typeof value === 'string' ? value.trim() : ''
    if (url) return url
  }
  return null
}

export function mergeCaveSnapshot(local, remote) {
  if (!remote?.id) return local
  // Always union rosters — never let a 1-member join seed hide the rest.
  const memberMap = new Map()
  ;[...(local?.members || []), ...(remote.members || [])].forEach((m) => {
    if (!m?.id) return
    const key = String(m.id)
    memberMap.set(key, mergeMemberRows(memberMap.get(key), m))
  })
  const localMsgs = local?.messages || []
  const remoteMsgs = remote.messages || []
  const msgById = new Map()

  // Index local messages for parentId / replyPreview we may need to preserve.
  const localById = new Map()
  const localByContent = new Map()
  localMsgs.forEach((m) => {
    if (m?.id == null) return
    localById.set(String(m.id), m)
    const ck = messageContentKey(m)
    // Prefer the most recent local with parent info for a given content key
    if (!localByContent.has(ck) || m.parentId != null) localByContent.set(ck, m)
  })

  // Server messages are source of truth (stable ids), but keep local thread fields
  // when the server payload does not yet include parent_id (SQL patch not applied).
  // Also keep a known avatarUrl when live-profile join returns null.
  remoteMsgs.forEach((m) => {
    if (m?.id == null) return
    const key = String(m.id)
    const local = localById.get(key) || localByContent.get(messageContentKey(m))
    const prev = msgById.get(key)
    const base = prev ? { ...prev, ...m } : { ...m }
    const parentId = m.parentId ?? local?.parentId ?? prev?.parentId ?? null
    const replyPreview = m.replyPreview ?? local?.replyPreview ?? prev?.replyPreview ?? null
    msgById.set(key, {
      ...base,
      parentId,
      replyPreview,
      authorName: pickFilled(m.authorName, prev?.authorName, local?.authorName) || 'a fren',
      avatarType: pickFilled(m.avatarType, prev?.avatarType, local?.avatarType) || 'frog',
      avatarUrl: pickFilled(m.avatarUrl, prev?.avatarUrl, local?.avatarUrl),
      reactions: (m.reactions?.length ? m.reactions : (prev?.reactions || local?.reactions)) || [],
    })
  })

  const remoteKeys = new Set(remoteMsgs.map(messageContentKey))

  // Keep local-only rows (e.g. still-sending optimistic) when not already on server.
  localMsgs.forEach((m) => {
    if (m?.id == null) return
    const id = String(m.id)
    if (isTempMessageId(id)) {
      // Drop tmp once a matching real message exists — avoids double "hello".
      // parentId already transferred onto the remote row above via content key.
      if (remoteKeys.has(messageContentKey(m))) return
      if (!msgById.has(id)) msgById.set(id, m)
      return
    }
    if (!msgById.has(id)) msgById.set(id, m)
  })

  const messages = [...msgById.values()].sort((a, b) => {
    const aTmp = isTempMessageId(a.id)
    const bTmp = isTempMessageId(b.id)
    if (aTmp && !bTmp) return 1
    if (!aTmp && bTmp) return -1
    if (aTmp && bTmp) return String(a.id).localeCompare(String(b.id))
    const ai = Number(a.id) || 0
    const bi = Number(b.id) || 0
    return ai - bi
  })
  const ownerId = remote.ownerId ?? local?.ownerId
  const sameOwner = ownerId != null
    && local?.ownerId != null
    && String(local.ownerId) === String(ownerId)
  const access = sameOwner && local?.access === 'public' && (remote.access ?? 'invite') !== 'public'
    ? 'public'
    : (remote.access ?? local?.access ?? 'invite')
  const hiddenOnProfile = sameOwner
    && local?.hiddenOnProfile === false
    && remote.hiddenOnProfile === true
    ? false
    : (remote.hiddenOnProfile ?? local?.hiddenOnProfile ?? false)
  return enrichCaveRoster({
    id: remote.id,
    name: remote.name ?? local?.name,
    ownerId,
    access,
    emoji: remote.emoji ?? local?.emoji ?? '🕳️',
    banned: remote.banned?.length ? remote.banned : (local?.banned ?? []),
    emojiPacks: (Array.isArray(remote.emojiPacks) && remote.emojiPacks.length)
      ? remote.emojiPacks
      : (local?.emojiPacks || []),
    hiddenOnProfile,
    // Never drop a known cover when the other side is empty (join seeds / stale list_my_caves).
    coverUrl: pickCoverUrl(remote.coverUrl || remote.cover_url, local?.coverUrl),
    roles: Array.isArray(remote.roles) && remote.roles.length
      ? remote.roles
      : (Array.isArray(local?.roles) && local.roles.length ? local.roles : remote.roles ?? local?.roles ?? null),
    members: [...memberMap.values()],
    messages,
  })
}

/** Keeper saves the cave role catalog (max 12). */
export async function setCaveRolesRemote(caveId, roles) {
  const { error } = await supabase.rpc('set_cave_roles', {
    p_cave_id: caveId,
    p_roles: roles,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}
