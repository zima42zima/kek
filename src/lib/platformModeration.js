import { supabase } from '../supabaseClient'

export class ModerationNotInstalledError extends Error {
  constructor(message) {
    super(message || 'Run supabase-patch-platform-moderation.sql in Supabase SQL Editor.')
    this.name = 'ModerationNotInstalledError'
  }
}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new ModerationNotInstalledError(error.message)
  }
}

function mapReport(row) {
  return {
    id: row.id,
    kind: row.kind,
    refId: row.ref_id,
    preview: row.preview || '',
    reason: row.reason || '',
    status: row.status,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name || 'a fren',
    reportedUserId: row.reported_user_id || null,
    reportedName: row.reported_name || null,
    createdAt: row.created_at,
  }
}

export async function getMyAccountStatus() {
  const { data, error } = await supabase.rpc('get_my_account_status')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return {
      suspended: false,
      suspendedReason: null,
      isFounder: false,
      isCofounder: false,
      isPlatformStaff: false,
      openReports: 0,
    }
  }
  return {
    suspended: Boolean(row.suspended),
    suspendedReason: row.suspended_reason || null,
    isFounder: Boolean(row.is_founder),
    isCofounder: Boolean(row.is_cofounder),
    isPlatformStaff: Boolean(row.is_platform_staff),
    openReports: Number(row.open_reports ?? 0),
  }
}

export async function listPlatformReports(status = 'open') {
  const { data, error } = await supabase.rpc('list_platform_reports', { p_status: status })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapReport)
}

export async function resolvePlatformReport(id, status = 'dismissed', note = '') {
  if (!id) throw new Error('Missing report id')
  const { error } = await supabase.rpc('resolve_platform_report', {
    p_id: id,
    p_status: status,
    p_note: note || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function suspendPlatformUser(userId, reason = '') {
  const { error } = await supabase.rpc('suspend_platform_user', {
    p_user: userId,
    p_reason: reason || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function unsuspendPlatformUser(userId) {
  const { error } = await supabase.rpc('unsuspend_platform_user', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function setUserCofounder(userId, value = true) {
  const { error } = await supabase.rpc('set_user_cofounder', {
    p_user: userId,
    p_value: value,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export function friendlyAccountError(message = '') {
  const msg = String(message)
  if (/account suspended/i.test(msg)) {
    return 'Your account is paused after a review.'
  }
  return msg
}

export async function filePlatformReport({
  kind,
  refId,
  reportedUserId = null,
  preview = '',
  reason = '',
}) {
  const { data, error } = await supabase.rpc('file_platform_report', {
    p_kind: kind,
    p_ref_id: String(refId),
    p_reported_user: reportedUserId || null,
    p_preview: preview || null,
    p_reason: reason || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export function reportKindLabel(kind) {
  switch (kind) {
    case 'rabbit_topic': return 'Topic'
    case 'rabbit_reply': return 'Reply'
    case 'post': return 'Post'
    case 'post_comment': return 'Comment'
    case 'dm': return 'Message'
    case 'cave': return 'Cave'
    case 'cave_message': return 'Cave message'
    case 'profile': return 'Profile'
    case 'fold': return 'Fold'
    case 'echo': return 'Echo'
    case 'echo_comment': return 'Echo comment'
    case 'owl_letter': return 'read me letter'
    default: return kind || 'Report'
  }
}

export async function staffGetUserDossier(userId) {
  const { data, error } = await supabase.rpc('staff_get_user_dossier', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    userId: row.user_id,
    frenHandle: row.handle || null,
    frenName: row.name || 'a fren',
    oneHumanThing: row.one_human_thing || null,
    bio: row.bio || null,
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    isFounder: Boolean(row.is_founder),
    isCofounder: Boolean(row.is_cofounder),
    suspended: Boolean(row.suspended),
    suspendedReason: row.suspended_reason || null,
    suspendedAt: row.suspended_at || null,
    createdAt: row.created_at || null,
    postCount: Number(row.post_count ?? 0),
    followerCount: Number(row.follower_count ?? 0),
    followingCount: Number(row.following_count ?? 0),
    dmThreadCount: Number(row.dm_thread_count ?? 0),
    openReportCount: Number(row.open_report_count ?? 0),
  }
}

export async function staffListUserPosts(userId, limit = 40) {
  const { data, error } = await supabase.rpc('staff_list_user_posts', {
    p_user: userId,
    p_limit: limit,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    body: row.body || '',
    image: row.image || null,
    audience: row.audience || 'everyone',
    createdAt: row.created_at,
  }))
}

export async function staffListUserDmThreads(userId) {
  const { data, error } = await supabase.rpc('staff_list_user_dm_threads', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => ({
    conversationId: row.conversation_id,
    otherUserId: row.other_user_id,
    otherName: row.other_name || 'a fren',
    otherHandle: row.other_handle || null,
    lastBody: row.last_body || '',
    lastAt: row.last_at,
    messageCount: Number(row.message_count ?? 0),
  }))
}

export async function staffListDmMessages(conversationId) {
  const { data, error } = await supabase.rpc('staff_list_dm_messages', {
    p_conversation_id: conversationId,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    authorName: row.author_name || 'a fren',
    body: row.body || '',
    image: row.image || null,
    video: row.video || null,
    sticker: row.sticker || null,
    createdAt: row.created_at,
  }))
}

export async function staffListUserReports(userId) {
  const { data, error } = await supabase.rpc('staff_list_user_reports', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    refId: row.ref_id,
    preview: row.preview || '',
    reason: row.reason || '',
    status: row.status,
    reporterName: row.reporter_name || 'a fren',
    createdAt: row.created_at,
  }))
}
