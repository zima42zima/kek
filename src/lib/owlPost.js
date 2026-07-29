import { supabase } from '../supabaseClient'

export class OwlPostNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new OwlPostNotInstalledError(error.message)
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

function lengthLabel(n) {
  const len = Number(n) || 0
  if (len < 120) return 'short letter'
  if (len < 400) return 'medium letter'
  return 'long letter'
}

function mapReceived(row) {
  return {
    id: row.id,
    fromUserId: row.from_user || null,
    fromDisplay: row.from_display || 'a fren',
    anonymous: Boolean(row.anonymous),
    status: row.status,
    bodyLength: Number(row.body_length ?? 0),
    lengthLabel: lengthLabel(row.body_length),
    createdAt: row.created_at,
    timestamp: relativeTime(row.created_at),
  }
}

function mapSent(row) {
  return {
    id: row.id,
    toUserId: row.to_user,
    toName: row.to_name || 'a fren',
    anonymous: Boolean(row.anonymous),
    status: row.status,
    createdAt: row.created_at,
    printedAt: row.printed_at,
    timestamp: relativeTime(row.created_at),
  }
}

export async function getMyOwlSettings() {
  const { data, error } = await supabase.rpc('get_my_owl_settings')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    enabled: Boolean(row?.enabled),
    acceptAnonymous: Boolean(row?.accept_anonymous),
    requirePreapproval: row?.require_preapproval !== false,
    onlyFollowing: Boolean(row?.only_following),
    pendingCount: Number(row?.pending_count ?? 0),
  }
}

export async function updateMyOwlSettings(fields) {
  const { error } = await supabase.rpc('update_my_owl_settings', {
    p_enabled: fields.enabled ?? null,
    p_accept_anonymous: fields.acceptAnonymous ?? null,
    p_require_preapproval: fields.requirePreapproval ?? null,
    p_only_following: fields.onlyFollowing ?? null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function getPublicOwlStatus(userId) {
  const { data, error } = await supabase.rpc('get_public_owl_status', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    return false
  }
  return Boolean(data)
}

export async function canSendOwlTo(userId) {
  const { data, error } = await supabase.rpc('can_send_owl_to', { p_to: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return Boolean(data)
}

export async function sendOwlLetter({ toUserId, body, anonymous, frenName }) {
  const { data, error } = await supabase.rpc('send_owl_letter', {
    p_to: toUserId,
    p_body: body,
    p_anonymous: Boolean(anonymous),
    p_from_display: frenName || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function listReceivedLetters() {
  const { data, error } = await supabase.rpc('list_received_owl_letters')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapReceived)
}

export async function listSentLetters() {
  const { data, error } = await supabase.rpc('list_sent_owl_letters')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapSent)
}

export async function approveLetter(id) {
  const { error } = await supabase.rpc('approve_owl_letter', { p_id: id })
  if (error) throw error
}

export async function declineLetter(id) {
  const { error } = await supabase.rpc('decline_owl_letter', { p_id: id })
  if (error) throw error
}

export async function getLetterForPrint(id) {
  const { data, error } = await supabase.rpc('get_owl_letter_for_print', { p_id: id })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Letter not ready to print.')
  return {
    body: row.body,
    fromDisplay: row.from_display || 'a fren',
  }
}

export async function markLetterPrinted(id) {
  const { error } = await supabase.rpc('mark_owl_letter_printed', { p_id: id })
  if (error) throw error
}

export function statusLabel(status) {
  const labels = {
    pending: 'Awaiting your approval',
    ready: 'Ready to print',
    printed: 'Printed',
    declined: 'Declined',
  }
  return labels[status] || status
}
