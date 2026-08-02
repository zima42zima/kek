/** Relative publish time — matches PinnedLabel size (5m, 2h, 4d). */
export default function PostTimestamp({ timestamp, createdAt, className = '' }) {
  if (!timestamp) return null
  const full = createdAt ? new Date(createdAt).toLocaleString() : undefined
  return (
    <time
      dateTime={createdAt || undefined}
      title={full}
      className={`text-[12px] leading-none frens-muted shrink-0 ${className}`}
    >
      {timestamp}
    </time>
  )
}
