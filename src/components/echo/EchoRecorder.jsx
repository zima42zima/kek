import { useEffect, useRef, useState } from 'react'
import { ECHO_AUDIO_MAX_SEC, ECHO_VIDEO_MAX_SEC } from '../../lib/echoConstants'
import { CameraIcon, HeadphonesIcon, MicIcon } from '../icons/UiIcons'

function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function EchoRecorder({
  kind = 'video',
  maxSeconds,
  onRecorded,
}) {
  const limit = maxSeconds ?? (kind === 'video' ? ECHO_VIDEO_MAX_SEC : ECHO_AUDIO_MAX_SEC)
  const [permission, setPermission] = useState('idle')
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [recordedUrl, setRecordedUrl] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')

  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const sourceVideoRef = useRef(null)

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
    setRecordedUrl(null)
    setSeconds(0)
    onRecorded?.(null)
    requestPermission(facingMode)
    return () => {
      clearInterval(timerRef.current)
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, facingMode])

  function flipCamera() {
    if (kind !== 'video') return
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
  }

  function finalizeRecording(rawBlob) {
    const url = URL.createObjectURL(rawBlob)
    setRecordedUrl(url)
    onRecorded?.({
      blob: rawBlob,
      url,
      kind,
    })
  }

  function startRecording() {
    if (!streamRef.current) {
      requestPermission()
      return
    }
    setRecordedUrl(null)
    chunksRef.current = []

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
      finalizeRecording(rawBlob)
    }
    recorder.start(250)
    recorderRef.current = recorder
    setRecording(true)
    setSeconds(0)
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1
        if (next >= limit) stopRecording()
        return next
      })
    }, 1000)
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    setRecording(false)
    if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop()
  }

  function reRecord() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedUrl(null)
    setSeconds(0)
    onRecorded?.(null)
    if (kind === 'video' && sourceVideoRef.current && streamRef.current) {
      sourceVideoRef.current.srcObject = streamRef.current
      sourceVideoRef.current.play().catch(() => {})
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl bg-black overflow-hidden aspect-[4/5] max-h-[48vh]">
        {recordedUrl ? (
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
              className="w-full h-full object-cover"
            />
            {permission === 'prompting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <p className="text-xs text-white/90">Waiting for camera…</p>
              </div>
            )}
            {permission === 'granted' && !recording && (
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

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className={`text-sm font-mono ${recording ? 'text-black dark:text-white' : 'frens-muted'}`}>
          {recording && <span className="inline-block w-2 h-2 rounded-full bg-black dark:bg-white mr-2 align-middle animate-pulse" />}
          {fmt(seconds)}{(recording || recordedUrl) ? ` / ${fmt(limit)}` : ''}
        </span>
        {permission === 'granted' && !recording && !recordedUrl && (
          <button type="button" onClick={startRecording} className="frens-btn-primary px-5 py-2 text-sm rounded-full">
            ● Record
          </button>
        )}
        {recording && (
          <button type="button" onClick={stopRecording} className="frens-btn-outline px-5 py-2 text-sm rounded-full">
            ■ Stop
          </button>
        )}
        {recordedUrl && !recording && (
          <button type="button" onClick={reRecord} className="frens-btn-outline px-4 py-2 text-sm rounded-full">
            Re-record
          </button>
        )}
      </div>
    </div>
  )
}
