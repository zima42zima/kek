import { useState } from 'react'
import { supabase } from '../supabaseClient'
import ThemeControls from '../components/ThemeControls'
import { friendlyLoginError } from '../lib/onboarding'

export default function Login({ onSuccess, onBack, onForgotPassword }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)

    if (loginError) {
      setError(friendlyLoginError(loginError.message))
      return
    }

    onSuccess?.(data.user)
  }

  return (
    <div className="frens-screen relative">
      <ThemeControls className="absolute top-4 right-4" />

      <div className="w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl mb-2 text-center">Welcome back, fren</h1>
        <p className="text-sm frens-muted text-center mb-8">
          Log in with the email you signed up with.
        </p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="login-email" className="block frens-label mb-2">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="frens-input py-3"
              required
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <label htmlFor="login-password" className="block frens-label">
                Password
              </label>
              {onForgotPassword && (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs frens-muted underline hover:text-black dark:hover:text-white transition"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        {onBack && (
          <p className="text-center text-sm frens-muted mt-6">
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
    </div>
  )
}
