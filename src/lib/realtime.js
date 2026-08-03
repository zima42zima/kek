import { supabase } from '../supabaseClient'

/** Supabase Realtime needs the JWT for broadcast channels to work reliably. */
export function setupRealtimeAuth(accessToken) {
  if (!accessToken) return
  supabase.realtime.setAuth(accessToken)
}

/** Wait until a Realtime channel is actually subscribed. */
export function waitForChannel(ch, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Realtime connection timed out — check Realtime is enabled in Supabase'))
    }, timeoutMs)
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve()
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(err?.message || `Realtime ${status}`))
      }
    })
  })
}

export function createCallChannel(name) {
  return supabase.channel(name, {
    config: {
      broadcast: { self: false, ack: false },
      private: false,
    },
  })
}

export function toSdpInit(desc) {
  if (!desc) return null
  return { type: desc.type, sdp: desc.sdp }
}
