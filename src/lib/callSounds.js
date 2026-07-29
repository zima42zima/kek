/**
 * Synthesized call ringtone / ringback (Web Audio — no asset files).
 * Incoming: dual-tone loop. Outgoing: softer ringback.
 */

let ctx = null
let active = null
let unlocked = false

function getCtx() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  return ctx
}

/** Call after any user tap so incoming rings can autoplay later. */
export function unlockCallAudio() {
  if (unlocked) return
  const c = getCtx()
  if (!c) return
  unlocked = true
  if (c.state === 'suspended') c.resume().catch(() => {})
  try {
    const g = c.createGain()
    g.gain.value = 0.0001
    g.connect(c.destination)
    const o = c.createOscillator()
    o.connect(g)
    o.start()
    o.stop(c.currentTime + 0.01)
  } catch {
    // ignore
  }
}

export function stopRingtone() {
  if (!active) return
  clearTimeout(active.refreshTimer)
  try {
    const { c, gain, oscs } = active
    gain.gain.cancelScheduledValues(c.currentTime)
    gain.gain.setValueAtTime(0, c.currentTime)
    oscs.forEach((o) => {
      try { o.stop() } catch { /* already stopped */ }
    })
    gain.disconnect()
  } catch {
    // ignore
  }
  active = null
}

/**
 * @param {'incoming' | 'outgoing'} kind
 */
export function startRingtone(kind = 'incoming') {
  stopRingtone()
  const c = getCtx()
  if (!c) return

  const run = () => {
    const master = c.createGain()
    master.gain.value = 0
    master.connect(c.destination)

    const freqs = kind === 'outgoing' ? [440, 480] : [480, 620]
    const volume = kind === 'outgoing' ? 0.08 : 0.14
    const onSec = kind === 'outgoing' ? 0.9 : 1.0
    const cycle = kind === 'outgoing' ? 2.9 : 3.2

    const oscs = freqs.map((f) => {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(master)
      o.start()
      return o
    })

    const schedule = (fromTime, cycles) => {
      for (let i = 0; i < cycles; i += 1) {
        const start = fromTime + i * cycle
        master.gain.setValueAtTime(0, start)
        master.gain.linearRampToValueAtTime(volume, start + 0.04)
        master.gain.setValueAtTime(volume, start + onSec - 0.05)
        master.gain.linearRampToValueAtTime(0, start + onSec)
      }
    }

    schedule(c.currentTime + 0.02, 8)

    const state = { c, gain: master, oscs, kind, refreshTimer: null }
    active = state

    const refresh = () => {
      if (active !== state) return
      schedule(c.currentTime + 0.05, 6)
      state.refreshTimer = setTimeout(refresh, cycle * 4 * 1000)
    }
    state.refreshTimer = setTimeout(refresh, cycle * 4 * 1000)
  }

  if (c.state === 'suspended') {
    c.resume().then(run).catch(() => {})
  } else {
    run()
  }
}
