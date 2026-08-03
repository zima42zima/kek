import { useState } from 'react'
import Modal from '../Modal'
import FoldsLettersIcon from '../owl/FoldsLettersIcon'
import { printOwlLetter, canUseBrowserPrint } from '../../lib/owlPrint'

export default function PrintLetterModal({ letter, onClose, onPrinted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  async function handleOpen() {
    setBusy(true)
    setError('')
    try {
      await printOwlLetter(letter)
      setAwaitingConfirm(true)
    } catch (err) {
      setError(err.message || 'Could not open this letter.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmKept() {
    setBusy(true)
    setError('')
    try {
      await onPrinted?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save status.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><FoldsLettersIcon className="w-5 h-5" /> Keep this letter</span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <div className="letter-studio-ui py-1">
        <p className="text-sm mb-1">
          From <span className="font-medium">{letter.fromDisplay}</span>
        </p>
        <p className="text-xs frens-muted mb-5">{letter.lengthLabel}</p>

        {!awaitingConfirm ? (
          <p className="text-xs frens-muted leading-relaxed">
            Your print dialog opens next — print it, or choose Save as PDF and file it with the rest of your archive.
          </p>
        ) : (
          <p className="text-sm text-center py-1">
            Saved or printed?
          </p>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400 mt-3">{error}</p>}

        {!canUseBrowserPrint() && !awaitingConfirm ? (
          <p className="text-xs frens-muted mt-3 border border-dashed frens-border px-2 py-1.5 rounded-lg">
            Printing may not work in this browser. Try Safari or Chrome on a device where you can save a PDF.
          </p>
        ) : null}

        <div className="flex gap-2 mt-5">
          {!awaitingConfirm ? (
            <>
              <button type="button" onClick={onClose} className="flex-1 letter-btn-outline rounded-full px-4 py-2.5 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !canUseBrowserPrint()}
                onClick={handleOpen}
                className="flex-1 letter-btn-primary rounded-full px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {busy ? 'Opening…' : 'Print or save PDF'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={confirmKept}
                className="flex-1 letter-btn-primary rounded-full px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Yes, kept it'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="flex-1 letter-btn-outline rounded-full px-4 py-2.5 text-sm"
              >
                Not yet
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
