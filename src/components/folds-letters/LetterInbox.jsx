import FoldsLettersIcon from '../owl/FoldsLettersIcon'

function StatusDot({ status }) {
  const styles = {
    pending: 'bg-amber-400 ring-amber-400/30',
    ready: 'bg-[#6BC06B] ring-[#6BC06B]/30',
    printed: 'bg-black/30 dark:bg-white/40 ring-transparent',
    declined: 'bg-red-400/70 ring-red-400/20',
  }
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ring-2 ${styles[status] || styles.pending}`}
      title={status}
      aria-hidden
    />
  )
}

function LengthMark({ lengthLabel }) {
  const n = lengthLabel?.includes('long') ? 3 : lengthLabel?.includes('medium') ? 2 : 1
  return (
    <span className="inline-flex gap-px opacity-40" aria-label={lengthLabel}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`block w-0.5 rounded-full bg-current ${i <= n ? 'h-2.5' : 'h-1.5 opacity-30'}`} />
      ))}
    </span>
  )
}

function ChevronIcon({ className = 'w-3 h-3' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PrintIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M7 9V4h10v5M7 16H5V9h14v7h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="14" width="10" height="6" rx="0.5" />
    </svg>
  )
}

function InboxSection({ title, count, children }) {
  if (!count) return null
  return (
    <section className="mb-3">
      <h3 className="text-[10px] uppercase tracking-[0.18em] frens-muted px-1 mb-1.5 flex items-center gap-2">
        <span>{title}</span>
        <span className="opacity-60">{count}</span>
      </h3>
      <ul className="border frens-border rounded-xl overflow-hidden divide-y divide-[var(--frens-outline)]">
        {children}
      </ul>
    </section>
  )
}

function InboxRow({ letter, onOpen }) {
  const isAnon = letter.anonymous
  const label = isAnon ? 'Anonymous' : letter.fromDisplay

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(letter)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition ${
          isAnon ? 'bg-black/[0.015] dark:bg-white/[0.02]' : ''
        }`}
      >
        <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border frens-border ${
          isAnon ? 'border-dashed' : ''
        }`}>
          {isAnon ? <FoldsLettersIcon className="w-4 h-4 opacity-80" /> : <FoldsLettersIcon className="w-4 h-4" />}
        </span>
        <span className="min-w-0 flex-1 flex items-center gap-2">
          <span className={`text-sm truncate ${isAnon ? 'frens-muted italic' : 'font-medium'}`}>
            {label}
          </span>
          <LengthMark lengthLabel={letter.lengthLabel} />
        </span>
        <StatusDot status={letter.status} />
        <span className="text-[10px] frens-muted shrink-0 tabular-nums w-10 text-right">{letter.timestamp}</span>
        <ChevronIcon className="w-3 h-3 frens-muted shrink-0" />
      </button>
    </li>
  )
}

function LetterDetail({ letter, busy, onBack, onAction }) {
  const isAnon = letter.anonymous
  const sealed = letter.status !== 'printed' && letter.status !== 'declined'

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-xs frens-muted hover:underline">
        ← Inbox
      </button>

      <div className={`flex items-start gap-3 p-4 border frens-border rounded-xl ${isAnon ? 'border-dashed' : ''}`}>
        <span className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center border frens-border ${
          isAnon ? 'border-dashed' : ''
        }`}>
          {isAnon ? <FoldsLettersIcon className="w-5 h-5 opacity-80" /> : <FoldsLettersIcon className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-base ${isAnon ? 'frens-muted italic' : 'font-medium'}`}>
            {isAnon ? 'Anonymous letter' : letter.fromDisplay}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-xs frens-muted">
            <StatusDot status={letter.status} />
            <LengthMark lengthLabel={letter.lengthLabel} />
            <span>{letter.timestamp}</span>
          </div>
        </div>
      </div>

      {sealed && (
        <p className="text-[11px] frens-muted text-center px-4">
          Sealed on screen — open only through print.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {letter.status === 'pending' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('approve', letter)}
              className="w-full frens-btn-primary py-2.5 text-sm disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('decline', letter)}
              className="w-full frens-btn-outline py-2.5 text-sm disabled:opacity-50"
            >
              Decline
            </button>
          </>
        )}
        {letter.status === 'ready' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('print', letter)}
              className="w-full frens-btn-primary py-2.5 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <PrintIcon />
              Print letter
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('decline', letter)}
              className="w-full frens-btn-outline py-2.5 text-sm disabled:opacity-50"
            >
              Decline
            </button>
          </>
        )}
        {(letter.status === 'printed' || letter.status === 'declined') && (
          <p className="text-sm frens-muted text-center py-4 capitalize">{letter.status}</p>
        )}
      </div>
    </div>
  )
}

function SentRow({ letter }) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5">
      <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border frens-border">
        <FoldsLettersIcon className="w-4 h-4 opacity-60" />
      </span>
      <span className="min-w-0 flex-1 text-sm truncate">→ {letter.toName}</span>
      {letter.anonymous && (
        <span className="text-[9px] uppercase tracking-wider frens-muted border border-dashed frens-border px-1.5 py-0.5 rounded">
          anon
        </span>
      )}
      <StatusDot status={letter.status} />
      <span className="text-[10px] frens-muted shrink-0">{letter.timestamp}</span>
    </li>
  )
}

export function LetterInbox({ inbox, onOpen }) {
  const frenLetters = inbox.filter((l) => !l.anonymous)
  const anonLetters = inbox.filter((l) => l.anonymous)

  return (
    <div className="max-h-[52vh] overflow-y-auto -mx-1 px-1">
      <InboxSection title="From frens" count={frenLetters.length}>
        {frenLetters.map((letter) => (
          <InboxRow key={letter.id} letter={letter} onOpen={onOpen} />
        ))}
      </InboxSection>
      <InboxSection title="Anonymous" count={anonLetters.length}>
        {anonLetters.map((letter) => (
          <InboxRow key={letter.id} letter={letter} onOpen={onOpen} />
        ))}
      </InboxSection>
    </div>
  )
}

export { LetterDetail, SentRow }
