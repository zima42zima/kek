import { useState } from 'react'
import Modal from '../Modal'
import FoldsLettersIcon from '../owl/FoldsLettersIcon'
import { printOwlLetter, canUseBrowserPrint } from '../../lib/owlPrint'

export default function PrintLetterModal({ letter, onClose, onPrinted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handlePrint() {
    setBusy(true)
    setError('')
    try {
      await printOwlLetter(letter)
      onPrinted?.()
    } catch (err) {
      setError(err.message || 'Print failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><FoldsLettersIcon className="w-5 h-5" /> Print sealed letter</span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <div className="letter-studio-ui text-center py-2">
        <p className="text-xs tracking-[0.2em] uppercase mb-4">
          P.S. · Sealed
        </p>
        <p className="text-sm mb-2">
          From <span className="font-medium">{letter.fromDisplay}</span>
        </p>
        <p className="text-xs frens-muted mb-6">
          {letter.lengthLabel} · The letter opens in your print dialog — not on screen.
        </p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        {!canUseBrowserPrint() ? (
          <p className="text-sm frens-muted">Printing is not available in this browser.</p>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 letter-btn-outline rounded-full px-4 py-2.5 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handlePrint}
              className="flex-1 letter-btn-primary rounded-full px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {busy ? 'Opening…' : 'Print now'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
