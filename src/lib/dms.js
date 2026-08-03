import { supabase } from '../supabaseClient'
import { normalizeEmojiReactions } from './emojiReactions'

export class DmsNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new DmsNotInstalledError(error.message)
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

import { getLinkEmbed, linkLabel } from './urls'

export function previewLabelForText(text) {
  if (!text?.trim()) return text
  const trimmed = text.trim()
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(trimmed)) {
    const embed = getLinkEmbed(trimmed)
    if (embed?.type === 'youtube') return 'YouTube video'
    if (embed?.type === 'vimeo') return 'Vimeo video'
    if (embed?.type === 'image') return 'image link'
    return linkLabel(trimmed)
  }
  return text
}

export function previewForThread(row) {
  if (row.last_body) return previewLabelForText(row.last_body)
  if (row.last_image) return 'photo'
  if (row.last_video) return 'video'
  if (row.last_sticker) return row.last_sticker
  return 'No messages yet'
}

function mapThread(row) {
  return {
    id: row.conversation_id,
    otherUserId: row.other_user_id,
    otherName: row.other_name || 'a fren',
    otherAvatarType: row.other_avatar_type || 'frog',
    otherAvatarUrl: row.other_avatar_url || null,
    preview: previewForThread(row),
    lastAt: row.last_at,
    unread: Number(row.unread_count ?? 0),
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    senderId: row.sender_id,
    authorName: row.author_name || 'a fren',
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    text: row.body || '',
    image: row.image || null,
    video: row.video || null,
    sticker: row.sticker || null,
    ts: formatTs(row.created_at),
    createdAt: row.created_at,
    reactions: normalizeEmojiReactions(row.reactions),
  }
}

export async function getOrCreateDm(targetId) {
  const { data, error } = await supabase.rpc('get_or_create_dm', { p_target: targetId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function listDmThreads() {
  const { data, error } = await supabase.rpc('list_my_dm_threads')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapThread)
}

export async function listDmMessages(conversationId) {
  const { data, error } = await supabase.rpc('list_dm_messages', {
    p_conversation_id: conversationId,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapMessage)
}

export async function sendDmMessageRemote(conversationId, fields) {
  const { data, error } = await supabase.rpc('send_dm_message', {
    p_conversation_id: conversationId,
    p_body: fields.text ?? null,
    p_image: fields.image ?? null,
    p_video: fields.video ?? null,
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

export async function toggleDmMessageReaction(messageId, conversationId, emoji) {
  const { data, error } = await supabase.rpc('toggle_dm_message_reaction', {
    p_message_id: messageId,
    p_conversation_id: conversationId,
    p_emoji: emoji,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return normalizeEmojiReactions(data)
}

/** Sender deletes their own DM. Needs delete_dm_message RPC. */
export async function deleteDmMessageRemote(conversationId, messageId) {
  const { error } = await supabase.rpc('delete_dm_message', {
    p_conversation_id: conversationId,
    p_message_id: messageId,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function markDmRead(conversationId) {
  const { error } = await supabase.rpc('mark_dm_conversation_read', {
    p_conversation_id: conversationId,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export { formatTs as formatDmTs }
