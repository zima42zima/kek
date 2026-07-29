import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { setupRealtimeAuth } from '../lib/realtime'
import { fetchProfileForUser } from '../lib/profile'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  async function loadProfile(userId, email) {
    try {
      return await fetchProfileForUser(userId, email)
    } catch (error) {
      console.error('Error loading profile:', error.message)
      return null
    }
  }

  useEffect(() => {
    supabase.auth.getUser()
      .then(async ({ data: { user } }) => {
        if (user) {
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          setupRealtimeAuth(currentSession?.access_token ?? null)
          setSession(currentSession)
          const p = await loadProfile(user.id, user.email)
          setProfile(p)
        } else {
          setSession(null)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
      }
      setupRealtimeAuth(nextSession?.access_token ?? null)
      setSession(nextSession)
      if (nextSession?.user) {
        const p = await loadProfile(nextSession.user.id, nextSession.user.email)
        setProfile(p)
      } else {
        setProfile(null)
        setPasswordRecovery(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function refreshProfile() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    const { data: { session: currentSession } } = await supabase.auth.getSession()
    setSession(currentSession)

    const p = await loadProfile(user.id, user.email)
    setProfile(p)
    return p
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setPasswordRecovery(false)
  }

  function clearPasswordRecovery() {
    setPasswordRecovery(false)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    passwordRecovery,
    refreshProfile,
    signOut,
    clearPasswordRecovery,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
