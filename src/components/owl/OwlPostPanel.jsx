import { useEffect, useState } from 'react'
import Modal from '../Modal'
import PrintOwlLetterModal from './PrintOwlLetterModal'
import OwlComposeLetter from './OwlComposeLetter'
import { EnvelopePlusIcon } from '../icons/UiIcons'
import ReportContentButton from '../ReportContentButton'
import {
  getMyOwlSettings,
  updateMyOwlSettings,
  listReceivedLetters,
  listSentLetters,
  approveLetter,
  declineLetter,
  getLetterForPrint,
  markLetterPrinted,
  statusLabel,
  OwlPostNotInstalledError,
} from '../../lib/owlPost'

const OPEN_OWL_KEY = 'frens-open-owl'

export function consumeOpenOwlFlag() {
  try {
    if (sessionStorage.getItem(OPEN_OWL_KEY) === '1') {
      sessionStorage.removeItem(OPEN_OWL_KEY)
      return true
    }
  } catch { /* ignore */ }
  return false
}

export function requestOpenOwlPanel() {
  try { sessionStorage.setItem(OPEN_OWL_KEY, '1') } catch { /* ignore */ }
}

function SettingToggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className={`flex items-start gap-3 py-2 ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs frens-muted mt-0.5">{hint}</span> : null}
      </span>
    </label>
  )
}

function EnvelopeRow({ letter, onAction, busy }) {
  const sealed = letter.status !== 'printed' && letter.status !== 'declined'
  return (
    <li className="border frens-border rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {sealed ? '📜 Sealed letter' : letter.status === 'printed' ? '📬 Printed' : '✉️ Declined'}
          </p>
          <p className="text-xs frens-muted mt-0.5">
            From {letter.fromDisplay}
            {letter.anonymous ? ' · anonymous' : ''}
            {' · '}{letter.lengthLabel}
            {' · '}{letter.timestamp}
          </p>
          <p className="text-xs mt-1">{statusLabel(letter.status)}</p>
        </div>
      </div>
      {letter.status === 'pending' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction('approve', letter)}
            className="text-xs rounded-full px-3 py-1 bg-black text-white dark:bg-white dark:text-black"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction('decline', letter)}
            className="text-xs frens-btn-outline rounded-full px-3 py-1"
          >
            Decline
          </button>
        </div>
      )}
      {letter.status === 'ready' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction('print', letter)}
            className="text-xs rounded-full px-3 py-1 bg-black text-white"
          >
            Print letter
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction('decline', letter)}
            className="text-xs frens-btn-outline rounded-full px-3 py-1"
          >
            Decline
          </button>
        </div>
      )}
      {sealed && (
        <p className="text-[10px] frens-hint">
          The letter stays sealed on screen. You only read it when you print.
        </p>
      )}
      <div className="pt-1">
        <ReportContentButton
          kind="owl_letter"
          refId={letter.id}
          reportedUserId={letter.anonymous ? null : letter.fromUserId}
          preview={`Letter from ${letter.fromDisplay}`}
          subjectLabel="this letter"
          className="text-[10px] frens-muted hover:underline"
        />
      </div>
    </li>
  )
}

export default function OwlPostPanel({ onClose, onSettingsChange }) {
  const [tab, setTab] = useState('inbox')
  const [settings, setSettings] = useState(null)
  const [inbox, setInbox] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [printLetter, setPrintLetter] = useState(null)

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [s, received, outgoing] = await Promise.all([
        getMyOwlSettings(),
        listReceivedLetters(),
        listSentLetters(),
      ])
      setSettings(s)
      setInbox(received)
      setSent(outgoing)
      onSettingsChange?.(s)
    } catch (err) {
      setError(err instanceof OwlPostNotInstalledError
        ? 'Run supabase-patch-owl-post.sql in Supabase to enable Owl Post.'
        : (err.message || 'Could not load owl post.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function patchSettings(patch) {
    if (!settings) return
    const next = { ...settings, ...patch }
    setSettings(next)
    setSavingSettings(true)
    try {
      await updateMyOwlSettings(patch)
      onSettingsChange?.(next)
    } catch (err) {
      setSettings(settings)
      setError(err.message || 'Could not save settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleLetterAction(action, letter) {
    setBusyId(letter.id)
    setError('')
    try {
      if (action === 'approve') {
        await approveLetter(letter.id)
        await loadAll()
      } else if (action === 'decline') {
        await declineLetter(letter.id)
        await loadAll()
      } else if (action === 'print') {
        const payload = await getLetterForPrint(letter.id)
        setPrintLetter({
          id: letter.id,
          fromDisplay: payload.fromDisplay,
          body: payload.body,
          anonymous: letter.anonymous,
          lengthLabel: letter.lengthLabel,
        })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePrinted(letterId) {
    setBusyId(letterId)
    setError('')
    try {
      await markLetterPrinted(letterId)
      setPrintLetter(null)
      await loadAll()
    } catch (err) {
      setError(err.message || 'Could not mark letter as printed.')
    } finally {
      setBusyId(null)
    }
  }

  function openCompose() {
    setTab('compose')
    setError('')
  }

  function handleLetterSent() {
    setTab('sent')
    loadAll()
  }

  return (
    <>
    <Modal
      title="Folds and Letters"
      onClose={onClose}
      maxWidth={tab === 'compose' ? 'max-w-5xl' : 'max-w-lg'}
    >
      {tab !== 'compose' && (
        <p className="text-xs frens-muted -mt-2 mb-4">
          Sealed letters arrive here. Nothing is read on screen — only when you print.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex gap-1 text-xs flex-wrap">
          {['inbox', 'sent', 'settings'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1 capitalize ${
                tab === id ? 'bg-black text-white dark:bg-white dark:text-black' : 'frens-btn-outline'
              }`}
            >
              {id}
              {id === 'inbox' && settings?.pendingCount > 0 ? ` (${settings.pendingCount})` : ''}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openCompose}
          title="Write a new owl letter"
          aria-label="Write a new owl letter"
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition ${
            tab === 'compose'
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'frens-btn-outline'
          }`}
        >
          <EnvelopePlusIcon className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 mb-3">{error}</p>
      )}

      {tab === 'compose' ? (
        <OwlComposeLetter
          onSent={handleLetterSent}
          onCancel={() => setTab('inbox')}
        />
      ) : loading ? (
        <p className="text-sm frens-muted py-8 text-center">Loading…</p>
      ) : tab === 'settings' && settings ? (
        <div className="space-y-1 border frens-border rounded-xl px-3 py-2">
          <SettingToggle
            label="Owl post open"
            hint="Others can see this on your profile and send you letters."
            checked={settings.enabled}
            disabled={savingSettings}
            onChange={(enabled) => patchSettings({ enabled })}
          />
          <SettingToggle
            label="Accept anonymous letters"
            hint="Senders can hide their name on the envelope."
            checked={settings.acceptAnonymous}
            disabled={savingSettings || !settings.enabled}
            onChange={(acceptAnonymous) => patchSettings({ acceptAnonymous })}
          />
          <SettingToggle
            label="Require approval before printing"
            hint="Each letter waits for you before it can be printed."
            checked={settings.requirePreapproval}
            disabled={savingSettings || !settings.enabled}
            onChange={(requirePreapproval) => patchSettings({ requirePreapproval })}
          />
          <SettingToggle
            label="Only letters from frens I follow"
            hint="Restrict who can send to your owl post."
            checked={settings.onlyFollowing}
            disabled={savingSettings || !settings.enabled}
            onChange={(onlyFollowing) => patchSettings({ onlyFollowing })}
          />
        </div>
      ) : tab === 'inbox' ? (
        inbox.length === 0 ? (
          <p className="text-sm frens-muted text-center py-8">No letters yet. Open your owl post in settings.</p>
        ) : (
          <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
            {inbox.map((letter) => (
              <EnvelopeRow
                key={letter.id}
                letter={letter}
                busy={busyId === letter.id}
                onAction={handleLetterAction}
              />
            ))}
          </ul>
        )
      ) : sent.length === 0 ? (
        <p className="text-sm frens-muted text-center py-8">You have not sent any letters yet.</p>
      ) : (
        <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
          {sent.map((letter) => (
            <li key={letter.id} className="border frens-border rounded-xl p-3">
              <p className="text-sm font-medium">To {letter.toName}</p>
              <p className="text-xs frens-muted mt-0.5">
                {letter.anonymous ? 'Sent anonymously · ' : ''}
                {statusLabel(letter.status)} · {letter.timestamp}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>

    {printLetter && (
      <PrintOwlLetterModal
        letter={printLetter}
        onClose={() => setPrintLetter(null)}
        onPrinted={() => handlePrinted(printLetter.id)}
      />
    )}
    </>
  )
}
