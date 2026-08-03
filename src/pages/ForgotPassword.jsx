import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { APP_NAME } from '../lib/brand'
import ThemeControls from '../components/ThemeControls'

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const trimmed = email.trim()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: window.location.origin,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="frens-screen relative">
        <ThemeControls className="absolute top-4 right-4" />

        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl sm:text-4xl mb-4">Check your email</h1>
          <p className="text-sm frens-body-text mb-2">
            If <span className="frens-stat">{email.trim()}</span> has a {APP_NAME} account,
            we sent a password reset link.
          </p>
          <p className="text-xs frens-muted mb-8">
            Open the link on this device, then choose a new password.
          </p>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="frens-btn-primary px-8 py-4 text-lg"
            >
              Back to log in
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="frens-screen relative">
      <ThemeControls className="absolute top-4 right-4" />

      <div className="w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl mb-2 text-center">Forgot password?</h1>
        <p className="text-sm frens-muted text-center mb-8">
          Enter your email and we&apos;ll send a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="forgot-email" className="block frens-label mb-2">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="frens-input py-3"
              required
            />
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="frens-btn-primary w-full px-8 py-4 text-lg disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        {onBack && (
          <p className="text-center text-sm frens-muted mt-6">
            <button
              type="button"
              onClick={onBack}
              className="underline hover:text-black dark:hover:text-white transition"
            >
              Back to log in
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
