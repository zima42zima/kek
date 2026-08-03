import { useEffect, useState } from 'react'
import FrogLogo from '../components/FrogLogo'
import ThemeControls from '../components/ThemeControls'
import { signupGateOpen, peekInviteCode, InvitesNotInstalledError } from '../lib/invites'
import { clearInviteFromUrl, inviteCodeFromUrl } from '../lib/inviteShare'

export default function InviteGate({ onContinue, onLogin }) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | invalid | valid
  const [error, setError] = useState('')
  const [bootstrap, setBootstrap] = useState(false)
  const [loadingGate, setLoadingGate] = useState(true)
  const [gateError, setGateError] = useState('')
  const [inviterName, setInviterName] = useState(null)

  useEffect(() => {
    signupGateOpen()
      .then(setBootstrap)
      .catch((err) => {
        setBootstrap(false)
        if (err instanceof InvitesNotInstalledError) {
          setGateError('Invite system not installed — run supabase-patch-onboarding.sql in Supabase.')
        }
      })
      .finally(() => setLoadingGate(false))
  }, [])

  useEffect(() => {
    const fromUrl = inviteCodeFromUrl()
    if (fromUrl) setCode(fromUrl)
  }, [])

  useEffect(() => {
    const clean = code.trim()
    if (clean.length < 4) {
      setInviterName(null)
      setStatus((s) => (s === 'valid' ? 'idle' : s))
      return
    }

    const t = setTimeout(async () => {
      try {
        const peek = await peekInviteCode(clean)
        if (peek.valid) {
          setInviterName(peek.inviterName)
          setStatus('valid')
          setError('')
        } else {
          setInviterName(null)
          setStatus('idle')
        }
      } catch {
        setInviterName(null)
      }
    }, 400)

    return () => clearTimeout(t)
  }, [code])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('checking')

    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

    if (bootstrap && !clean) {
      clearInviteFromUrl()
      onContinue?.({ inviteCode: null, bootstrap: true })
      return
    }

    if (!clean) {
      setStatus('invalid')
      setError('Enter an invite code.')
      return
    }

    try {
      const peek = await peekInviteCode(clean)
      if (!peek.valid) {
        setStatus('invalid')
        setError('That code does not work — ask a fren for a fresh one.')
        return
      }
      clearInviteFromUrl()
      onContinue?.({ inviteCode: clean, bootstrap: false, inviterName: peek.inviterName })
    } catch (err) {
      setStatus('invalid')
      setError(err.message || 'Could not check invite code.')
    }
  }

  return (
    <div className="frens-screen relative">
      <ThemeControls className="absolute top-4 right-4" />

      <div className="w-full max-w-md text-center">
        <FrogLogo className="w-[7.2rem] h-[7.2rem] sm:w-[8.4rem] sm:h-[8.4rem] mb-6 mx-auto" />

        <h1 className="text-3xl sm:text-4xl mb-3">WELCOME TO MISAO</h1>
        <p className="text-sm frens-body-text mb-8 max-w-sm mx-auto">
          A pocket for your thoughts.
        </p>

        {gateError && (
          <p className="text-sm text-red-500 dark:text-red-400 mb-4">{gateError}</p>
        )}

        {loadingGate ? (
          <p className="text-sm frens-muted">checking the gate...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {bootstrap && (
              <p className="text-xs frens-hint text-center mb-2">
                You are the first fren here — no invite needed.
              </p>
            )}

            {inviterName && status === 'valid' && (
              <p className="text-xs text-center text-[#6BC06B]">
                Invited by <span className="frens-stat">{inviterName}</span>
              </p>
            )}

            <div>
              <label htmlFor="invite-code" className="block frens-label mb-2">
                Invite code
              </label>
              <input
                id="invite-code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                  setStatus('idle')
                  setError('')
                }}
                placeholder={bootstrap ? 'optional for first fren' : 'XXXXXXXX'}
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                className="frens-input py-3 text-center tracking-widest uppercase"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={status === 'checking' || Boolean(gateError)}
              className="frens-btn-primary w-full px-8 py-4 text-lg disabled:opacity-50"
            >
              {status === 'checking'
                ? 'checking...'
                : bootstrap && !code.trim()
                  ? 'be the first fren'
                  : 'enter'}
            </button>
          </form>
        )}

        {onLogin && (
          <p className="text-center text-sm frens-muted mt-6">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onLogin()}
              className="font-bold underline hover:text-black dark:hover:text-white transition"
            >
              Log in
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
