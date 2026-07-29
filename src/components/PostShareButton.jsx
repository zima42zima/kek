import { useEffect, useState } from 'react'
import { ShareIcon, POST_ACTION_BTN, POST_ACTION_ICON } from './icons/UiIcons'
import PostActionTip from './PostActionTip'
import { sharePost } from '../lib/postShare'

/** Copy or native-share a link to this post (for frens with access). */
export default function PostShareButton({ post, className = '' }) {
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    setStatus('idle')
  }, [post?.id])

  if (!post?.id) return null

  async function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()

    const result = await sharePost(post)
    if (result === 'copied') {
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const label = status === 'copied' ? 'Copied' : 'Share post'

  return (
    <PostActionTip label="share with others">
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        className={`${POST_ACTION_BTN} frens-muted ${className}`}
      >
        <ShareIcon className={`${POST_ACTION_ICON} shrink-0`} />
      </button>
    </PostActionTip>
  )
}
