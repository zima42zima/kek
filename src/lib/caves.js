import { supabase } from '../supabaseClient'
import { applyEmojiReactionToggle } from './emojiReactions'

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
    ts: row.ts ?? formatTs(row.created_at),
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
    banned: cave.banned || [],
    emojiPacks: cave.emojiPacks || [],
    members: (cave.members || []).map((m) => ({
      id: m.id,
      name: m.name,
      avatarType: m.avatarType,
      avatarUrl: m.avatarUrl,
      role: m.role,
    })),
  }
}

export function mapRemoteCave(row) {
  if (!row?.id) return null
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji || '🕳️',
    ownerId: row.ownerId,
    access: row.access || 'invite',
    banned: Array.isArray(row.banned) ? row.banned.map(String) : [],
    emojiPacks: row.emojiPacks || [],
    hiddenOnProfile: row.hiddenOnProfile ?? false,
    members: (row.members || []).map(mapMember),
    messages: (row.messages || []).map(mapMessage),
  }
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
  const { data, error } = await supabase.rpc('list_profile_caves', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? [])
    .filter((r) => (r.access || 'invite') === 'public')
    .map((r) => ({
      id: r.cave_id,
      name: r.name,
      emoji: r.emoji || '🕳️',
      access: r.access || 'invite',
      isOwner: r.is_owner ?? false,
    }))
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
  }))
}

/** Self-join a public cave. Needs join_public_cave RPC. */
export async function joinPublicCave(caveId) {
  const { error } = await supabase.rpc('join_public_cave', { p_cave_id: caveId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

/** Caves a fren chose to show on their profile (public + not hidden). */
export function cavesVisibleOnProfile(caves) {
  return (caves ?? []).filter((c) => c.access === 'public' && !c.hiddenOnProfile)
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

export async function syncCaveRemote(cave) {
  const { error } = await supabase.rpc('sync_cave', { p_cave: caveToRpcPayload(cave) })
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

export async function sendCaveMessageRemote(caveId, fields) {
  const { data, error } = await supabase.rpc('send_cave_message', {
    p_cave_id: caveId,
    p_body: fields.text ?? null,
    p_image: fields.image ?? null,
    p_sticker: fields.sticker ?? null,
    p_author_name: fields.authorName ?? null,
    p_avatar_type: fields.avatarType ?? 'frog',
    p_avatar_url: fields.avatarUrl ?? null,
  })
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

export function mergeCaveSnapshot(local, remote) {
  if (!remote?.id) return local
  const memberMap = new Map()
  ;[...(remote.members || []), ...(local?.members || [])].forEach((m) => {
    if (m?.id) memberMap.set(m.id, m)
  })
  const localMsgs = local?.messages || []
  const remoteMsgs = remote.messages || []
  const msgById = new Map()
  ;[...localMsgs, ...remoteMsgs].forEach((m) => {
    if (m?.id != null) {
      const prev = msgById.get(m.id)
      msgById.set(m.id, prev ? {
        ...prev,
        ...m,
        reactions: (m.reactions?.length ? m.reactions : prev.reactions) || [],
      } : m)
    }
  })
  const messages = [...msgById.values()].sort((a, b) => {
    const ai = typeof a.id === 'number' ? a.id : Number(a.id) || 0
    const bi = typeof b.id === 'number' ? b.id : Number(b.id) || 0
    return ai - bi
  })
  return {
    ...remote,
    ...(local || {}),
    id: remote.id,
    name: remote.name ?? local?.name,
    ownerId: remote.ownerId ?? local?.ownerId,
    access: remote.access ?? local?.access ?? 'invite',
    emoji: remote.emoji ?? local?.emoji,
    banned: remote.banned?.length ? remote.banned : (local?.banned ?? []),
    emojiPacks: local?.emojiPacks?.length ? local.emojiPacks : (remote.emojiPacks || []),
    hiddenOnProfile: remote.hiddenOnProfile ?? local?.hiddenOnProfile ?? false,
    members: [...memberMap.values()],
    messages,
  }
}
