import { useEffect, useRef, useState } from 'react'
import { ECHO_AUDIO_MAX_SEC, ECHO_VIDEO_MAX_SEC } from '../../lib/echoConstants'
import {
  echoVideoRecorderOptions,
  prepareEchoAudio,
  prepareEchoVideo,
} from '../../lib/echoMedia'
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
      setPermission('granted')
      // Preview element mounts after granted; attach on next paint.
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
    if (permission === 'granted') attachPreview()
  }, [permission])

  // Re-open camera only when flipping while already granted (not on first grant).
  const prevFacingRef = useRef(facingMode)
  useEffect(() => {
    const prev = prevFacingRef.current
    prevFacingRef.current = facingMode
    if (kind !== 'video' || permission !== 'granted') return
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
  }, [facingMode, permission, kind])

  function flipCamera() {
    if (kind !== 'video' || recording || converting) return
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

    const mime = kind === 'video'
      ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm')
      : (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm')

    let recorder
    try {
      recorder = kind === 'video'
        ? new MediaRecorder(streamRef.current, echoVideoRecorderOptions(mime))
        : new MediaRecorder(streamRef.current, { mimeType: mime })
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
    attachPreview()
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    setUploadError('')
    clearRecorded()
    setConverting(true)
    try {
      if (kind === 'video') {
        const { blob, duration } = await prepareEchoVideo(file, { maxSeconds: limit })
        finalizeRecording(blob, duration)
      } else {
        const { blob, duration } = await prepareEchoAudio(file, { maxSeconds: limit })
        finalizeRecording(blob, duration)
      }
    } catch (err) {
      setUploadError(err?.message || 'Could not use that file.')
    } finally {
      setConverting(false)
    }
  }

  const busy = recording || converting
  const accept = kind === 'video' ? 'video/*' : 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.webm'

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleUpload}
      />

      <div className="relative rounded-xl bg-black overflow-hidden aspect-[4/5] max-h-[48vh]">
        {converting ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black">
            <p className="text-xs text-white/90 text-center">
              {kind === 'video' ? 'Converting to 720p…' : 'Checking audio…'}
            </p>
            <p className="text-[10px] text-white/50 mt-1">
              {kind === 'video' ? `Max ${limit}s · HD` : `Max ${limit}s`}
            </p>
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
                ? 'Mic & camera need https — you can still upload a file.'
                : `Allow ${kind === 'video' ? 'camera & mic' : 'microphone'} to record, or upload a file.`}
            </p>
            {permission === 'denied' && (
              <button type="button" onClick={() => requestPermission()} className="frens-btn-outline px-4 py-2 text-sm">
                Try again
              </button>
            )}
          </div>
        ) : kind === 'video' && permission === 'granted' ? (
          <>
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
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/50 text-white text-sm"
                aria-label="Flip camera"
              >
                ⟳
              </button>
            )}
          </>
        ) : kind === 'video' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <CameraIcon className="w-10 h-10 mb-2 opacity-70" />
            <p className="text-xs frens-muted">
              {permission === 'prompting' ? 'Waiting for camera…' : `Record up to ${limit}s, or upload`}
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <MicIcon className={`w-12 h-12 mb-2 opacity-70 ${recording ? 'animate-pulse' : ''}`} />
            <p className="text-xs frens-muted">
              {permission === 'prompting'
                ? 'Waiting for mic…'
                : recording
                  ? 'Recording…'
                  : `Record up to ${limit}s, or upload`}
            </p>
          </div>
        )}
      </div>

      {uploadError ? (
        <p className="text-xs text-red-500 dark:text-red-400 text-center">{uploadError}</p>
      ) : (
        <p className="text-[10px] frens-muted text-center">
          {kind === 'video' ? `Video · max ${limit}s · converts to 720p` : `Audio · max ${limit}s`}
        </p>
      )}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className={`text-sm font-mono ${recording ? 'text-black dark:text-white' : 'frens-muted'}`}>
          {recording && <span className="inline-block w-2 h-2 rounded-full bg-black dark:bg-white mr-2 align-middle animate-pulse" />}
          {fmt(seconds)}{(recording || recordedUrl || converting) ? ` / ${fmt(limit)}` : ''}
        </span>
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
    </div>
  )
}
