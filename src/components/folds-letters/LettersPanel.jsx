import { useEffect, useState } from 'react'
import Modal from '../Modal'
import PrintLetterModal from './PrintLetterModal'
import { PickRecipient, ComposeLetterForm } from './ComposeLetter'
import { LetterInbox, LetterDetail, SentRow } from './LetterInbox'
import FoldsLettersIcon from '../owl/FoldsLettersIcon'
import {
  getMyOwlSettings,
  updateMyOwlSettings,
  listReceivedLetters,
  listSentLetters,
  approveLetter,
  declineLetter,
  getLetterForPrint,
  markLetterPrinted,
  OwlPostNotInstalledError,
} from '../../lib/owlPost'

function SettingToggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className={`ps-setting-row flex items-start gap-3 py-2 ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        className="ps-checkbox mt-0.5"
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

export default function LettersPanel({ onBack, onExit, onSettingsChange }) {
  const [tab, setTab] = useState('inbox')
  const [settings, setSettings] = useState(null)
  const [inbox, setInbox] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [printLetter, setPrintLetter] = useState(null)
  const [openLetter, setOpenLetter] = useState(null)
  const [composeStep, setComposeStep] = useState(null) // null | 'pick' | 'write'
  const [composeRecipient, setComposeRecipient] = useState(null)

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
      setOpenLetter((prev) => {
        if (!prev) return null
        return received.find((l) => l.id === prev.id) || null
      })
    } catch (err) {
      setError(err instanceof OwlPostNotInstalledError
        ? 'Run supabase-patch-owl-post.sql in Supabase to enable Letters.'
        : (err.message || 'Could not load letters.'))
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
    const prev = settings
    const next = { ...settings, ...patch }
    setSettings(next)
    setSavingSettings(true)
    try {
      await updateMyOwlSettings(patch)
      onSettingsChange?.(next)
    } catch (err) {
      setSettings(prev)
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
        setOpenLetter(null)
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
      setOpenLetter(null)
      await loadAll()
    } catch (err) {
      setError(err.message || 'Could not mark letter as printed.')
    } finally {
      setBusyId(null)
    }
  }

  function switchTab(id) {
    setTab(id)
    setOpenLetter(null)
    setComposeStep(null)
    setComposeRecipient(null)
    setError('')
  }

  function openComposePicker() {
    setComposeStep('pick')
    setComposeRecipient(null)
    setOpenLetter(null)
    setError('')
  }

  function closeCompose() {
    setComposeStep(null)
    setComposeRecipient(null)
    setError('')
  }

  function handleTitleBack() {
    if (composeStep === 'write') {
      setComposeRecipient(null)
      setComposeStep('pick')
      return
    }
    if (composeStep === 'pick') {
      closeCompose()
      return
    }
    onBack?.()
  }

  const inCompose = Boolean(composeStep)
  const showTitleBack = inCompose || (onBack && !openLetter)

  return (
    <>
      <Modal
        title={(
          <span className="inline-flex items-center gap-2">
            {showTitleBack && (
              <button type="button" onClick={handleTitleBack} className="text-xs frens-muted hover:underline mr-1">
                ←
              </button>
            )}
            LETTERS
          </span>
        )}
        onClose={onExit}
        maxWidth={composeStep === 'write' ? 'max-w-5xl' : composeStep === 'pick' ? 'max-w-sm' : 'max-w-lg'}
        panelClassName={composeStep === 'pick' ? 'p-4' : ''}
      >
        {!openLetter && !inCompose && (
          <p className="text-[11px] frens-muted -mt-2 mb-3 tracking-wide">
            Sealed — read only when printed.
          </p>
        )}

        {!openLetter && !inCompose && (
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex gap-1 text-xs flex-wrap">
              {['inbox', 'sent', 'settings'].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchTab(id)}
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
              onClick={openComposePicker}
              title="Write a new letter"
              aria-label="Write a new letter"
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center frens-btn-outline"
            >
              <FoldsLettersIcon className="w-[1.2rem] h-[1.2rem]" />
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-500 dark:text-red-400 mb-3">{error}</p>}

        {composeStep === 'pick' ? (
          <PickRecipient
            onSelect={(person) => {
              setComposeRecipient(person)
              setComposeStep('write')
            }}
            onCancel={closeCompose}
          />
        ) : composeStep === 'write' && composeRecipient ? (
          <ComposeLetterForm
            recipient={composeRecipient}
            onSent={() => {
              closeCompose()
              switchTab('sent')
              loadAll()
            }}
            onCancel={closeCompose}
          />
        ) : loading ? (
          <p className="text-sm frens-muted py-8 text-center">Loading…</p>
        ) : openLetter ? (
          <LetterDetail
            letter={openLetter}
            busy={busyId === openLetter.id}
            onBack={() => setOpenLetter(null)}
            onAction={handleLetterAction}
          />
        ) : tab === 'settings' && settings ? (
          <div className="space-y-1 border frens-border rounded-xl px-3 py-2 ps-settings">
            <SettingToggle
              label="Accepting letters"
              hint="Others can send you sealed letters via P.S."
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
              hint="Restrict who can send you letters."
              checked={settings.onlyFollowing}
              disabled={savingSettings || !settings.enabled}
              onChange={(onlyFollowing) => patchSettings({ onlyFollowing })}
            />
          </div>
        ) : tab === 'inbox' ? (
          inbox.length === 0 ? (
            <p className="text-sm frens-muted text-center py-8">No letters yet.</p>
          ) : (
            <LetterInbox inbox={inbox} onOpen={setOpenLetter} />
          )
        ) : sent.length === 0 ? (
          <p className="text-sm frens-muted text-center py-8">No sent letters yet.</p>
        ) : (
          <ul className="border frens-border rounded-xl overflow-hidden divide-y divide-[var(--frens-outline)] max-h-[52vh] overflow-y-auto">
            {sent.map((letter) => (
              <SentRow key={letter.id} letter={letter} />
            ))}
          </ul>
        )}
      </Modal>

      {printLetter && (
        <PrintLetterModal
          letter={printLetter}
          onClose={() => setPrintLetter(null)}
          onPrinted={() => handlePrinted(printLetter.id)}
        />
      )}
    </>
  )
}
