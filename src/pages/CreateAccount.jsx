import { useEffect, useState } from 'react'
import { supabase, PENDING_PROFILE_KEY, PENDING_INVITE_KEY, PENDING_BOOTSTRAP_KEY, saveFounderProfile } from '../supabaseClient'
import { claimInviteCode } from '../lib/invites'
import { friendlySignupError } from '../lib/onboarding'
import {
  isFrenHandleAvailable,
  normalizeDisplayName,
  normalizeFrenHandle,
  validateDisplayNameFormat,
  validateFrenHandleFormat,
} from '../lib/frenName'
import ThemeControls from '../components/ThemeControls'
import FrogLogo from '../components/FrogLogo'
import CommunityRulesModal from '../components/CommunityRulesModal'

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function fieldBorderClass(ok, touched) {
  if (!touched) return ''
  return ok
    ? 'border-[#6BC06B] focus:border-[#6BC06B]'
    : 'border-black/50 focus:border-black dark:border-white/50 dark:focus:border-white'
}

const CreateAccount = ({
  inviteCode,
  bootstrapSignup = false,
  inviterName = null,
  onAuthenticated,
  onShowLogin,
  onBack,
}) => {
  const [frenHandle, setFrenHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [oneHumanThing, setOneHumanThing] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('form')
  const [handleTouched, setHandleTouched] = useState(false)
  const [handleError, setHandleError] = useState('')
  const [checkingHandle, setCheckingHandle] = useState(false)
  const [handleAvailable, setHandleAvailable] = useState(null)
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [acceptedRules, setAcceptedRules] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const handle = normalizeFrenHandle(frenHandle)
  const trimmedEmail = email.trim()
  const emailValid = isValidEmail(trimmedEmail)
  const passwordValid = password.length >= 8
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const displayLabel = normalizeDisplayName(displayName) || handle

  useEffect(() => {
    if (!handle) {
      setHandleError('')
      setHandleAvailable(null)
      return
    }

    const formatErr = validateFrenHandleFormat(handle)
    if (formatErr) {
      setHandleError(formatErr)
      setHandleAvailable(false)
      return
    }

    setCheckingHandle(true)
    const t = setTimeout(() => {
      isFrenHandleAvailable(handle)
        .then((res) => {
          setHandleAvailable(res.ok)
          setHandleError(res.ok ? '' : res.reason)
        })
        .catch((err) => {
          setHandleAvailable(null)
          setHandleError(err.message)
        })
        .finally(() => setCheckingHandle(false))
    }, 350)

    return () => clearTimeout(t)
  }, [handle])

  function buildSignupProfile() {
    const name = normalizeDisplayName(displayName) || handle
    const displayErr = validateDisplayNameFormat(name)
    if (displayErr) throw new Error(displayErr)
    return {
      frenHandle: handle,
      frenName: name,
      oneHumanThing: oneHumanThing.trim(),
      bio: '',
      avatarType: 'frog',
      shareLocation: false,
    }
  }

  async function finishSignup(user) {
    const pendingRaw = localStorage.getItem(PENDING_PROFILE_KEY)
    const profile = pendingRaw ? JSON.parse(pendingRaw) : buildSignupProfile()
    const isBootstrap = bootstrapSignup || localStorage.getItem(PENDING_BOOTSTRAP_KEY) === '1'
    const code = localStorage.getItem(PENDING_INVITE_KEY) || inviteCode

    if (!isBootstrap) {
      const claimed = await claimInviteCode(code)
      if (!claimed) {
        throw new Error('Invite code could not be claimed. It may already be used — ask for a new one.')
      }
    }

    await saveFounderProfile(user.id, profile, { isFounder: isBootstrap })
    localStorage.removeItem(PENDING_PROFILE_KEY)
    localStorage.removeItem(PENDING_INVITE_KEY)
    localStorage.removeItem(PENDING_BOOTSTRAP_KEY)
    onAuthenticated?.(user)
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user) return
      if (!localStorage.getItem(PENDING_PROFILE_KEY)) return

      try {
        await finishSignup(session.user)
      } catch (err) {
        console.error('Failed to finish signup:', err.message)
        setError(err.message)
      }
    })

    return () => subscription.unsubscribe()
  }, [inviteCode, bootstrapSignup])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setHandleTouched(true)
    setEmailTouched(true)
    setPasswordTouched(true)
    setConfirmTouched(true)

    if (!handle || handleError || handleAvailable === false) {
      setError(handleError || 'Pick an available handle.')
      return
    }

    if (!emailValid) {
      setError('Enter a valid email address.')
      return
    }

    if (!passwordValid) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }

    let profile
    try {
      profile = buildSignupProfile()
    } catch (err) {
      setError(err.message)
      return
    }

    setLoading(true)
    localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(profile))
    if (inviteCode) localStorage.setItem(PENDING_INVITE_KEY, inviteCode)
    if (bootstrapSignup) localStorage.setItem(PENDING_BOOTSTRAP_KEY, '1')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          silly_name: profile.frenName,
          fren_handle: profile.frenHandle,
        },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(friendlySignupError(signUpError.message))
      return
    }

    if (!data.user) {
      setError('Something went wrong. Please try again.')
      return
    }

    if (data.session) {
      try {
        await finishSignup(data.user)
      } catch (err) {
        setError(err.message)
      }
      return
    }

    setStep('success')
  }

  async function handleEmailConfirmed() {
    setError('')
    setCheckingEmail(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError('No session yet — tap the confirm link in your email first.')
        return
      }
      await finishSignup(session.user)
    } catch (err) {
      setError(err.message || 'Could not finish signup.')
    } finally {
      setCheckingEmail(false)
    }
  }

  const canSubmit = Boolean(
    handle
    && !handleError
    && handleAvailable === true
    && !checkingHandle
    && emailValid
    && passwordValid
    && passwordsMatch
    && acceptedRules,
  )

  if (step === 'success') {
    return (
      <div className="frens-screen relative">
        <ThemeControls className="absolute top-4 right-4" />

        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl sm:text-4xl mb-4">Check your email</h1>
          <p className="text-lg frens-body-text mb-2">Confirm your email to enter the cave</p>
          <p className="text-sm frens-muted mb-2">
            Signing up as <span className="frens-stat">{displayLabel}</span>
            {' '}
            <span className="frens-muted">(@{handle})</span>
          </p>
          <p className="text-sm frens-muted mb-8">
            We sent a link to <span className="frens-stat">{trimmedEmail}</span>.
          </p>
          {error && <p className="text-sm text-red-500 dark:text-red-400 mb-4">{error}</p>}
          <button
            type="button"
            onClick={handleEmailConfirmed}
            disabled={checkingEmail}
            className="frens-btn-primary w-full px-8 py-4 text-lg disabled:opacity-50"
          >
            {checkingEmail ? 'Checking...' : 'I confirmed my email'}
          </button>
          <p className="text-xs frens-muted mt-4">
            Wrong email?{' '}
            <button
              type="button"
              onClick={() => { setStep('form'); setError('') }}
              className="underline hover:text-black dark:hover:text-white"
            >
              Go back
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="frens-screen relative">
      <ThemeControls className="absolute top-4 right-4" />

      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-4">
          <FrogLogo className="w-10 h-10 shrink-0" alt="" />
          <h1 className="text-3xl sm:text-4xl text-center">Sign up</h1>
        </div>
        {inviterName && (
          <p className="text-sm frens-muted text-center mb-6">
            <span className="frens-stat">{inviterName}</span> invited you in.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="fren-handle" className="block frens-label mb-2">
              Handle <span className="frens-hint">(permanent)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm frens-muted pointer-events-none">@</span>
              <input
                id="fren-handle"
                type="text"
                value={frenHandle}
                onChange={(e) => setFrenHandle(e.target.value)}
                onBlur={() => setHandleTouched(true)}
                placeholder="lenchi"
                autoComplete="username"
                spellCheck={false}
                className={`frens-input w-full py-3 pl-7 ${fieldBorderClass(handleAvailable === true && !handleError, handleTouched && Boolean(handle))}`}
                required
              />
            </div>
            {checkingHandle && handle && (
              <p className="text-xs frens-muted mt-1">checking availability…</p>
            )}
            {!checkingHandle && handleTouched && handle && handleAvailable === true && !handleError && (
              <p className="text-xs text-[#6BC06B] mt-1">✓ available</p>
            )}
            {handleTouched && handleError && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">{handleError}</p>
            )}
            <p className="text-xs frens-hint mt-2">
              Friends find you with @handle. Tied to your email — cannot change later.
            </p>
          </div>

          <div>
            <label htmlFor="display-name" className="block frens-label mb-2">
              Display name <span className="frens-hint">(optional)</span>
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Lenchi, unga bunga, …"
              className="frens-input py-3"
            />
            <p className="text-xs frens-hint mt-2">What shows on posts — change anytime in settings.</p>
          </div>

          <div>
            <label htmlFor="one-human-thing" className="block frens-label mb-2">
              One human thing <span className="frens-hint">(optional)</span>
            </label>
            <textarea
              id="one-human-thing"
              value={oneHumanThing}
              onChange={(e) => setOneHumanThing(e.target.value)}
              placeholder="I cried because my toast landed butter side down"
              rows={2}
              className="frens-input"
            />
          </div>

          <div>
            <label htmlFor="email" className="block frens-label mb-2">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@example.com"
              autoComplete="email"
              className={`frens-input py-3 ${fieldBorderClass(emailValid, emailTouched && trimmedEmail.length > 0)}`}
              required
            />
            {emailTouched && trimmedEmail.length > 0 && (
              <p className={`text-xs mt-1 ${emailValid ? 'text-[#6BC06B]' : 'text-red-500 dark:text-red-400'}`}>
                {emailValid ? '✓ Looks good' : 'Enter a valid email address'}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block frens-label mb-2">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`frens-input py-3 ${fieldBorderClass(passwordValid, passwordTouched && password.length > 0)}`}
              required
            />
            {password.length > 0 && (
              <p className={`text-xs mt-1 ${passwordValid ? 'text-[#6BC06B]' : 'text-red-500 dark:text-red-400'}`}>
                {passwordValid ? '✓ Password length OK' : `${password.length}/8 characters`}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block frens-label mb-2">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setConfirmTouched(true)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`frens-input py-3 ${fieldBorderClass(passwordsMatch, confirmTouched && confirmPassword.length > 0)}`}
              required
            />
            {confirmTouched && confirmPassword.length > 0 && (
              <p className={`text-xs mt-1 ${passwordsMatch ? 'text-[#6BC06B]' : 'text-red-500 dark:text-red-400'}`}>
                {passwordsMatch ? '✓ Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedRules}
              onChange={(e) => setAcceptedRules(e.target.checked)}
              className="mt-1 shrink-0"
            />
            <span className="text-xs frens-body-text leading-relaxed">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => setShowRules(true)}
                className="underline hover:text-black dark:hover:text-white"
              >
                Community rules
              </button>
              {' '}— no harassment, nudity, threats, or illegal activity.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="frens-btn-primary w-full px-8 py-4 text-lg disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm frens-muted mt-6">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onShowLogin?.()}
            className="underline hover:text-black dark:hover:text-white transition"
          >
            Log in
          </button>
        </p>

        {onBack && (
          <p className="text-center text-sm frens-muted mt-3">
            <button
              type="button"
              onClick={onBack}
              className="underline hover:text-black dark:hover:text-white transition"
            >
              Back to invite gate
            </button>
          </p>
        )}
      </div>

      <CommunityRulesModal open={showRules} onClose={() => setShowRules(false)} />
    </div>
  )
}

export default CreateAccount
