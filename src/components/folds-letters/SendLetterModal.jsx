import { useCallback, useEffect, useState } from 'react'
import Modal from '../Modal'
import FoldsLettersIcon from '../owl/FoldsLettersIcon'
import LetterStudioComposer from './LetterStudioComposer'
import { useAuth } from '../../context/AuthContext'
import {
  canSendOwlTo,
  sendOwlLetter,
  OwlPostNotInstalledError,
} from '../../lib/owlPost'
import { owlLetterHasContent, serializeOwlLetterBody } from '../../lib/owlLetterFormat'

export default function SendLetterModal({ recipient, onClose, onSent }) {
  const { profile } = useAuth()
  const senderName = profile?.frenName?.trim() || 'You'
  const [letter, setLetter] = useState(null)
  const [anonymous, setAnonymous] = useState(false)
  const [canSend, setCanSend] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const onLetterChange = useCallback((next) => setLetter(next), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    canSendOwlTo(recipient.id)
      .then((ok) => { if (!cancelled) setCanSend(ok) })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof OwlPostNotInstalledError
          ? 'Letters are not set up yet.'
          : (err.message || 'Could not check letters.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [recipient.id])

  async function handleSend(e) {
    e.preventDefault()
    if (!letter || !owlLetterHasContent(letter)) return
    setSending(true)
    setError('')
    try {
      await sendOwlLetter({
        toUserId: recipient.id,
        body: serializeOwlLetterBody(letter),
        anonymous,
        frenName: senderName,
      })
      onSent?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Could not send letter.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><FoldsLettersIcon className="w-5 h-5" /> Letter for {recipient.frenName}</span>}
      onClose={onClose}
      maxWidth="max-w-5xl"
    >
      {loading ? (
        <p className="text-sm frens-muted py-6 text-center">Checking…</p>
      ) : !canSend ? (
        <p className="text-sm frens-muted py-6 text-center">
          {error || `${recipient.frenName} is not accepting letters right now.`}
        </p>
      ) : (
        <form onSubmit={handleSend} className="space-y-4 letter-studio-ui">
          <LetterStudioComposer
            fromName={senderName}
            toName={recipient.frenName}
            anonymous={anonymous}
            onLetterChange={onLetterChange}
          />

          <label className="flex items-start gap-2 text-sm px-1 normal-case tracking-normal">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            <span>
              <span className="block">Send anonymously</span>
              <span className="block text-xs frens-muted mt-0.5">
                Your name stays hidden in notifications, inbox, and on the printed letter.
              </span>
            </span>
          </label>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={sending || !letter || !owlLetterHasContent(letter)}
            className="w-full letter-btn-primary py-3 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send letter'}
          </button>
        </form>
      )}
    </Modal>
  )
}
