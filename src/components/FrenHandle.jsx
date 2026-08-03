/** Minimal username / handle styling used across MISAO. */
export default function FrenHandle({
  children,
  onClick,
  size = 'sm',
  inline = false,
  className = '',
}) {
  const sizeClass = size === 'lg' ? 'frens-handle-lg' : 'frens-handle'
  const flowClass = inline ? 'inline' : 'truncate block'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`frens-handle-btn max-w-full ${className}`}
      >
        <span className={`${sizeClass} ${flowClass} ${className}`}>{children}</span>
      </button>
    )
  }

  return (
    <span className={`${sizeClass} ${inline ? 'inline' : 'truncate'} ${className}`}>
      {children}
    </span>
  )
}
