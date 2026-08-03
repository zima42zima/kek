/** Shareable post links and copy-paste messages (MISAO members only via gate). */
import { APP_NAME, appOrigin } from './brand'
import { copyText } from './inviteShare'

export function postShareUrl(postId) {
  const id = String(postId || '').trim()
  const origin = appOrigin()
  return `${origin}/?post=${encodeURIComponent(id)}`
}

function postSnippet(post, maxLen = 120) {
  const raw = (post?.text || '').replace(/\s+/g, ' ').trim()
  if (raw) {
    if (raw.length <= maxLen) return raw
    return `${raw.slice(0, maxLen - 1).trim()}…`
  }
  if (post?.image) return 'shared a photo'
  return 'shared a post'
}

export function postShareMessage(post) {
  const name = post?.frenName || 'a fren'
  const snippet = postSnippet(post)
  const url = postShareUrl(post?.id)
  return [`${name} on ${APP_NAME}:`, snippet, '', url].join('\n')
}

export function postIdFromUrl(search = '') {
  if (typeof window !== 'undefined' && !search) {
    search = window.location.search
  }
  const id = new URLSearchParams(search).get('post')
  return id ? String(id).trim() : null
}

export function clearPostFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('post')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

/** Native share sheet when available; otherwise copies the message. */
export async function sharePost(post) {
  if (!post?.id) return 'error'

  const text = postShareMessage(post)
  const url = postShareUrl(post.id)

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${post.frenName || 'Fren'} on ${APP_NAME}`,
        text,
        url,
      })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }

  await copyText(text)
  return 'copied'
}
