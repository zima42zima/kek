import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function SignUp() {
  const location = useLocation()
  const navigate = useNavigate()
  const inviteCode = location.state?.inviteCode

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // if someone lands here without going through the gate, send them back
  if (!inviteCode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="cave-card max-w-sm w-full text-center">
          <p className="text-bone-100 mb-4">you need an invite code first.</p>
          <Link to="/" className="btn-ghost inline-block">
            back to the gate
          </Link>
        </div>
      </div>
    )
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const newUser = data.user
    if (!newUser) {
      setError('Something went wrong creating your account. Try again.')
      setLoading(false)
      return
    }

    // mark the invite code as used by this new human
    await supabase
      .from('invites')
      .update({ used_by: newUser.id, used_at: new Date().toISOString() })
      .eq('code', inviteCode)

    setLoading(false)
    navigate('/profile-setup')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="cave-card max-w-sm w-full">
        <h2 className="text-2xl text-ember-400 mb-1">welcome, fren</h2>
        <p className="text-bone-300 text-sm mb-6">your code checked out. let's make you an account.</p>

        <form onSubmit={handleSignUp} className="space-y-3">
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
            placeholder="password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit" className="btn-ember w-full" disabled={loading}>
            {loading ? 'creating account...' : 'join the cave'}
          </button>
        </form>

        {error && <p className="text-ember-500 text-sm mt-4">{error}</p>}
      </div>
    </div>
  )
}
