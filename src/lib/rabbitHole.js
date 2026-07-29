import { supabase } from '../supabaseClient'

export class RabbitHoleNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new RabbitHoleNotInstalledError(error.message)
  }
}

function relativeTime(iso) {
  if (!iso) return 'just now'
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 45) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString()
}

function mapTopic(row) {
  return {
    id: row.id,
    userId: row.user_id,
    frenName: row.author_name || 'a fren',
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    title: row.title,
    body: row.body || '',
    tag: row.tag || null,
    pinned: Boolean(row.pinned),
    anonymous: Boolean(row.anonymous),
    hidden: Boolean(row.hidden),
    iFollow: Boolean(row.i_follow),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timestamp: relativeTime(row.updated_at || row.created_at),
    replyCount: Number(row.reply_count ?? 0),
  }
}

function mapReply(row) {
  return {
    id: row.id,
    topicId: row.topic_id,
    userId: row.user_id,
    frenName: row.author_name || 'a fren',
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    body: row.body || '',
    anonymous: Boolean(row.anonymous),
    createdAt: row.created_at,
    timestamp: relativeTime(row.created_at),
  }
}

export async function amIMod() {
  const { data, error } = await supabase.rpc('am_i_rabbit_mod')
  if (error) {
    throwIfNotInstalled(error)
    return false
  }
  return Boolean(data)
}

export async function listTopics({ sort = 'active', tag = null } = {}) {
  const { data, error } = await supabase.rpc('list_rabbit_topics', {
    p_sort: sort,
    p_tag: tag || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapTopic)
}

export async function getTopic(id) {
  const { data, error } = await supabase.rpc('get_rabbit_topic', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return row ? mapTopic(row) : null
}

export async function listReplies(topicId) {
  const { data, error } = await supabase.rpc('list_rabbit_replies', { p_topic: topicId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapReply)
}

export async function createTopic(fields) {
  const { data, error } = await supabase.rpc('create_rabbit_topic', {
    p_title: fields.title,
    p_body: fields.body ?? null,
    p_author_name: fields.frenName ?? null,
    p_avatar_type: fields.avatarType ?? 'frog',
    p_avatar_url: fields.avatarUrl ?? null,
    p_tag: fields.tag ?? null,
    p_anonymous: Boolean(fields.anonymous),
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function createReply(topicId, fields) {
  const { data, error } = await supabase.rpc('create_rabbit_reply', {
    p_topic: topicId,
    p_body: fields.body,
    p_author_name: fields.frenName ?? null,
    p_avatar_type: fields.avatarType ?? 'frog',
    p_avatar_url: fields.avatarUrl ?? null,
    p_anonymous: Boolean(fields.anonymous),
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function deleteTopic(id) {
  const { error } = await supabase.rpc('delete_my_rabbit_topic', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function deleteReply(id) {
  const { error } = await supabase.rpc('delete_my_rabbit_reply', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function toggleFollow(topicId) {
  const { data, error } = await supabase.rpc('toggle_rabbit_topic_follow', { p_topic: topicId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return Boolean(data)
}

export async function hideTopic(id, hidden = true) {
  const { error } = await supabase.rpc('mod_hide_rabbit_topic', { p_id: id, p_hidden: hidden })
  if (error) throw error
}

export async function pinTopic(id, pinned = true) {
  const { error } = await supabase.rpc('mod_pin_rabbit_topic', { p_id: id, p_pinned: pinned })
  if (error) throw error
}

export async function reportTopic(id, reason = '') {
  const { error } = await supabase.rpc('report_rabbit_topic', { p_topic: id, p_reason: reason || null })
  if (error) throw error
}

export async function reportReply(id, reason = '') {
  const { error } = await supabase.rpc('report_rabbit_reply', { p_reply: id, p_reason: reason || null })
  if (error) throw error
}
