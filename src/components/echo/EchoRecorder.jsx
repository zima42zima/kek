import { useEffect, useRef, useState } from 'react'
import { ECHO_AUDIO_MAX_SEC, ECHO_VIDEO_MAX_SEC } from '../../lib/echoConstants'
import {
  echoVideoRecorderOptions,
  prepareEchoAudio,
  prepareEchoVideo,
} from '../../lib/echoMedia'
import { VideoIcon, WaveformIcon } from '../icons/UiIcons'

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
  const isAudio = kind === 'audio'
  const limit = maxSeconds ?? (isAudio ? ECHO_AUDIO_MAX_SEC : ECHO_VIDEO_MAX_SEC)
  const [permission, setPermission] = useState('idle')
  const [recording, setRecording] = useState(false)
  const [converting, setConverting] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [recordedUrl, setRecordedUrl] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [uploadError, setUploadError] = useState('')

  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const secondsRef = useRef(0)
  const sourceVideoRef = useRef(null)
  const fileInputRef = useRef(null)
  const recordedUrlRef = useRef(null)

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function clearRecorded() {
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current)
    recordedUrlRef.current = null
    setRecordedUrl(null)
    secondsRef.current = 0
    setSeconds(0)
    onRecorded?.(null)
  }

  function attachPreview() {
    const target = sourceVideoRef.current
    const stream = streamRef.current
    if (!target || !stream) return
    if (target.srcObject !== stream) {
      target.srcObject = stream
      target.muted = true
      target.play().catch(() => {})
    }
  }

  async function requestPermission(mode = facingMode) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPermission('insecure')
      return false
    }
    setPermission('prompting')
    stopStream()
    try {
      const constraints = isAudio
        ? { audio: true }
        : {
            audio: true,
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setPermission('granted')
      requestAnimationFrame(() => attachPreview())
      return true
    } catch {
      setPermission('denied')
      return false
    }
  }

  useEffect(() => {
    clearRecorded()
    setUploadError('')
    setConverting(false)
    setPermission('idle')
    stopStream()
    return () => {
      clearInterval(timerRef.current)
      stopStream()
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  useEffect(() => {
    if (permission === 'granted' && !isAudio) attachPreview()
  }, [permission, isAudio])

  const prevFacingRef = useRef(facingMode)
  useEffect(() => {
    const prev = prevFacingRef.current
    prevFacingRef.current = facingMode
    if (isAudio || permission !== 'granted') return
    if (prev === facingMode) return
    let cancelled = false
    ;(async () => {
      stopStream()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        attachPreview()
      } catch {
        if (!cancelled) setPermission('denied')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, permission, isAudio])

  function flipCamera() {
    if (isAudio || recording || converting) return
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
  }

  function finalizeRecording(blob, durationSec = 0) {
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current)
    const url = URL.createObjectURL(blob)
    recordedUrlRef.current = url
    const dur = Math.min(limit, Math.max(0, Math.round(durationSec) || 0))
    secondsRef.current = dur
    setRecordedUrl(url)
    setSeconds(dur)
    onRecorded?.({
      blob,
      url,
      kind,
      duration: dur,
    })
  }

  function startRecording() {
    if (!streamRef.current) return
    clearRecorded()
    setUploadError('')
    chunksRef.current = []
    secondsRef.current = 0
    setSeconds(0)

    const mime = isAudio
      ? (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm')
      : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm')

    let recorder
    try {
      recorder = isAudio
        ? new MediaRecorder(streamRef.current, { mimeType: mime })
        : new MediaRecorder(streamRef.current, echoVideoRecorderOptions(mime))
    } catch {
      try {
        recorder = new MediaRecorder(streamRef.current, { mimeType: mime })
      } catch {
        recorder = new MediaRecorder(streamRef.current)
      }
    }

    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
    recorder.onstop = () => {
      const outMime = recorder.mimeType || mime
      const rawBlob = new Blob(chunksRef.current, { type: outMime.split(';')[0] })
      finalizeRecording(rawBlob, secondsRef.current)
    }
    recorder.start(250)
    recorderRef.current = recorder
    setRecording(true)
    timerRef.current = setInterval(() => {
      const next = secondsRef.current + 1
      secondsRef.current = next
      setSeconds(next)
      if (next >= limit) stopRecording()
    }, 1000)
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    setRecording(false)
    if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop()
  }

  async function onRecordClick() {
    if (recording || converting || recordedUrl) return
    if (permission !== 'granted' || !streamRef.current) {
      const ok = await requestPermission()
      if (!ok || !streamRef.current) return
    }
    startRecording()
  }

  function reRecord() {
    clearRecorded()
    setUploadError('')
    if (!isAudio) requestAnimationFrame(() => attachPreview())
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    setUploadError('')
    clearRecorded()
    setConverting(true)
    try {
      if (isAudio) {
        const { blob, duration } = await prepareEchoAudio(file, { maxSeconds: limit })
        finalizeRecording(blob, duration)
      } else {
        const { blob, duration } = await prepareEchoVideo(file, { maxSeconds: limit })
        finalizeRecording(blob, duration)
      }
    } catch (err) {
      setUploadError(err?.message || 'Could not use that file.')
    } finally {
      setConverting(false)
    }
  }

  const busy = recording || converting
  const accept = isAudio ? 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.webm' : 'video/*'

  const controls = (
    <div className="flex items-center justify-center gap-2.5 flex-wrap">
      {!busy && !recordedUrl && (
        <>
          <button
            type="button"
            onClick={onRecordClick}
            className="frens-btn-primary px-5 py-2 text-sm rounded-full"
          >
            ● Record
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="frens-btn-outline px-4 py-2 text-sm rounded-full"
          >
            Upload
          </button>
        </>
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
  )

  let status = isAudio ? `up to ${limit}s` : `up to ${limit}s · 720p`
  if (converting) status = isAudio ? 'Checking audio…' : 'Converting to 720p…'
  else if (permission === 'prompting') status = isAudio ? 'Waiting for mic…' : 'Waiting for camera…'
  else if (permission === 'insecure') status = isAudio
    ? 'Mic needs https — you can still upload'
    : 'Camera needs https — you can still upload'
  else if (permission === 'denied') status = isAudio
    ? 'Mic blocked — try again or upload'
    : 'Camera blocked — try again or upload'
  else if (recording) status = 'Recording…'
  else if (recordedUrl) status = `${fmt(seconds)} · ready`

  const showLivePreview = !isAudio && permission === 'granted' && !recordedUrl && !converting
  const showPlayback = Boolean(recordedUrl) && !converting

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleUpload}
      />

      <div className="rounded-2xl border frens-border px-5 py-5 flex flex-col items-center text-center">
        {showPlayback && !isAudio ? (
          <div className="relative w-full max-w-xs rounded-xl overflow-hidden bg-black aspect-video">
            <video src={recordedUrl} controls playsInline className="w-full h-full object-cover" />
          </div>
        ) : showLivePreview ? (
          <div className="relative w-full max-w-xs rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={sourceVideoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!busy && (
              <button
                type="button"
                onClick={flipCamera}
                className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/50 text-white text-sm"
                aria-label="Flip camera"
              >
                ⟳
              </button>
            )}
          </div>
        ) : isAudio ? (
          <WaveformIcon
            className={`w-[5.5rem] h-9 text-black dark:text-white ${
              recording ? 'animate-pulse' : converting ? 'opacity-40' : 'opacity-90'
            }`}
          />
        ) : (
          <VideoIcon
            className={`w-9 h-9 opacity-70 ${recording ? 'animate-pulse' : converting ? 'opacity-40' : ''}`}
          />
        )}

        {!showPlayback || isAudio ? (
          <>
            <p className="mt-3 text-2xl font-mono tabular-nums tracking-tight text-black dark:text-white">
              {fmt(seconds)}
              <span className="text-sm frens-muted font-normal"> / {fmt(limit)}</span>
            </p>
            <p className="mt-1 text-[11px] frens-muted">{status}</p>
          </>
        ) : (
          <p className="mt-2 text-[11px] frens-muted">{status}</p>
        )}

        {showPlayback && isAudio && (
          <audio src={recordedUrl} controls className="w-full mt-3 max-w-xs" />
        )}

        {permission === 'denied' && !recordedUrl && (
          <button
            type="button"
            onClick={() => requestPermission()}
            className="frens-btn-outline px-3 py-1.5 text-xs mt-2"
          >
            {isAudio ? 'Allow mic' : 'Allow camera'}
          </button>
        )}
      </div>

      {uploadError ? (
        <p className="text-xs text-red-500 dark:text-red-400 text-center">{uploadError}</p>
      ) : null}

      {controls}
    </div>
  )
}
