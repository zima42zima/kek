import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no confusing chars like O/0, I/1
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function Home() {
  const { profile, user, signOut } = useAuth()
  const [invite, setInvite] = useState(null)
  const [generating, setGenerating] = useState(false)

  async function handleGenerateInvite() {
    setGenerating(true)
    const code = randomCode()

    const { data, error } = await supabase
      .from('invites')
      .insert({ code, created_by: user.id })
      .select()
      .single()

    setGenerating(false)

    if (error) {
      console.error(error.message)
      return
    }
    setInvite(data.code)
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl text-ember-400">
          FRENS <span className="ember-dot ml-1" />
        </h1>
        <button onClick={signOut} className="btn-ghost text-sm py-1.5 px-3">
          sign out
        </button>
      </header>

      <section className="cave-card mb-6">
        <p className="text-bone-300 text-xs mb-2">you, in here</p>
        <h2 className="text-xl mb-2">{profile?.silly_name || 'nameless fren'}</h2>
        {profile?.current_vibe && (
          <p className="text-ember-400 text-sm mb-1">vibe: {profile.current_vibe}</p>
        )}
        {profile?.one_human_thing && (
          <p className="text-bone-300 text-sm">{profile.one_human_thing}</p>
        )}
        {profile?.favorite_fail && (
          <p className="text-bone-300 text-sm mt-1">fave fail: {profile.favorite_fail}</p>
        )}
      </section>

      <section className="cave-card mb-6">
        <p className="text-bone-300 text-xs mb-3">add a fren</p>
        <button onClick={handleGenerateInvite} className="btn-ember" disabled={generating}>
          {generating ? 'lighting a torch...' : 'generate invite code'}
        </button>
        {invite && (
          <p className="mt-3 text-sm">
            share this code: <span className="text-ember-400 tracking-widest">{invite}</span>
          </p>
        )}
      </section>

      <section className="cave-card border-moss-500/50">
        <p className="text-bone-300 text-sm">
          the feed, THOUGHTS, vent rooms, and kek radio live here next. this is your foundation —
          real accounts, real invites, real profiles. tell your fren (the AI, not the app) what to
          build next.
        </p>
      </section>
    </div>
  )
}
