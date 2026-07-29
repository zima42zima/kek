import { PENDING_PROFILE_KEY } from '../supabaseClient'
import { APP_NAME } from './brand'

export function isProfileComplete(profile) {
  if (!profile?.id) return false
  const name = String(profile.frenName || '').trim()
  if (!name || name.toLowerCase() === 'nameless fren') return false
  return true
}

/** Resume mid-signup only — never shown to returning logins with a saved profile. */
export function getResumeOnboardingScreen(profile) {
  if (isProfileComplete(profile)) return 'home'
  try {
    if (localStorage.getItem(PENDING_PROFILE_KEY)) return 'create-account'
  } catch { /* ignore */ }
  return 'create-account'
}

export function friendlyLoginError(message = '') {
  const msg = String(message)
  if (/email not confirmed/i.test(msg)) {
    return `Confirm your email first — check your inbox for the ${APP_NAME} link.`
  }
  if (/invalid login credentials/i.test(msg)) {
    return 'Wrong email or password.'
  }
  if (/user already registered/i.test(msg)) {
    return 'An account with this email already exists — log in instead.'
  }
  return msg || 'Could not log in.'
}

export function friendlySignupError(message = '') {
  const msg = String(message)
  if (/user already registered/i.test(msg)) {
    return 'An account with this email already exists — log in instead.'
  }
  if (/password/i.test(msg) && /short|least/i.test(msg)) {
    return 'Password must be at least 8 characters.'
  }
  return msg || 'Could not create account.'
}
