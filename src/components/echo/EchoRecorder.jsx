import { useCallback, useEffect, useRef, useState } from 'react'
import { ECHO_AUDIO_MAX_SEC, ECHO_GLITCH_FILTERS, ECHO_VIDEO_MAX_SEC } from '../../lib/echoConstants'
import { applySenseFilter, isSenseFilterActive } from '../../lib/senseFilters'
import { bakeGlitchFilterIntoVideo } from '../../lib/echoVideoFx'
import EchoIcon from './EchoIcon'
import { CameraIcon, HeadphonesIcon, MicIcon } from '../icons/UiIcons'

function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function EchoRecorder({
  kind = 'video',
  senseFilter = 'clear',
  maxSeconds,
  onRecorded,
}) {
  const limit = maxSeconds ?? (kind === 'video' ? ECHO_VIDEO_MAX_SEC : ECHO_AUDIO_MAX_SEC)
  const [permission, setPermission] = useState('idle')
  const [recording, setRecording] = useState(false)
  const [baking, setBaking] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [recordedUrl, setRecordedUrl] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')

  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const sourceVideoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const recordedDurationRef = useRef(0)
  const recordStartRef = useRef(0)
  const facingModeRef = useRef(facingMode)

  const useFx = kind === 'video' && isSenseFilterActive(senseFilter)
  const fxHint = ECHO_GLITCH_FILTERS.find((f) => f.id === senseFilter)?.hint

  facingModeRef.current = facingMode

  const paintFxFrame = useCallback(() => {
    const video = sourceVideoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(paintFxFrame)
      return
    }
    const w = video.videoWidth || 720
    const h = video.videoHeight || 1280
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    if (ctx) {
      applySenseFilter(ctx, video, w, h, senseFilter, facingMode === 'user', performance.now())
    }
    rafRef.current = requestAnimationFrame(paintFxFrame)
  }, [senseFilter, facingMode])

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function requestPermission(mode = facingMode) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPermission('insecure')
      return
    }
    setPermission('prompting')
    stopStream()
    try {
      const constraints = kind === 'video'
        ? {
            audio: true,
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          }
        : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (kind === 'video') {
        const target = sourceVideoRef.current
        if (target) {
          target.srcObject = stream
          target.muted = true
          await target.play().catch(() => {})
        }
      }
      setPermission('granted')
    } catch {
      setPermission('denied')
    }
  }

  useEffect(() => {
    if (!useFx || permission !== 'granted') return undefined
    const video = sourceVideoRef.current
    if (!video || !streamRef.current) return undefined
    video.srcObject = streamRef.current
    video.muted = true
    video.play().catch(() => {})
    const onReady = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(paintFxFrame)
    }
    video.addEventListener('loadedmetadata', onReady)
    if (video.readyState >= 1) onReady()
    return () => {
      video.removeEventListener('loadedmetadata', onReady)
      cancelAnimationFrame(rafRef.current)
    }
  }, [useFx, permission, senseFilter, facingMode, paintFxFrame])

  useEffect(() => {
    setRecordedUrl(null)
    setSeconds(0)
    setBaking(false)
    onRecorded?.(null)
    requestPermission(facingMode)
    return () => {
      clearInterval(timerRef.current)
      cancelAnimationFrame(rafRef.current)
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, facingMode])

  function flipCamera() {
    if (kind !== 'video') return
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
  }

  async function finalizeRecording(rawBlob, mime) {
    const type = mime.split(';')[0] || 'video/webm'
    let finalBlob = rawBlob

    if (useFx) {
      setBaking(true)
      try {
        finalBlob = await bakeGlitchFilterIntoVideo(rawBlob, senseFilter, {
          facingUser: facingModeRef.current === 'user',
          knownDurationSec: recordedDurationRef.current,
        })
      } catch (err) {
        console.error('FX bake failed, keeping raw recording', err)
        finalBlob = rawBlob
      } finally {
        setBaking(false)
      }
    }

    const url = URL.createObjectURL(finalBlob)
    setRecordedUrl(url)
    onRecorded?.({
      blob: finalBlob,
      url,
      kind,
      senseFilter: useFx ? senseFilter : 'clear',
    })
  }

  function startRecording() {
    if (!streamRef.current) {
      requestPermission()
      return
    }
    setRecordedUrl(null)
    chunksRef.current = []
    recordedDurationRef.current = 0

    const mime = kind === 'video'
      ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm')
      : (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm')

    let recorder
    try {
      recorder = new MediaRecorder(streamRef.current, { mimeType: mime })
    } catch {
      recorder = new MediaRecorder(streamRef.current)
    }

    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
    recorder.onstop = () => {
      const outMime = recorder.mimeType || mime
      const rawBlob = new Blob(chunksRef.current, { type: outMime.split(';')[0] })
      finalizeRecording(rawBlob, outMime)
    }
    recorder.start(250)
    recorderRef.current = recorder
    recordStartRef.current = performance.now()
    setRecording(true)
    setSeconds(0)
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1
        recordedDurationRef.current = next
        if (next >= limit) stopRecording()
        return next
      })
    }, 1000)
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    recordedDurationRef.current = Math.max(0.5, (performance.now() - recordStartRef.current) / 1000)
    setRecording(false)
    if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop()
  }

  function reRecord() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedUrl(null)
    setSeconds(0)
    setBaking(false)
    onRecorded?.(null)
    if (kind === 'video' && useFx && sourceVideoRef.current && streamRef.current) {
      sourceVideoRef.current.srcObject = streamRef.current
      sourceVideoRef.current.play().catch(() => {})
    }
  }

  const busy = recording || baking

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl bg-black overflow-hidden aspect-[4/5] max-h-[48vh]">
        {baking ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black">
            <EchoIcon className="w-8 h-6 mb-3 animate-pulse opacity-80" />
            <p className="text-xs text-white/90 text-center">Baking glitch into your echo…</p>
            <p className="text-[10px] text-white/50 mt-1">Saved video will match the preview</p>
          </div>
        ) : recordedUrl ? (
          kind === 'video' ? (
            <video src={recordedUrl} controls playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              <HeadphonesIcon className="w-10 h-10 mb-3 opacity-70" />
              <audio src={recordedUrl} controls className="w-full" />
            </div>
          )
        ) : permission === 'denied' || permission === 'insecure' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            {kind === 'video' ? (
              <CameraIcon className="w-10 h-10 mb-2 opacity-70" />
            ) : (
              <MicIcon className="w-10 h-10 mb-2 opacity-70" />
            )}
            <p className="text-xs frens-muted mb-3">
              {permission === 'insecure'
                ? 'Mic & camera need https — open the app securely on your phone.'
                : `Allow ${kind === 'video' ? 'camera & mic' : 'microphone'} to record.`}
            </p>
            {permission === 'denied' && (
              <button type="button" onClick={() => requestPermission()} className="frens-btn-outline px-4 py-2 text-sm">
                Try again
              </button>
            )}
          </div>
        ) : kind === 'video' ? (
          <>
            <video
              ref={sourceVideoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${useFx ? 'hidden' : ''}`}
            />
            {useFx ? <canvas ref={canvasRef} className="w-full h-full object-cover absolute inset-0" /> : null}
            {useFx && permission === 'granted' && !busy && (
              <div className="absolute top-3 left-3 z-10 pointer-events-none">
                <span className="echo-fx-badge">Glitch FX</span>
              </div>
            )}
            {recording && useFx && (
              <div className="absolute top-3 left-3 z-10 pointer-events-none">
                <span className="echo-fx-badge">Recording…</span>
              </div>
            )}
            {permission === 'prompting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <p className="text-xs text-white/90">Waiting for camera…</p>
              </div>
            )}
            {permission === 'granted' && !busy && (
              <button
                type="button"
                onClick={flipCamera}
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/50 text-white text-sm"
                aria-label="Flip camera"
              >
                ⟳
              </button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <MicIcon className={`w-12 h-12 mb-2 opacity-70 ${recording ? 'animate-pulse' : ''}`} />
            <p className="text-xs frens-muted">
              {permission === 'prompting' ? 'Waiting for mic…' : recording ? 'Recording…' : 'Tap record when ready'}
            </p>
          </div>
        )}
      </div>

      {useFx && permission === 'granted' && !recordedUrl && !baking && fxHint ? (
        <p className="text-[10px] frens-muted text-center px-2">{fxHint}</p>
      ) : null}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className={`text-sm font-mono ${recording ? 'text-black dark:text-white' : 'frens-muted'}`}>
          {recording && <span className="inline-block w-2 h-2 rounded-full bg-black dark:bg-white mr-2 align-middle animate-pulse" />}
          {fmt(seconds)}{(recording || recordedUrl || baking) ? ` / ${fmt(limit)}` : ''}
        </span>
        {permission === 'granted' && !busy && !recordedUrl && (
          <button type="button" onClick={startRecording} className="frens-btn-primary px-5 py-2 text-sm rounded-full">
            ● Record
          </button>
        )}
        {recording && (
          <button type="button" onClick={stopRecording} className="frens-btn-outline px-5 py-2 text-sm rounded-full">
            ■ Stop
          </button>
        )}
        {recordedUrl && !busy && (
          <button type="button" onClick={reRecord} className="frens-btn-outline px-4 py-2 text-sm rounded-full">
            Re-record
          </button>
        )}
      </div>
    </div>
  )
}
