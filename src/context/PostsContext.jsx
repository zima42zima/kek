import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import {
  listPosts,
  listPostsByUser,
  createPost,
  deleteMyPost,
  pinProfilePost,
  unpinProfilePost,
  listPostComments,
  createComment,
  deleteMyComment,
  toggleCommentReaction as toggleCommentReactionRpc,
  togglePostReaction as togglePostReactionRpc,
  toggleShowToFrens as toggleShowToFrensRpc,
  getShowToFrensQuota,
  hydratePostReactions,
  fetchPostReactions,
  PostsNotInstalledError,
} from '../lib/posts'
import { supabase } from '../supabaseClient'
import { toggleAura, followUser, unfollowUser, SocialNotInstalledError } from '../lib/social'
import { applyPostReactionToggle, normalizeReactions } from '../lib/postReactions'
import { applyCommentReactionToggle } from '../lib/commentReactions'
import { APP_NAME } from '../lib/brand'

const PostsContext = createContext(undefined)

const STORAGE_KEY = 'frens-posts'

// Audience options for who can see a post.
export const AUDIENCE_OPTIONS = [
  { id: 'everyone', label: 'Everyone', hint: `Anyone on ${APP_NAME}` },
  { id: 'cave', label: 'My cave', hint: 'Frens in your cave' },
  { id: 'frens', label: 'Only frens', hint: 'People you follow back' },
  { id: 'fam', label: 'Only fam', hint: 'Your closest circle' },
  { id: 'other', label: 'Tagged frens', hint: 'Only frens you tag' },
]

export function audienceLabel(id) {
  return AUDIENCE_OPTIONS.find((o) => o.id === id)?.label ?? 'Everyone'
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function localPost(fields) {
  return {
    id: Date.now(),
    timestamp: 'just now',
    echoes: 0,
    auraCount: 0,
    iGaveAura: false,
    iFollowAuthor: false,
    commentCount: 0,
    reactions: [],
    iShowToFrens: false,
    ...fields,
  }
}

function postIdMatch(a, b) {
  return String(a) === String(b)
}

function mergePostLists(existing, incoming) {
  const byId = new Map(existing.map((p) => [String(p.id), p]))
  for (const p of incoming) {
    const key = String(p.id)
    const prev = byId.get(key)
    const prevRx = normalizeReactions(prev?.reactions)
    const nextRx = normalizeReactions(p.reactions)
    const reactions = nextRx.length > 0 ? nextRx : prevRx
    byId.set(key, { ...prev, ...p, reactions })
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.feedSortAt || b.createdAt || 0).getTime()
      - new Date(a.feedSortAt || a.createdAt || 0).getTime(),
  )
}

function localComment(postId, fields) {
  return {
    id: `local-${Date.now()}`,
    postId,
    userId: fields.userId,
    frenName: fields.frenName || 'fren',
    avatarType: fields.avatarType || 'frog',
    avatarUrl: fields.avatarUrl || null,
    text: fields.text,
    timestamp: 'just now',
    reactions: [],
  }
}

function sortPostsForProfile(list) {
  return [...list].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })
}

