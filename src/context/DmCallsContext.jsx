import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useAuth } from './AuthContext'
import {
  sendCallSignal,
  pollCallSignals,
  CallsNotInstalledError,
} from '../lib/callSignals'
import { toSdpInit } from '../lib/realtime'
import {
  ICE_SERVERS,
  canUseMedia,
  getCallMedia,
  mediaErrorMessage,
  stopStream,
  toggleTrack,
} from '../lib/webrtc'
import {
  startRingtone,
  stopRingtone,
  unlockCallAudio,
} from '../lib/callSounds'

const DmCallsContext = createContext(undefined)
const RING_MS = 45000
const POLL_MS = 350

const USER_SIGNALS = new Set(['ring', 'accept', 'decline', 'busy', 'end'])
const SESSION_SIGNALS = new Set(['offer', 'answer', 'ice'])

export function DmCallsProvider({ children }) {
  const { user, profile } = useAuth()
  const meId = user?.id ?? null
  const profileRef = useRef(profile)
  profileRef.current = profile

  const [call, setCall] = useState(null)
  const callRef = useRef(null)
  callRef.current = call

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const ringTimerRef = useRef(null)
  const makingOfferRef = useRef(false)
  const seenSignalIdsRef = useRef(new Set())
  const pollSinceRef = useRef(new Date().toISOString())

  const cleanupMedia = useCallback(() => {
    stopRingtone()
    stopStream(localStreamRef.current)
    localStreamRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    makingOfferRef.current = false
  }, [])

  const signal = useCallback(async (toUserId, callId, signalType, payload = {}) => {
    await sendCallSignal(toUserId, callId, signalType, payload)
  }, [])

  const endCall = useCallback(async (reason = 'ended') => {
    clearTimeout(ringTimerRef.current)
    stopRingtone()
    const current = callRef.current
    if (current?.peerId && current?.id) {
      try {
        await signal(current.peerId, current.id, 'end', { reason })
      } catch (err) {
        console.error('End-call signal failed:', err.message)
      }
    }
    cleanupMedia()
    setCall((prev) => (prev ? { ...prev, status: 'ended', endReason: reason } : null))
    setTimeout(() => setCall(null), 1200)
  }, [cleanupMedia, signal])

  const attachRemote = useCallback((stream) => {
    setCall((prev) => (prev ? { ...prev, remoteStream: stream, status: 'active' } : prev))
  }, [])

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pc.onicecandidate = (e) => {
      const current = callRef.current
      if (!e.candidate || !current) return
      signal(current.peerId, current.id, 'ice', {
        candidate: e.candidate.toJSON(),
      }).catch((err) => console.error('ICE signal failed:', err.message))
    }
    pc.ontrack = (e) => {
      if (e.streams?.[0]) attachRemote(e.streams[0])
    }
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'failed') endCall('error')
      if (state === 'closed') endCall('ended')
    }
    pcRef.current = pc
    return pc
  }, [attachRemote, endCall, signal])

  const addLocalTracks = useCallback((pc, stream) => {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))
  }, [])

  const handleSessionSignal = useCallback(async (payload) => {
    const current = callRef.current
    if (!current || payload.callId !== current.id) return
    if (payload.from === meId) return

    try {
      if (payload.type === 'offer') {
        let pc = pcRef.current
        if (!pc) {
          pc = createPeerConnection()
          if (localStreamRef.current) addLocalTracks(pc, localStreamRef.current)
        }
        await pc.setRemoteDescription(toSdpInit(payload.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await signal(current.peerId, current.id, 'answer', {
          sdp: toSdpInit(pc.localDescription),
        })
        setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev))
      } else if (payload.type === 'answer') {
        const pc = pcRef.current
        if (!pc || pc.signalingState !== 'have-local-offer') return
        await pc.setRemoteDescription(toSdpInit(payload.sdp))
        setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev))
      } else if (payload.type === 'ice' && payload.candidate) {
        const pc = pcRef.current
        if (!pc) return
        try {
          await pc.addIceCandidate(payload.candidate)
        } catch {
          // ICE can arrive before remote description
        }
      }
    } catch (err) {
      console.error('Call signaling error:', err.message)
      endCall('error')
    }
  }, [addLocalTracks, createPeerConnection, endCall, meId, signal])

  const startOffer = useCallback(async () => {
    const current = callRef.current
    if (!current || makingOfferRef.current) return
    makingOfferRef.current = true
    try {
      const pc = createPeerConnection()
      if (localStreamRef.current) addLocalTracks(pc, localStreamRef.current)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await signal(current.peerId, current.id, 'offer', {
        sdp: toSdpInit(pc.localDescription),
      })
      setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev))
    } catch (err) {
      console.error('Could not start offer:', err.message)
      endCall('error')
    } finally {
      makingOfferRef.current = false
    }
  }, [addLocalTracks, createPeerConnection, endCall, signal])

  const handleUserSignal = useCallback(async (payload) => {
    if (!meId || payload.from === meId) return

    if (payload.type === 'ring') {
      if (callRef.current) {
        await signal(payload.from, payload.callId, 'busy', {})
        return
      }
      setCall({
        id: payload.callId,
        status: 'incoming',
        type: payload.callType || 'audio',
        conversationId: payload.conversationId,
        peerId: payload.from,
        peerName: payload.callerName || 'a fren',
        peerAvatarType: payload.callerAvatarType || 'frog',
        peerAvatarUrl: payload.callerAvatarUrl || null,
        isOutgoing: false,
        muted: false,
        videoOff: payload.callType !== 'video',
      })
      startRingtone('incoming')
      return
    }

    const current = callRef.current
    if (!current || payload.callId !== current.id) return

    if (payload.type === 'accept') {
      clearTimeout(ringTimerRef.current)
      stopRingtone()
      if (current.isOutgoing) await startOffer()
      setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev))
    } else if (payload.type === 'decline') {
      stopRingtone()
      cleanupMedia()
      setCall((prev) => (prev ? { ...prev, status: 'ended', endReason: 'declined' } : null))
      setTimeout(() => setCall(null), 1200)
    } else if (payload.type === 'busy') {
      stopRingtone()
      cleanupMedia()
      setCall((prev) => (prev ? { ...prev, status: 'ended', endReason: 'busy' } : null))
      setTimeout(() => setCall(null), 1200)
    } else if (payload.type === 'end') {
      stopRingtone()
      cleanupMedia()
      setCall((prev) => (prev ? { ...prev, status: 'ended', endReason: payload.reason || 'ended' } : null))
      setTimeout(() => setCall(null), 1200)
    }
  }, [cleanupMedia, meId, signal, startOffer])

  const processSignalRow = useCallback(async (row) => {
    if (!row?.id || seenSignalIdsRef.current.has(row.id)) return
    seenSignalIdsRef.current.add(row.id)

    const payload = {
      ...(row.payload || {}),
      type: row.signal_type,
      callId: row.call_id,
      from: row.from_user,
      to: meId,
    }

    if (USER_SIGNALS.has(row.signal_type)) {
      await handleUserSignal(payload)
    } else if (SESSION_SIGNALS.has(row.signal_type)) {
      await handleSessionSignal(payload)
    }
  }, [handleSessionSignal, handleUserSignal, meId])

  useEffect(() => {
    if (!meId) return undefined

    let cancelled = false

    async function tick() {
      if (cancelled) return
      try {
        const rows = await pollCallSignals(pollSinceRef.current)
        for (const row of rows) {
          await processSignalRow(row)
          if (row.created_at) pollSinceRef.current = row.created_at
        }
      } catch (err) {
        if (err instanceof CallsNotInstalledError) {
          console.warn('DM calls need supabase-patch-dm-calls.sql')
        } else {
          console.error('Call poll failed:', err.message)
        }
      }
    }

    tick()
    const t = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [meId, processSignalRow])

  useEffect(() => () => {
    clearTimeout(ringTimerRef.current)
    stopRingtone()
    cleanupMedia()
  }, [cleanupMedia])

  // Unlock Web Audio after first tap so incoming rings can play later
  useEffect(() => {
    const unlock = () => unlockCallAudio()
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const startCall = useCallback(async ({
    conversationId,
    peerId,
    peerName,
    peerAvatarType,
    peerAvatarUrl,
    type = 'audio',
  }) => {
    if (!meId) return { ok: false, message: 'Sign in to call.' }
    if (callRef.current) return { ok: false, message: 'Already in a call.' }
    if (!canUseMedia()) return { ok: false, message: mediaErrorMessage() }
    if (!peerId) return { ok: false, message: 'Could not find who to call.' }

    unlockCallAudio()
    const callId = crypto.randomUUID()
    try {
      const stream = await getCallMedia(type)
      localStreamRef.current = stream
      setCall({
        id: callId,
        status: 'outgoing',
        type,
        conversationId,
        peerId,
        peerName: peerName || 'a fren',
        peerAvatarType: peerAvatarType || 'frog',
        peerAvatarUrl: peerAvatarUrl || null,
        isOutgoing: true,
        localStream: stream,
        muted: false,
        videoOff: type !== 'video',
      })
      startRingtone('outgoing')

      const p = profileRef.current
      await signal(peerId, callId, 'ring', {
        callType: type,
        conversationId,
        callerName: p?.frenName || 'a fren',
        callerAvatarType: p?.avatarType || 'frog',
        callerAvatarUrl: p?.avatarUrl || null,
      })

      ringTimerRef.current = setTimeout(() => endCall('no-answer'), RING_MS)
      return { ok: true }
    } catch (err) {
      stopRingtone()
      cleanupMedia()
      setCall(null)
      const message = err instanceof CallsNotInstalledError
        ? 'Calls need supabase-patch-dm-calls.sql in Supabase SQL Editor.'
        : (err.message || mediaErrorMessage(err))
      return { ok: false, message }
    }
  }, [cleanupMedia, endCall, meId, signal])

  const acceptCall = useCallback(async () => {
    const current = callRef.current
    if (!current || current.status !== 'incoming') return { ok: false }
    if (!canUseMedia()) return { ok: false, message: mediaErrorMessage() }

    stopRingtone()
    try {
      const stream = await getCallMedia(current.type)
      localStreamRef.current = stream
      setCall((prev) => ({
        ...prev,
        status: 'connecting',
        localStream: stream,
        videoOff: current.type !== 'video',
      }))

      await signal(current.peerId, current.id, 'accept', {})
      return { ok: true }
    } catch (err) {
      cleanupMedia()
      setCall(null)
      return { ok: false, message: err.message || mediaErrorMessage(err) }
    }
  }, [cleanupMedia, signal])

  const declineCall = useCallback(async () => {
    const current = callRef.current
    if (!current || current.status !== 'incoming') return
    stopRingtone()
    try {
      await signal(current.peerId, current.id, 'decline', {})
    } catch (err) {
      console.error('Decline signal failed:', err.message)
    }
    setCall(null)
  }, [signal])

  const toggleMute = useCallback(() => {
    setCall((prev) => {
      if (!prev) return prev
      const muted = !prev.muted
      toggleTrack(localStreamRef.current, 'audio', !muted)
      return { ...prev, muted }
    })
  }, [])

  const toggleVideo = useCallback(() => {
    setCall((prev) => {
      if (!prev || prev.type !== 'video') return prev
      const videoOff = !prev.videoOff
      toggleTrack(localStreamRef.current, 'video', !videoOff)
      return { ...prev, videoOff }
    })
  }, [])

  const value = {
    call,
    inCall: Boolean(call && call.status !== 'ended'),
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
  }

  return (
    <DmCallsContext.Provider value={value}>
      {children}
    </DmCallsContext.Provider>
  )
}

export function useDmCalls() {
  const ctx = useContext(DmCallsContext)
  if (ctx === undefined) throw new Error('useDmCalls must be used inside DmCallsProvider')
  return ctx
}
