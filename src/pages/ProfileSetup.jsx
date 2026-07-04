import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function ProfileSetup() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [sillyName, setSillyName] = useState('')
  const [oneHumanThing, setOneHumanThing] = useState('')
  const [favoriteFail, setFavoriteFail] = useState('')
  const [currentVibe, setCurrentVibe] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      silly_name: sillyName,
      one_human_thing: oneHumanThing,
      favorite_fail: favoriteFail,
      current_vibe: currentVibe,
    })

    setLoading(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    await refreshProfile()
    navigate('/home')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="cave-card max-w-sm w-full">
        <h2 className="text-2xl text-ember-400 mb-1">who are you in here?</h2>
        <p className="text-bone-300 text-sm mb-6">
          no stats, no clout. just the fun stuff.
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <input
            className="input-cave"
            placeholder="silly name (what frens call you)"
            value={sillyName}
            onChange={(e) => setSillyName(e.target.value)}
            required
          />
          <input
            className="input-cave"
            placeholder="one human thing about you"
            value={oneHumanThing}
            onChange={(e) => setOneHumanThing(e.target.value)}
          />
          <input
            className="input-cave"
            placeholder="your favorite fail"
            value={favoriteFail}
            onChange={(e) => setFavoriteFail(e.target.value)}
          />
          <input
            className="input-cave"
            placeholder="current vibe"
            value={currentVibe}
            onChange={(e) => setCurrentVibe(e.target.value)}
          />
          <button type="submit" className="btn-ember w-full" disabled={loading}>
            {loading ? 'saving...' : 'step into the cave'}
          </button>
        </form>

        {error && <p className="text-ember-500 text-sm mt-4">{error}</p>}
      </div>
    </div>
  )
}
