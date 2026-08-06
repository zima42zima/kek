import replyIcon from '../../assets/icons/cave-reply.png'
import { maskImageStyle } from '../../lib/maskIcon'

/** Reply-to mark — uses the cave reply asset as a currentColor mask. */
export default function CaveReplyIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <span
      aria-hidden
      className={`inline-block bg-current shrink-0 ${className}`}
      style={{
        ...maskImageStyle(replyIcon),
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}
