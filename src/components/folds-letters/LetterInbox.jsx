import FoldsLettersIcon from '../owl/FoldsLettersIcon'
import ReportContentButton from '../ReportContentButton'

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

function ArchiveIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M4 7h16v12H4zM8 7V5h8v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11h4M10 15h4" strokeLinecap="round" />
    </svg>
  )
}

function InboxSection({ title, count, children }) {
  if (!count) return null
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="text-[10px] uppercase tracking-[0.14em] frens-muted px-1 mb-1 flex items-center gap-1.5">
        <span>{title}</span>
        <span className="opacity-50">{count}</span>
      </h3>
      <ul className="divide-y divide-[var(--frens-outline)]">
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
        className="w-full flex items-center gap-3 px-1 py-2.5 text-left hover:opacity-80 transition"
      >
        <span className="min-w-0 flex-1 flex items-center gap-2">
          {isAnon && (
            <FoldsLettersIcon className="w-3.5 h-3.5 shrink-0 opacity-50" />
          )}
          <span className={`text-sm truncate ${isAnon ? 'frens-muted italic' : ''}`}>
            {label}
          </span>
          <LengthMark lengthLabel={letter.lengthLabel} />
        </span>
        <StatusDot status={letter.status} />
        <span className="text-[10px] frens-muted shrink-0 tabular-nums">{letter.timestamp}</span>
      </button>
    </li>
  )
}

function LetterDetail({ letter, busy, onBack, onAction }) {
  const isAnon = letter.anonymous

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-xs frens-muted hover:underline">
        ← Inbox
      </button>

      <div className="space-y-1">
        <p className={`text-base ${isAnon ? 'frens-muted italic' : 'font-medium'}`}>
          {isAnon ? 'Anonymous letter' : letter.fromDisplay}
        </p>
        <div className="flex items-center gap-2 text-xs frens-muted">
          <StatusDot status={letter.status} />
          <LengthMark lengthLabel={letter.lengthLabel} />
          <span>{letter.timestamp}</span>
        </div>
      </div>

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
              <ArchiveIcon />
              Print or save PDF
            </button>
            <p className="text-[11px] frens-muted text-center px-2">
              Opens your print dialog — choose a printer or Save as PDF for your archive.
            </p>
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

      <div className="pt-2 border-t frens-border flex justify-center">
        <ReportContentButton
          kind="owl_letter"
          refId={letter.id}
          reportedUserId={letter.anonymous ? null : letter.fromUserId}
          preview={`Letter from ${isAnon ? 'anonymous' : letter.fromDisplay}`}
          subjectLabel="this letter"
          className="text-[11px] frens-muted hover:underline"
        />
      </div>
    </div>
  )
}

function SentRow({ letter }) {
  return (
    <li className="flex items-center gap-3 px-1 py-2.5">
      <span className="min-w-0 flex-1 text-sm truncate">→ {letter.toName}</span>
      {letter.anonymous && (
        <span className="text-[9px] uppercase tracking-wider frens-muted opacity-70">
          anon
        </span>
      )}
      <StatusDot status={letter.status} />
      <span className="text-[10px] frens-muted shrink-0 tabular-nums">{letter.timestamp}</span>
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
