import { useState } from 'react'
import { supabase } from '../supabaseClient'
import ThemeControls from '../components/ThemeControls'

function inputBorderClass(isValid, touched) {
  if (!touched) return ''
  return isValid
    ? 'border-[#6BC06B] focus:border-[#6BC06B]'
    : 'border-black/50 focus:border-black dark:border-white/50 dark:focus:border-white'
}

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)

  const passwordValid = password.length >= 8
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setPasswordTouched(true)
    setConfirmTouched(true)

    if (!passwordValid) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    onDone?.()
  }

  return (
    <div className="frens-screen relative">
      <ThemeControls className="absolute top-4 right-4" />

      <div className="w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl mb-2 text-center">New password</h1>
        <p className="text-sm frens-muted text-center mb-8">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="reset-password" className="block frens-label mb-2">
              New password
            </label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`frens-input py-3 ${inputBorderClass(passwordValid, passwordTouched && password.length > 0)}`}
              required
            />
            <p className="text-xs frens-hint mt-2">At least 8 characters</p>
          </div>

          <div>
            <label htmlFor="reset-confirm" className="block frens-label mb-2">
              Confirm password
            </label>
            <input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setConfirmTouched(true)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`frens-input py-3 ${inputBorderClass(passwordsMatch, confirmTouched && confirmPassword.length > 0)}`}
              required
            />
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !passwordValid || !passwordsMatch}
            className="frens-btn-primary w-full px-8 py-4 text-lg disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
