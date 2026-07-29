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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <rect x="2.5" y="3" width="11" height="10.5" rx="1" />
      <path d="M5 2v2M11 2v2M2.5 6.5h11" strokeLinecap="round" />
    </svg>
  )
}

function StampIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5" aria-hidden>
      <rect x="4" y="3" width="8" height="10" rx="0.5" transform="rotate(8 8 8)" />
      <path d="M6 6.5h4M6 9h3" strokeLinecap="round" transform="rotate(8 8 8)" />
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

export default function LetterMetaBar({
  fromName,
  toName,
  anonymous,
  showDate,
  showStamp,
  writeFrom,
  onFromChange,
  onToChange,
  onShowDateChange,
  onShowStampChange,
  onWriteFromChange,
}) {
  return (
    <div className="letter-meta-bar">
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
      <div className="letter-meta-bar__tools">
        <IconBtn title="Show date" active={showDate} onClick={() => onShowDateChange?.(!showDate)}>
          <CalendarIcon />
        </IconBtn>
        <IconBtn title="Show stamp" active={showStamp} onClick={() => onShowStampChange?.(!showStamp)}>
          <StampIcon />
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
      </div>
    </div>
  )
}
