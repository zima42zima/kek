import { supabase } from '../supabaseClient'
import { mapDbPost, hydratePostReactions } from './posts'

function relativeTime(iso) {
  if (!iso) return ''
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

async function loadComments(userId, limit) {
  const { data, error } = await supabase
    .from('post_comments')
    .select('id, post_id, body, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

async function loadAura(userId, limit) {
  const { data, error } = await supabase
    .from('post_reactions')
    .select('post_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

async function loadFeedReactions(userId, limit) {
  const { data, error } = await supabase
    .from('post_feed_reactions')
    .select('post_id, reaction_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    throw error
  }
  return data ?? []
}

async function fetchPostsByIds(ids, viewerId) {
  if (!ids.length) return []

  const plain = await supabase
    .from('posts')
    .select('id, user_id, author_name, avatar_type, avatar_url, body, image, audience, tags, created_at')
    .in('id', ids)
  if (plain.error) throw plain.error
  const rows = plain.data

  // Aura counts + mine for these posts
  const { data: auraRows } = await supabase
    .from('post_reactions')
    .select('post_id, user_id')
    .in('post_id', ids)

  const auraByPost = new Map()
  for (const r of auraRows ?? []) {
    const pid = String(r.post_id)
    if (!auraByPost.has(pid)) auraByPost.set(pid, { count: 0, mine: false })
    const e = auraByPost.get(pid)
    e.count += 1
    if (viewerId && String(r.user_id) === String(viewerId)) e.mine = true
  }

  // Comment counts
  const { data: commentRows } = await supabase
    .from('post_comments')
    .select('post_id')
    .in('post_id', ids)

  const commentCount = new Map()
  for (const r of commentRows ?? []) {
    const pid = String(r.post_id)
    commentCount.set(pid, (commentCount.get(pid) || 0) + 1)
  }

  let posts = (rows ?? []).map((row) => mapDbPost({
    ...row,
    aura_count: auraByPost.get(String(row.id))?.count ?? 0,
    i_gave_aura: auraByPost.get(String(row.id))?.mine ?? false,
    comment_count: commentCount.get(String(row.id)) ?? 0,
    reactions: [],
  }))

  try {
    posts = await hydratePostReactions(posts, viewerId)
  } catch {
    // optional
  }

  return posts
}

/**
 * Activity events → feed-style _log (replies + aura only; no quotes/reposts).
 * Each entry: { post, kinds: Set, sortAt, replyPreview? }
 */
export async function listMyLogFeed(userId, { limit = 40 } = {}) {
  if (!userId) return []

  const [comments, aura, reacts] = await Promise.all([
    loadComments(userId, limit),
    loadAura(userId, limit),
    loadFeedReactions(userId, limit),
  ])

  /** @type {Map<string, { kinds: Set<string>, sortAt: string, replyText?: string }>} */
  const meta = new Map()

  function touch(postId, kind, at, extra = {}) {
    if (!postId) return
    const key = String(postId)
    if (!meta.has(key)) meta.set(key, { kinds: new Set(), sortAt: at || '' })
    const e = meta.get(key)
    e.kinds.add(kind)
    if (at && (!e.sortAt || new Date(at) > new Date(e.sortAt))) e.sortAt = at
    if (extra.replyText != null) e.replyText = extra.replyText
  }

  for (const row of comments) {
    touch(row.post_id, 'replies', row.created_at, { replyText: row.body || '' })
  }
  for (const row of aura) {
    touch(row.post_id, 'aura', row.created_at)
  }
  for (const row of reacts) {
    touch(row.post_id, 'aura', row.created_at)
  }

  const ids = [...meta.keys()]
  if (!ids.length) return []

  const posts = await fetchPostsByIds(ids, userId)
  const byId = new Map(posts.map((p) => [String(p.id), p]))

  const feed = []
  for (const [postId, m] of meta) {
    const post = byId.get(postId)
    if (!post) continue
    feed.push({
      post,
      kinds: m.kinds,
      sortAt: m.sortAt || post.createdAt,
      replyText: m.replyText || null,
      timestamp: relativeTime(m.sortAt || post.createdAt),
    })
  }

  feed.sort((a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0))
  return feed
}

/** @deprecated use listMyLogFeed */
export async function listMyLog(userId, opts) {
  const feed = await listMyLogFeed(userId, opts)
  return feed.flatMap((e) =>
    [...e.kinds].map((kind) => ({
      id: `${kind}-${e.post.id}`,
      kind,
      postId: e.post.id,
      text: e.replyText || '',
      createdAt: e.sortAt,
    })),
  )
}
