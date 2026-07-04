import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (loginError) {
      setError(loginError.message)
      return
    }
    navigate('/home')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="cave-card max-w-sm w-full">
        <h2 className="text-2xl text-ember-400 mb-1">welcome back, fren</h2>
        <p className="text-bone-300 text-sm mb-6">good to see you again.</p>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            className="input-cave"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input-cave"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn-ember w-full" disabled={loading}>
            {loading ? 'logging in...' : 'log in'}
          </button>
        </form>

        {error && <p className="text-ember-500 text-sm mt-4">{error}</p>}

        <p className="text-bone-300 text-xs mt-6">
          new here?{' '}
          <Link to="/" className="text-ember-400 underline">
            you'll need an invite
          </Link>
        </p>
      </div>
    </div>
  )
}
