import { supabase } from '../supabaseClient'

export class InvitesNotInstalledError extends Error {
  constructor() {
    super('Invite functions not installed. Run supabase-patch-onboarding.sql in Supabase SQL Editor.')
    this.name = 'InvitesNotInstalledError'
  }
}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202') throw new InvitesNotInstalledError()
}

export async function signupGateOpen() {
  const { data, error } = await supabase.rpc('signup_gate_open')
  if (error) {
    throwIfNotInstalled(error)
    return false
  }
  return Boolean(data)
}

export async function validateInviteCode(code) {
  const peek = await peekInviteCode(code)
  return peek.valid
}

export async function peekInviteCode(code) {
  const clean = normalizeInviteCode(code)
  if (!clean) return { valid: false, inviterName: null }

  const { data, error } = await supabase.rpc('peek_invite', { p_code: clean })
  if (error) {
    if (error.code === 'PGRST202') {
      const valid = await validateInviteLegacy(clean)
      return { valid, inviterName: null }
    }
    throwIfNotInstalled(error)
    console.error('peek_invite:', error.message)
    return { valid: false, inviterName: null }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.valid) return { valid: false, inviterName: null }
  return { valid: true, inviterName: row.inviter_name || null }
}

async function validateInviteLegacy(clean) {
  const { data, error } = await supabase.rpc('validate_invite', { p_code: clean })
  if (error) {
    throwIfNotInstalled(error)
    return false
  }
  return Boolean(data)
}

function normalizeInviteCode(code) {
  return (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function claimInviteCode(code) {
  const clean = normalizeInviteCode(code)
  const { data, error } = await supabase.rpc('claim_invite', { p_code: clean || null })
  if (error) {
    throwIfNotInstalled(error)
    throw new Error(error.message)
  }
  return Boolean(data)
}

export async function getInviteDailyQuota() {
  const { data, error } = await supabase.rpc('get_invite_daily_quota')
  if (error?.code === 'PGRST202') {
    return { dailyLimit: 3, createdLast24h: 0, remaining: 3, resetsAt: null }
  }
  if (error) {
    throwIfNotInstalled(error)
    throw new Error(error.message)
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    dailyLimit: Number(row?.daily_limit ?? 3),
    createdLast24h: Number(row?.created_last_24h ?? 0),
    remaining: Number(row?.remaining ?? 3),
    resetsAt: row?.resets_at ?? null,
  }
}

export async function createInviteCode() {
  const { data, error } = await supabase.rpc('create_invite_code')
  if (error) {
    throwIfNotInstalled(error)
    throw new Error(error.message)
  }
  return data
}

export async function listMyInvites() {
  const { data, error } = await supabase.rpc('list_my_invites')
  if (error) {
    throwIfNotInstalled(error)
    throw new Error(error.message)
  }
  return data || []
}
