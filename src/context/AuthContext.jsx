import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { setupRealtimeAuth } from '../lib/realtime'
import { fetchProfileForUser } from '../lib/profile'
import { getMyAccountStatus } from '../lib/platformModeration'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [accountStatus, setAccountStatus] = useState(null)
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

  async function loadAccountStatus() {
    try {
      return await getMyAccountStatus()
    } catch {
      return null
    }
  }

  async function loadUserBundle(user) {
    const p = await loadProfile(user.id, user.email)
    setProfile(p)
    const status = await loadAccountStatus()
    setAccountStatus(status)
  }

  useEffect(() => {
    supabase.auth.getUser()
      .then(async ({ data: { user } }) => {
        if (user) {
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          setupRealtimeAuth(currentSession?.access_token ?? null)
          setSession(currentSession)
          await loadUserBundle(user)
        } else {
          setSession(null)
          setAccountStatus(null)
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
        await loadUserBundle(nextSession.user)
      } else {
        setProfile(null)
        setAccountStatus(null)
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
    const status = await loadAccountStatus()
    setAccountStatus(status)
    return p
  }

  async function refreshAccountStatus() {
    const status = await loadAccountStatus()
    setAccountStatus(status)
    return status
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setAccountStatus(null)
    setPasswordRecovery(false)
  }

  function clearPasswordRecovery() {
    setPasswordRecovery(false)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    accountStatus,
    loading,
    passwordRecovery,
    refreshProfile,
    refreshAccountStatus,
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
