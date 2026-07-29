/** Small label shown only on hover — post action row. */
export default function PostActionTip({ label, children, className = '' }) {
  if (!label) return children

  return (
    <span className={`group/tip relative inline-flex shrink-0 ${className}`}>
      {children}
      <span role="tooltip" className="frens-action-tip">
        {label}
      </span>
    </span>
  )
}
