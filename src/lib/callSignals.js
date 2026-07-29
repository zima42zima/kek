import { supabase } from '../supabaseClient'

export class CallsNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new CallsNotInstalledError(error.message)
  }
}

export async function sendCallSignal(toUserId, callId, signalType, payload = {}) {
  const { error } = await supabase.rpc('send_dm_call_signal', {
    p_to: toUserId,
    p_call_id: callId,
    p_signal_type: signalType,
    p_payload: payload,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function pollCallSignals(sinceIso) {
  const { data, error } = await supabase.rpc('poll_dm_call_signals', {
    p_since: sinceIso || new Date(Date.now() - 600_000).toISOString(),
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data ?? []
}
