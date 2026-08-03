import { useState } from 'react'
import Modal from '../Modal'
import OwlPostIcon from './OwlPostIcon'
import { printOwlLetter, canUseBrowserPrint } from '../../lib/owlPrint'

export default function PrintOwlLetterModal({ letter, onClose, onPrinted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  async function handlePrint() {
    setBusy(true)
    setError('')
    try {
      await printOwlLetter(letter)
      setAwaitingConfirm(true)
    } catch (err) {
      setError(err.message || 'Could not print this letter.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmPrinted() {
    setBusy(true)
    setError('')
    try {
      await onPrinted?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save print status.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><OwlPostIcon className="w-5 h-5" /> Print sealed letter</span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <div className="owl-letter-ui">
      <div className="text-center py-2 owl-letter-ui">
        <div className="inline-block mb-3 border-2 border-black px-3 py-2 text-[9px] font-mono font-medium tracking-widest uppercase rotate-3 bg-white text-black">
          Owl Post · Sealed
        </div>
        <p className="text-sm font-medium">Sealed letter from {letter.fromDisplay}</p>
        <p className="text-xs frens-muted mt-1">{letter.lengthLabel || 'letter'}</p>
      </div>

      {!awaitingConfirm ? (
        <>
          <p className="text-xs frens-muted leading-relaxed">
            The letter prints in pure black &amp; white — your chosen typeface, 14pt, ready for AirPrint or Save as PDF.
          </p>

          {!canUseBrowserPrint() && (
            <p className="text-xs text-black/70 mt-3 border border-black/30 px-2 py-1.5">
              Printing may not work in this browser. Try Safari or Chrome on a phone or computer with a printer set up.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-center py-2">
          Did the letter come out of the printer?
        </p>
      )}

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-3">{error}</p>
      )}

      <div className="flex gap-2 mt-5">
        {!awaitingConfirm ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handlePrint}
              className="flex-1 owl-btn-primary rounded-full px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {busy ? 'Opening printer…' : 'Print letter'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="frens-btn-outline rounded-full px-4 py-2.5 text-sm"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={confirmPrinted}
              className="flex-1 rounded-full px-4 py-2.5 text-sm bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Yes, printed'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="frens-btn-outline rounded-full px-4 py-2.5 text-sm"
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
