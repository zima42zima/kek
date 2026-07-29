import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import InviteGate from './pages/InviteGate'
import CreateAccount from './pages/CreateAccount'
import OnboardingSuccess from './pages/OnboardingSuccess'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import { BrowserRouter } from 'react-router-dom'
import Home from './pages/Home'
import {
  PENDING_BOOTSTRAP_KEY,
  PENDING_INVITE_KEY,
  PENDING_PROFILE_KEY,
} from './supabaseClient'

const ONBOARDING_DRAFT_KEY = 'frens-onboarding-draft'

function clearSignupDraft() {
  try {
    sessionStorage.removeItem(ONBOARDING_DRAFT_KEY)
    localStorage.removeItem(PENDING_PROFILE_KEY)
    localStorage.removeItem(PENDING_INVITE_KEY)
    localStorage.removeItem(PENDING_BOOTSTRAP_KEY)
  } catch { /* ignore */ }
}

function App() {
  const { session, loading, profile, refreshProfile, passwordRecovery, clearPasswordRecovery } = useAuth()
  const [screen, setScreen] = useState('invite')
  const [inviteCode, setInviteCode] = useState(null)
  const [bootstrapSignup, setBootstrapSignup] = useState(false)
  const [inviterName, setInviterName] = useState(null)
  const [draftLoaded, setDraftLoaded] = useState(false)

  useEffect(() => {
    if (draftLoaded || session?.user) return
    try {
      const raw = sessionStorage.getItem(ONBOARDING_DRAFT_KEY)
      if (!raw) {
        setDraftLoaded(true)
        return
      }
      const draft = JSON.parse(raw)
      if (draft.inviteCode !== undefined) setInviteCode(draft.inviteCode)
      if (draft.bootstrapSignup) setBootstrapSignup(true)
      if (draft.inviterName) setInviterName(draft.inviterName)
      if (draft.screen === 'create-account') setScreen('create-account')
    } catch { /* ignore */ }
    setDraftLoaded(true)
  }, [draftLoaded, session])

  useEffect(() => {
    if (session?.user) return
    if (screen !== 'create-account') return
    try {
      sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({
        inviteCode,
        bootstrapSignup,
        inviterName,
        screen,
      }))
    } catch { /* ignore */ }
  }, [screen, inviteCode, bootstrapSignup, inviterName, session])

  useEffect(() => {
    if (loading) return

    if (!session?.user) {
      setScreen((prev) => (prev === 'home' || prev === 'success' ? 'invite' : prev))
      setInviteCode(null)
      setBootstrapSignup(false)
      setInviterName(null)
      return
    }

    // Returning login → home. Signup stays on create-account until profile is saved.
    setScreen((prev) => {
      if (prev === 'success' || prev === 'create-account') return prev
      if (['invite', 'login', 'forgot-password'].includes(prev)) return 'home'
      return prev
    })
  }, [loading, session])

  if (loading) {
    return (
      <div className="frens-screen">
        <p className="frens-muted text-sm">loading...</p>
      </div>
    )
  }

  if (passwordRecovery && session?.user) {
    return (
      <ResetPassword
        onDone={async () => {
          clearPasswordRecovery()
          await refreshProfile()
          setScreen('home')
        }}
      />
    )
  }

  if (session?.user && screen === 'home') {
    return (
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )
  }

  if (screen === 'success' && session?.user) {
    return (
      <OnboardingSuccess
        profile={profile}
        bootstrapSignup={bootstrapSignup}
        inviterName={inviterName}
        onContinue={() => setScreen('home')}
      />
    )
  }

  if (screen === 'forgot-password') {
    return <ForgotPassword onBack={() => setScreen('login')} />
  }

  if (screen === 'login') {
    return (
      <Login
        onSuccess={async () => {
          clearSignupDraft()
          await refreshProfile()
          setScreen('home')
        }}
        onForgotPassword={() => setScreen('forgot-password')}
        onBack={() => setScreen('invite')}
      />
    )
  }

  if (screen === 'create-account') {
    return (
      <CreateAccount
        inviteCode={inviteCode}
        bootstrapSignup={bootstrapSignup}
        inviterName={inviterName}
        onAuthenticated={async () => {
          clearSignupDraft()
          await refreshProfile()
          setScreen('success')
        }}
        onShowLogin={() => setScreen('login')}
        onBack={() => setScreen('invite')}
      />
    )
  }

  if (session?.user) {
    return (
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )
  }

  return (
    <InviteGate
      onContinue={({ inviteCode: code, bootstrap, inviterName: name }) => {
        setInviteCode(code)
        setBootstrapSignup(Boolean(bootstrap))
        setInviterName(name || null)
        setScreen('create-account')
      }}
      onLogin={() => setScreen('login')}
    />
  )
}

export default App
