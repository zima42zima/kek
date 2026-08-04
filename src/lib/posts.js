import { supabase } from '../supabaseClient'
import { mapReactions } from './commentReactions'
import { normalizeReactions } from './postReactions'

export class PostsNotInstalledError extends Error {}

function authorIdMatch(a, b) {
  return a != null && b != null && String(a) === String(b)
}

/** Overlay a fren's current profile photo onto their post, comment, or message. */
export function withLiveAuthorAvatar(item, liveProfile) {
  if (!item || !liveProfile?.id) return item
  const authorId =
    item.userId ?? item.user_id ?? item.senderId ?? item.authorId ?? item.author_id
  if (!authorIdMatch(authorId, liveProfile.id)) return item
  return {
    ...item,
    avatarType: liveProfile.avatarType || 'frog',
    avatarUrl: liveProfile.avatarUrl ?? null,
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

export function mapDbPost(row) {
  return {
    id: row.id,
    userId: row.user_id,
    frenName: row.author_name || 'fren',
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    text: row.body || '',
    image: row.image || null,
    audience: row.audience || 'everyone',
    tags: row.tags || [],
    timestamp: relativeTime(row.created_at),
    createdAt: row.created_at,
    echoes: 0,
    auraCount: Number(row.aura_count ?? 0),
    iGaveAura: row.i_gave_aura ?? false,
    iFollowAuthor: row.i_follow_author ?? false,
    commentCount: Number(row.comment_count ?? 0),
    isPinned: Boolean(row.is_pinned),
    feedSource: row.feed_source || null,
    shownByUserId: row.shown_by_user_id || null,
    shownByName: row.shown_by_name || null,
    shownAt: row.shown_at || null,
    feedSortAt: row.feed_sort_at || row.created_at,
    iShowToFrens: Boolean(row.i_show_to_frens),
    reactions: mapReactions(row.reactions),
  }
}

export function mapDbComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    frenName: row.author_name || 'fren',
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    text: row.body || '',
    timestamp: relativeTime(row.created_at),
    createdAt: row.created_at,
    reactions: mapReactions(row.reactions),
  }
}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new PostsNotInstalledError(error.message)
  }
}

export async function listPosts() {
  const { data, error } = await supabase.rpc('list_feed_posts')
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      const { data: legacy, error: legacyError } = await supabase.rpc('list_posts')
      if (legacyError) {
        throwIfNotInstalled(legacyError)
        throw legacyError
      }
      return (legacy ?? []).map(mapDbPost)
    }
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapDbPost)
}

export async function toggleShowToFrens(postId) {
  const { data, error } = await supabase.rpc('toggle_show_to_frens', { p_post: postId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return Boolean(data)
}

export function mapShowQuota(row) {
  const used = Number(row?.used_today ?? 0)
  const limit = Number(row?.daily_limit ?? 10)
  const remaining = Number(row?.remaining ?? Math.max(0, limit - used))
  return { used, limit, remaining }
}

export async function getShowToFrensQuota() {
  const { data, error } = await supabase.rpc('get_show_to_frens_quota')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return mapShowQuota(row)
}

export async function listPostsByUser(userId) {
  const { data, error } = await supabase.rpc('list_posts_by_user', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapDbPost)
}

export async function createPost(fields) {
  const { data, error } = await supabase.rpc('create_post', {
    p_body: fields.text ?? null,
    p_image: fields.image ?? null,
    p_audience: fields.audience ?? 'everyone',
    p_tags: fields.tags ?? [],
    p_author_name: fields.frenName ?? null,
    p_avatar_type: fields.avatarType ?? 'frog',
    p_avatar_url: fields.avatarUrl ?? null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return mapDbPost(row)
}

export async function deleteMyPost(id) {
  const { error } = await supabase.rpc('delete_my_post', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function pinProfilePost(postId) {
  const { error } = await supabase.rpc('pin_profile_post', { p_post: postId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function unpinProfilePost() {
  const { error } = await supabase.rpc('unpin_profile_post')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function listPostComments(postId) {
  const { data, error } = await supabase.rpc('list_post_comments', { p_post: postId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapDbComment)
}

export async function createComment(postId, fields) {
  const { data, error } = await supabase.rpc('create_comment', {
    p_post: postId,
    p_body: fields.text,
    p_author_name: fields.frenName ?? null,
    p_avatar_type: fields.avatarType ?? 'frog',
    p_avatar_url: fields.avatarUrl ?? null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return mapDbComment(row)
}

export async function deleteMyComment(id) {
  const { error } = await supabase.rpc('delete_my_comment', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function toggleCommentReaction(commentId, emoji) {
  const { data, error } = await supabase.rpc('toggle_comment_reaction', {
    p_comment: commentId,
    p_emoji: emoji,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return mapReactions(data)
}

export async function togglePostReaction(postId, reactionId) {
  const { data, error } = await supabase.rpc('toggle_post_reaction', {
    p_post: postId,
    p_reaction: reactionId,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return mapReactions(data)
}

/** Load fire/thunder counts from post_feed_reactions when list RPCs omit them. */
export async function hydratePostReactions(posts, viewerId) {
  if (!posts?.length) return posts ?? []

  const ids = [...new Set(posts.map((p) => p.id).filter(Boolean))]
  if (!ids.length) return posts

  const { data, error } = await supabase
    .from('post_feed_reactions')
    .select('post_id, reaction_id, user_id')
    .in('post_id', ids)

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return posts
    throw error
  }
  if (!data?.length) return posts

  const byPost = new Map()
  for (const row of data) {
    const pid = String(row.post_id)
    if (!byPost.has(pid)) byPost.set(pid, new Map())
    const rxMap = byPost.get(pid)
    const rid = String(row.reaction_id || '')
    if (!rid) continue
    if (!rxMap.has(rid)) rxMap.set(rid, { id: rid, count: 0, mine: false })
    const entry = rxMap.get(rid)
    entry.count += 1
    if (viewerId && String(row.user_id) === String(viewerId)) entry.mine = true
  }

  return posts.map((post) => {
    const rxMap = byPost.get(String(post.id))
    if (!rxMap) return post
    return { ...post, reactions: normalizeReactions(Array.from(rxMap.values())) }
  })
}

export async function fetchPostReactions(postId, viewerId) {
  const { data, error } = await supabase.rpc('post_feed_reactions_json', {
    p_post_id: postId,
  })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      const [post] = await hydratePostReactions([{ id: postId, reactions: [] }], viewerId)
      return normalizeReactions(post?.reactions)
    }
    throwIfNotInstalled(error)
    throw error
  }
  return mapReactions(data)
}
