function IconBtn({ active, title, onClick, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`letter-tool ${active ? 'letter-tool--active' : ''}`}
    >
      {children}
    </button>
  )
}

/** Clean date/time mark — circle + hands (reads as timestamp, not bulky calendar). */
function TimestampIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" className="w-3.5 h-3.5" aria-hidden>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 4.75V8.15l2.35 1.55" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Monad mark — letter stamp on the page (currentColor for dark/light chrome). */
function MonadStampIcon() {
  return (
    <svg viewBox="0 0 559 559" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
      <path d="M476.756 82.2442C368.107 -26.9973 191.486 -27.4738 82.2442 81.1772C-26.9973 189.828 -27.4738 366.447 81.1772 475.689L82.2442 476.756C190.893 585.997 367.514 586.474 476.756 477.823C585.997 369.172 586.474 192.553 477.823 83.3111L476.756 82.2442ZM279.503 541.021C135.072 541.021 17.979 423.928 17.979 279.497C17.979 135.066 135.072 17.9732 279.503 17.9732C423.934 17.9732 541.027 135.066 541.027 279.497C540.868 423.858 423.864 540.864 279.503 541.021ZM279.503 240.745C258.095 240.745 240.751 258.089 240.751 279.497C240.751 300.905 258.095 318.249 279.503 318.249C300.911 318.249 318.255 300.905 318.255 279.497C318.232 258.112 300.888 240.768 279.503 240.745Z" />
    </svg>
  )
}

function AlignLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
      <rect x="2" y="3" width="10" height="1.2" rx="0.3" />
      <rect x="2" y="7" width="7" height="1.2" rx="0.3" />
      <rect x="2" y="11" width="9" height="1.2" rx="0.3" />
    </svg>
  )
}

function AlignCenterIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
      <rect x="3" y="3" width="10" height="1.2" rx="0.3" />
      <rect x="4.5" y="7" width="7" height="1.2" rx="0.3" />
      <rect x="3.5" y="11" width="9" height="1.2" rx="0.3" />
    </svg>
  )
}

function AlignRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
      <rect x="4" y="3" width="10" height="1.2" rx="0.3" />
      <rect x="7" y="7" width="7" height="1.2" rx="0.3" />
      <rect x="5" y="11" width="9" height="1.2" rx="0.3" />
    </svg>
  )
}

/** Page chrome tools (date / stamp / write-from) — shared with unified top toolbar. */
export function LetterMetaTools({
  showDate,
  showStamp,
  writeFrom,
  onShowDateChange,
  onShowStampChange,
  onWriteFromChange,
}) {
  return (
    <>
      <IconBtn title="Show date" active={showDate} onClick={() => onShowDateChange?.(!showDate)}>
        <TimestampIcon />
      </IconBtn>
      <IconBtn title="Show stamp" active={showStamp} onClick={() => onShowStampChange?.(!showStamp)}>
        <MonadStampIcon />
      </IconBtn>
      <span className="letter-tool-divider" aria-hidden />
      <IconBtn title="Write from left" active={writeFrom === 'left'} onClick={() => onWriteFromChange?.('left')}>
        <AlignLeftIcon />
      </IconBtn>
      <IconBtn title="Write from center" active={writeFrom === 'center'} onClick={() => onWriteFromChange?.('center')}>
        <AlignCenterIcon />
      </IconBtn>
      <IconBtn title="Write from right" active={writeFrom === 'right'} onClick={() => onWriteFromChange?.('right')}>
        <AlignRightIcon />
      </IconBtn>
    </>
  )
}

export default function LetterMetaBar({
  fromName,
  toName,
  anonymous,
  onFromChange,
  onToChange,
}) {
  return (
    <div className="letter-meta-bar letter-meta-bar--names-only">
      <div className="letter-meta-bar__names">
        <input
          type="text"
          className="letter-meta-bar__input"
          value={anonymous ? 'Anonymous' : fromName}
          onChange={(e) => onFromChange?.(e.target.value)}
          disabled={anonymous}
          placeholder="From"
          aria-label="From"
        />
        <span className="letter-meta-bar__arrow" aria-hidden>→</span>
        <input
          type="text"
          className="letter-meta-bar__input"
          value={toName}
          onChange={(e) => onToChange?.(e.target.value)}
          placeholder="To"
          aria-label="To"
        />
      </div>
    </div>
  )
}
