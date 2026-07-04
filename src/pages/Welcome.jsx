import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Welcome() {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | valid | invalid
  const navigate = useNavigate()

  async function checkCode(e) {
    e.preventDefault()
    setStatus('checking')

    const cleanCode = code.trim().toUpperCase()

    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('code', cleanCode)
      .is('used_by', null)
      .maybeSingle()

    if (error) {
      console.error(error.message)
      setStatus('invalid')
      return
    }

    if (!data) {
      setStatus('invalid')
      return
    }

    setStatus('valid')
    // pass the valid code forward to the signup page
    navigate('/signup', { state: { inviteCode: cleanCode } })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="cave-card max-w-sm w-full text-center">
        <h1 className="text-3xl mb-1 text-ember-400">FRENS</h1>
        <p className="text-bone-300 text-sm mb-6">
          a small, human-only cave. <span className="ember-dot" /> no clout, no ads, just frens.
        </p>

        <form onSubmit={checkCode} className="space-y-3">
          <input
            className="input-cave text-center tracking-widest uppercase"
            placeholder="invite code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={12}
            required
          />
          <button type="submit" className="btn-ember w-full" disabled={status === 'checking'}>
            {status === 'checking' ? 'checking...' : 'enter the cave'}
          </button>
        </form>

        {status === 'invalid' && (
          <p className="text-ember-500 text-sm mt-4">
            that code doesn't work — ask a fren for a fresh one.
          </p>
        )}

        <p className="text-bone-300 text-xs mt-6">
          already have an account?{' '}
          <Link to="/login" className="text-ember-400 underline">
            log in
          </Link>
        </p>
      </div>
    </div>
  )
}
