import { useEffect, useState } from 'react'
import { usePosts } from '../context/PostsContext'
import { POST_ACTION_BTN, POST_ACTION_ICON, ShowToFrensIcon } from './icons/UiIcons'

function quotaTitle(remaining) {
  if (remaining == null || remaining > 3) return undefined
  if (remaining === 0) return 'No shows left today'
  if (remaining === 1) return '1 show left today'
  return `${remaining} shows left today`
}

/** Toggle showing a post to your frens' timelines. No public count. */
export default function ShowToFrensButton({
  postId,
  iShowToFrens = false,
  className = '',
}) {
  const { toggleShowToFrens, showQuota } = usePosts()
  const [showing, setShowing] = useState(iShowToFrens)

  useEffect(() => {
    setShowing(iShowToFrens)
  }, [iShowToFrens, postId])

  if (!postId) return null

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()

    setShowing((prev) => !prev)
    toggleShowToFrens(postId).catch(() => {
      setShowing((prev) => !prev)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={showing}
      title={
        showing
          ? 'Stop showing to frens'
          : quotaTitle(showQuota?.remaining) || 'Show to frens'
      }
      className={`${POST_ACTION_BTN} ${
        showing ? 'ring-1 ring-black/15 dark:ring-white/25 bg-black/[0.04] dark:bg-white/[0.06]' : 'frens-muted'
      } ${className}`}
    >
      <ShowToFrensIcon className={POST_ACTION_ICON} active={showing} />
    </button>
  )
}
