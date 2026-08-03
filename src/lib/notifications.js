import { supabase } from '../supabaseClient'
import { listReceivedLetters, OwlPostNotInstalledError } from './owlPost'

// Thrown when the notifications SQL isn't installed yet.
export class NotificationsNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new NotificationsNotInstalledError(error.message)
  }
}

export function relativeTime(iso) {
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

async function loadAnonymousOwlLetterIds() {
  try {
    const letters = await listReceivedLetters()
    return new Set(letters.filter((l) => l.anonymous).map((l) => l.id))
  } catch (err) {
    if (err instanceof OwlPostNotInstalledError) return new Set()
    return new Set()
  }
}

function mapRow(row, anonymousOwlLetterIds = new Set()) {
  const owlAnon = Boolean(row.owl_letter_anonymous)
    || (row.type === 'owl_letter'
      && row.owl_letter_id
      && anonymousOwlLetterIds.has(row.owl_letter_id))
  const scrubActor = owlAnon && row.type === 'owl_letter'
  return {
    id: `remote:${row.id}`,
    source: 'remote',
    type: row.type,
    actorId: scrubActor ? null : (row.actor_id || null),
    actorName: scrubActor ? null : (row.actor_name || 'a fren'),
    actorAvatarType: scrubActor ? null : (row.actor_avatar_type || 'frog'),
    actorAvatarUrl: scrubActor ? null : (row.actor_avatar_url || null),
    postId: row.post_id || null,
    postPreview: row.post_preview || '',
    caveId: row.cave_id || null,
    caveName: row.cave_name || '',
    conversationId: row.conversation_id || null,
    dmPreview: row.dm_preview || '',
    rabbitTopicId: row.rabbit_topic_id || null,
    rabbitPreview: row.rabbit_preview || '',
    owlLetterId: row.owl_letter_id || null,
    owlLetterAnonymous: owlAnon,
    platformReportId: row.platform_report_id || null,
    echoId: row.echo_id || null,
    cityLabel: row.echo_city_label || null,
    read: row.read ?? false,
    createdAt: row.created_at,
  }
}

export async function listNotifications() {
  const [{ data, error }, anonymousOwlLetterIds] = await Promise.all([
    supabase.rpc('list_notifications'),
    loadAnonymousOwlLetterIds(),
  ])
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => mapRow(row, anonymousOwlLetterIds))
}

export async function unreadCount() {
  const { data, error } = await supabase.rpc('unread_notification_count')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return Number(data ?? 0)
}

export async function markAllRead() {
  const { error } = await supabase.rpc('mark_notifications_read')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}