export function PostsProvider({ children }) {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  // remote === false means the posts SQL isn't installed yet — fall back to localStorage
  // so nothing breaks until the user re-runs supabase-fix-profile-permissions.sql.
  const [remote, setRemote] = useState(true)
  const [commentsByPost, setCommentsByPost] = useState({})
  const [auraByPostId, setAuraByPostId] = useState({})
  const [showQuota, setShowQuota] = useState(null)

  const refreshShowQuota = useCallback(async () => {
    if (!user?.id || !remote) {
      setShowQuota(null)
      return
    }
    try {
      const quota = await getShowToFrensQuota()
      setShowQuota(quota)
    } catch (err) {
      if (!(err instanceof PostsNotInstalledError)) {
        console.error('Could not load show quota:', err.message)
      }
      setShowQuota(null)
    }
  }, [user?.id, remote])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) {
        if (!cancelled) {
          setPosts([])
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const rows = await listPosts()
        const hydrated = await hydratePostReactions(rows, user.id)
        if (!cancelled) {
          setRemote(true)
          setPosts(hydrated)
          refreshShowQuota()
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof PostsNotInstalledError) {
            setRemote(false)
            setPosts(loadLocal())
            setShowQuota(null)
          } else {
            console.error('Could not load posts:', err.message)
            setPosts(loadLocal())
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, refreshShowQuota])

  // Live-sync fire/thunder reactions for everyone viewing the feed.
  useEffect(() => {
    if (!user?.id || !remote) return undefined

    function patchPostReactions(postId, reactions) {
      if (!postId) return
      setPosts((prev) =>
        prev.map((p) => (postIdMatch(p.id, postId) ? { ...p, reactions } : p)),
      )
    }

    const channel = supabase
      .channel(`post-feed-reactions:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_feed_reactions' },
        (payload) => {
          const postId = payload.new?.post_id ?? payload.old?.post_id
          if (!postId) return
          fetchPostReactions(postId, user.id)
            .then((reactions) => patchPostReactions(postId, reactions))
            .catch(() => {})
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, remote])

  // Keep own posts & comments in sync with your current profile photo.
  useEffect(() => {
    if (!user?.id || !profile) return
    const avatarType = profile.avatarType || 'frog'
    const avatarUrl = profile.avatarUrl || null
    setPosts((prev) =>
      prev.map((p) =>
        postIdMatch(p.userId, user.id) ? { ...p, avatarType, avatarUrl } : p,
      ),
    )
    setCommentsByPost((prev) => {
      let changed = false
      const next = {}
      for (const [postId, list] of Object.entries(prev)) {
        const mapped = list?.map((c) => {
          if (!postIdMatch(c.userId, user.id)) return c
          changed = true
          return { ...c, avatarType, avatarUrl }
        })
        next[postId] = mapped
      }
      return changed ? next : prev
    })
  }, [user?.id, profile?.avatarType, profile?.avatarUrl])

  // In fallback mode only, mirror posts to localStorage.
  useEffect(() => {
    if (remote) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
    } catch {
      // Photo data URLs can exceed the localStorage quota — nothing we can do
      // in fallback mode except keep them in memory for this session.
    }
  }, [posts, remote])

  async function addPost(fields) {
    if (!remote) {
      setPosts((prev) => [localPost(fields), ...prev])
      return
    }
    try {
      const created = await createPost(fields)
      setPosts((prev) => [created, ...prev])
    } catch (err) {
      if (err instanceof PostsNotInstalledError) {
        setRemote(false)
        setPosts((prev) => [localPost(fields), ...prev])
      } else {
        console.error('Could not save post:', err.message)
      }
    }
  }

  async function removePost(id) {
    if (!window.confirm('Delete this post? This can’t be undone.')) return
    if (remote) {
      try {
        await deleteMyPost(id)
      } catch (err) {
        console.error('Could not delete post:', err.message)
        return
      }
    }
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  async function pinPost(postId) {
    if (!user?.id || !postId) return
    setPosts((prev) => prev.map((p) => (
      p.userId === user.id ? { ...p, isPinned: postIdMatch(p.id, postId) } : p
    )))
    if (!remote) return
    try {
      await pinProfilePost(postId)
    } catch (err) {
      console.error('Could not pin post:', err.message)
      if (user?.id) loadPostsForUser(user.id)
    }
  }

  async function unpinPost() {
    if (!user?.id) return
    setPosts((prev) => prev.map((p) => (
      p.userId === user.id ? { ...p, isPinned: false } : p
    )))
    if (!remote) return
    try {
      await unpinProfilePost()
    } catch (err) {
      console.error('Could not unpin post:', err.message)
      loadPostsForUser(user.id)
    }
  }

  // Optimistically flip aura on one post, then reconcile with the server.
  function flipAuraState(current) {
    const iGaveAura = Boolean(current?.iGaveAura)
    const auraCount = Number(current?.auraCount ?? 0)
    return {
      iGaveAura: !iGaveAura,
      auraCount: Math.max(0, auraCount + (iGaveAura ? -1 : 1)),
    }
  }

  function applyLocalAura(id) {
    const key = String(id)
    let flipped = null

    setPosts((prev) => {
      const match = prev.find((p) => postIdMatch(p.id, id))
      if (!match) return prev
      flipped = flipAuraState({
        auraCount: Number(match.auraCount ?? 0),
        iGaveAura: Boolean(match.iGaveAura),
      })
      return prev.map((p) => (postIdMatch(p.id, id) ? { ...p, ...flipped } : p))
    })

    setAuraByPostId((prev) => {
      const current = flipped
        ? null
        : (prev[key] ?? { auraCount: 0, iGaveAura: false })
      const next = flipped ?? flipAuraState(current)
      return { ...prev, [key]: next }
    })
  }

  function setAuraForPost(id, auraCount, iGaveAura) {
    const key = String(id)
    const next = { auraCount, iGaveAura }
    setPosts((prev) =>
      prev.map((p) => (postIdMatch(p.id, id) ? { ...p, ...next } : p)),
    )
    setAuraByPostId((prev) => {
      const copy = { ...prev }
      delete copy[key]
      return copy
    })
  }

  function getPostAura(post) {
    if (!post) return { auraCount: 0, iGaveAura: false }
    const key = String(post.id)
    const overlay = auraByPostId[key]
    if (overlay) return overlay
    return {
      auraCount: Number(post.auraCount ?? 0),
      iGaveAura: Boolean(post.iGaveAura),
    }
  }

  const loadPostsForUser = useCallback(async (userId) => {
    if (!userId) return []
    if (!remote) {
      return new Promise((resolve) => {
        setPosts((prev) => {
          resolve(prev.filter((p) => postIdMatch(p.userId, userId)))
          return prev
        })
      })
    }
    try {
      const rows = await listPostsByUser(userId)
      const hydrated = await hydratePostReactions(rows, user?.id)
      setPosts((prev) => mergePostLists(prev, hydrated))
      return hydrated
    } catch (err) {
      if (err instanceof PostsNotInstalledError) {
        return new Promise((resolve) => {
          setPosts((prev) => {
            resolve(prev.filter((p) => postIdMatch(p.userId, userId)))
            return prev
          })
        })
      }
      console.error('Could not load posts for user:', err.message)
      return []
    }
  }, [remote, user?.id])

  async function toggleShowToFrens(id) {
    if (!id) return false

    let previous = false
    setPosts((prev) => {
      const match = prev.find((p) => postIdMatch(p.id, id))
      previous = Boolean(match?.iShowToFrens)
      const next = !previous
      return prev.map((p) => (postIdMatch(p.id, id) ? { ...p, iShowToFrens: next } : p))
    })

    if (!remote) return !previous

    try {
      const result = await toggleShowToFrensRpc(id)
      refreshShowQuota()
      return result
    } catch (err) {
      setPosts((prev) =>
        prev.map((p) => (postIdMatch(p.id, id) ? { ...p, iShowToFrens: previous } : p)),
      )
      if (!(err instanceof PostsNotInstalledError)) {
        console.error('Could not update show to frens:', err.message)
      }
      throw err
    }
  }

  async function giveAura(id) {
    if (!id) return
    applyLocalAura(id)
    if (!remote) return
    try {
      const { auraCount, iGaveAura } = await toggleAura(id)
      setAuraForPost(id, auraCount, iGaveAura)
    } catch (err) {
      if (err instanceof SocialNotInstalledError) return
      applyLocalAura(id)
      console.error('Could not save aura:', err.message)
    }
  }

  // Follow / unfollow a post author; updates every post by that author.
  function applyLocalFollow(authorId, follow) {
    setPosts((prev) =>
      prev.map((p) => (p.userId === authorId ? { ...p, iFollowAuthor: follow } : p)),
    )
  }

  async function setFollow(authorId, follow) {
    if (!authorId) return
    applyLocalFollow(authorId, follow)
    if (!remote) return
    try {
      if (follow) await followUser(authorId)
      else await unfollowUser(authorId)
    } catch (err) {
      if (err instanceof SocialNotInstalledError) return
      applyLocalFollow(authorId, !follow)
      console.error('Could not update follow:', err.message)
    }
  }

  function getComments(postId) {
    return commentsByPost[postId] ?? []
  }

  /** Keep optimistic reactions when a refetch returns stale/empty server data. */
  function mergeLoadedComments(existing, rows) {
    return rows.map((row) => {
      const local = existing.find((c) => c.id === row.id)
      if (!local) return row
      const localRx = normalizeReactions(local.reactions)
      const serverRx = normalizeReactions(row.reactions)
      if (localRx.length === 0) return row
      if (serverRx.length === 0) return { ...row, reactions: localRx }
      const localMine = localRx.find((r) => r.mine)
      const serverMine = serverRx.find((r) => r.mine && r.id === localMine?.id)
      if (localMine && !serverMine) return { ...row, reactions: localRx }
      if (localRx.length > serverRx.length) return { ...row, reactions: localRx }
      return row
    })
  }

  const loadComments = useCallback(async (postId) => {
    if (!remote) return
    try {
      const rows = await listPostComments(postId)
      setCommentsByPost((prev) => {
        const existing = prev[postId] ?? []
        return { ...prev, [postId]: mergeLoadedComments(existing, rows) }
      })
    } catch (err) {
      if (!(err instanceof PostsNotInstalledError)) {
        console.error('Could not load comments:', err.message)
      }
    }
  }, [remote])

  async function addComment(postId, fields) {
    const optimistic = localComment(postId, {
      ...fields,
      userId: user?.id,
    })
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] ?? []), optimistic],
    }))
    setPosts((prev) =>
      prev.map((p) =>
        postIdMatch(p.id, postId) ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p,
      ),
    )

    if (!remote) return

    try {
      const created = await createComment(postId, fields)
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) => (c.id === optimistic.id ? created : c)),
      }))
    } catch (err) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).filter((c) => c.id !== optimistic.id),
      }))
      setPosts((prev) =>
        prev.map((p) =>
          postIdMatch(p.id, postId)
            ? { ...p, commentCount: Math.max(0, (p.commentCount ?? 1) - 1) }
            : p,
        ),
      )
      if (!(err instanceof PostsNotInstalledError)) {
        console.error('Could not post comment:', err.message)
      }
    }
  }

  function patchCommentReactions(commentId, reactions) {
    setCommentsByPost((prev) => {
      const next = { ...prev }
      for (const [postId, list] of Object.entries(prev)) {
        if (!list?.some((c) => c.id === commentId)) continue
        next[postId] = list.map((c) => (c.id === commentId ? { ...c, reactions } : c))
      }
      return next
    })
  }

  async function toggleCommentReaction(commentId, emoji) {
    const em = (emoji || '').trim()
    if (!em || !commentId) return
    if (String(commentId).startsWith('local-')) return

    setCommentsByPost((prev) => {
      const next = { ...prev }
      for (const [postId, list] of Object.entries(prev)) {
        const match = list?.find((c) => c.id === commentId)
        if (!match) continue
        next[postId] = list.map((c) =>
          c.id === commentId
            ? { ...c, reactions: applyCommentReactionToggle(c.reactions, em) }
            : c,
        )
      }
      return next
    })

    if (!remote) return

    try {
      const reactions = await toggleCommentReactionRpc(commentId, em)
      patchCommentReactions(commentId, reactions)
    } catch (err) {
      if (!(err instanceof PostsNotInstalledError)) {
        console.error('Could not react to comment:', err.message)
      }
    }
  }

  function getPostReactions(post) {
    return normalizeReactions(post?.reactions)
  }

  function togglePostReaction(postId, reactionId) {
    const id = (reactionId || '').trim()
    if (!id || !postId) return
    if (String(postId).startsWith('local-') || typeof postId === 'number') return

    setPosts((prev) =>
      prev.map((p) => (
        postIdMatch(p.id, postId)
          ? { ...p, reactions: applyPostReactionToggle(normalizeReactions(p.reactions), id) }
          : p
      )),
    )

    if (!remote) return

    togglePostReactionRpc(postId, id)
      .then((reactions) => {
        setPosts((prev) =>
          prev.map((p) => (postIdMatch(p.id, postId) ? { ...p, reactions } : p)),
        )
      })
      .catch((err) => {
        if (!(err instanceof PostsNotInstalledError)) {
          console.error('Could not react to post:', err.message)
        }
      })
  }

  async function removeComment(postId, commentId) {
    const prevList = commentsByPost[postId] ?? []
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: prevList.filter((c) => c.id !== commentId),
    }))
    setPosts((prev) =>
      prev.map((p) =>
        postIdMatch(p.id, postId)
          ? { ...p, commentCount: Math.max(0, (p.commentCount ?? 1) - 1) }
          : p,
      ),
    )
    if (!remote) return
    try {
      await deleteMyComment(commentId)
    } catch (err) {
      setCommentsByPost((prev) => ({ ...prev, [postId]: prevList }))
      setPosts((prev) =>
        prev.map((p) =>
          postIdMatch(p.id, postId) ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p,
        ),
      )
      console.error('Could not delete comment:', err.message)
    }
  }

  const value = {
    posts,
    loading,
    persisted: remote,
    addPost,
    removePost,
    pinPost,
    unpinPost,
    giveAura,
    toggleShowToFrens,
    showQuota,
    getPostAura,
    getPostReactions,
    togglePostReaction,
    loadPostsForUser,
    setFollow,
    getComments,
    loadComments,
    addComment,
    removeComment,
    toggleCommentReaction,
    postsByUser: (userId) => sortPostsForProfile(
      posts.filter((p) => postIdMatch(p.userId, userId)),
    ),
  }

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>
}

export function usePosts() {
  const ctx = useContext(PostsContext)
  if (ctx === undefined) throw new Error('usePosts must be used inside PostsProvider')
  return ctx
}
