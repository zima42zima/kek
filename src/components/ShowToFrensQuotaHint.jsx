import { usePosts } from '../context/PostsContext'

function quotaHint(remaining) {
  if (remaining === 0) return 'No shows left today — resets throughout the day'
  if (remaining === 1) return '1 show left today'
  return `${remaining} shows left today`
}

/** Private hint — only when 3 or fewer daily shows remain. */
export default function ShowToFrensQuotaHint() {
  const { showQuota } = usePosts()
  const remaining = showQuota?.remaining

  if (remaining == null || remaining > 3) return null

  return (
    <p className="text-[11px] frens-muted text-center -mt-2 mb-1">
      {quotaHint(remaining)}
    </p>
  )
}
