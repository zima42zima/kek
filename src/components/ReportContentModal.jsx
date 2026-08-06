import { useEffect, useState } from 'react'
import { filePlatformReport, ModerationNotInstalledError } from '../lib/platformModeration'

function truncatePreview(text, max = 200) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

/** In-app report — goes to platform moderation inbox. */
export default function ReportContentModal({
  open,
  kind = null,
  refId = null,
  reportedUserId = null,
  preview = '',
  subjectLabel = 'this content',
  reportFn = null,
  onClose,
  onReported,
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    setReason('')
    setError('')
    setDone(false)
    setBusy(false)
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, busy])

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    if (!reportFn && (!kind || !refId)) return
    setBusy(true)
    setError('')
    try {
      if (reportFn) {
        await reportFn({ reason: reason.trim() })
      } else {
        await filePlatformReport({
          kind,
          refId,
          reportedUserId,
          preview: truncatePreview(preview),
          reason: reason.trim(),
        })
      }
      setDone(true)
      onReported?.()
    } catch (err) {
      setError(err instanceof ModerationNotInstalledError
        ? 'Reporting is not set up yet on this server.'
        : (err.message || 'Could not send report.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="frens-report-title"
        className="frens-surface border frens-border rounded-2xl p-5 w-full max-w-sm"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <h2 id="frens-report-title" className="frens-title-lg mb-2">Reported</h2>
            <p className="text-sm frens-muted mb-5 leading-snug">
              Thank you — MISAO will review {subjectLabel}. False reports may lead to action on your account.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="frens-btn-primary w-full py-2.5 text-sm"
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 id="frens-report-title" className="frens-title-lg mb-2">Report</h2>
            <p className="text-sm frens-muted mb-4 leading-snug">
              Tell us what is wrong with {subjectLabel}. Reports are reviewed by MISAO. No harassment, nudity, threats, or illegal activity is allowed.
            </p>
            <label htmlFor="frens-report-reason" className="block text-xs frens-label mb-1.5">
              Reason <span className="frens-hint">(optional)</span>
            </label>
            <textarea
              id="frens-report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="What happened?"
              className="frens-input w-full text-sm py-2.5 resize-none mb-4"
            />
            {error ? (
              <p className="text-xs text-red-500 dark:text-red-400 mb-3">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="frens-btn-outline flex-1 py-2.5 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-2.5 text-sm rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
