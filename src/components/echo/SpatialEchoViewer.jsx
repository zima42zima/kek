import { useEffect, useRef, useState } from 'react'
import EchoIcon from './EchoIcon'
import { LocationIcon } from '../icons/UiIcons'
import { spatialPinOffset, spatialTierLabel, planeLabel, watchDeviceOrientation } from '../../lib/spatialEcho'

export default function SpatialEchoViewer({ echo, onPlay, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [permission, setPermission] = useState('idle')
  const [orientation, setOrientation] = useState(null)
  const [playing, setPlaying] = useState(false)

  const anchor = echo?.spatial
  const pin = spatialPinOffset(anchor, orientation)

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported')
      return
    }

    let cancelled = false
    setPermission('prompting')

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setPermission('granted')
      })
      .catch(() => { if (!cancelled) setPermission('denied') })

    const stopOrientation = watchDeviceOrientation(setOrientation)

    return () => {
      cancelled = true
      stopOrientation()
      stopStream()
    }
  }, [])

  function handlePinTap() {
    if (playing) return
    setPlaying(true)
    onPlay?.()
  }

  return (
    <div className="fixed inset-0 z-[65] bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        {permission === 'prompting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm">
            Opening camera…
          </div>
        )}
        {permission === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white text-sm p-6 text-center gap-3">
            <p>Allow camera to see this echo in space.</p>
            <button type="button" onClick={onClose} className="frens-btn-outline px-4 py-2 text-sm text-white border-white/40">
              Close
            </button>
          </div>
        )}
        {permission === 'granted' && anchor ? (
          <>
            <button
              type="button"
              onClick={handlePinTap}
              className="spatial-echo-pin spatial-echo-pin--discover"
              style={{ left: `${pin.nx * 100}%`, top: `${pin.ny * 100}%` }}
              aria-label="Play spatial echo"
            >
              <span className="spatial-echo-pin-pulse" aria-hidden />
              <EchoIcon className="w-10 h-8 drop-shadow-lg relative z-10" />
            </button>
            <div className="absolute top-4 left-4 right-14 flex flex-col gap-1 pointer-events-none">
              <span className="spatial-echo-badge inline-flex self-start items-center gap-1">
                <LocationIcon className="w-3 h-3" />
                {spatialTierLabel(anchor.tier)}
              </span>
              <span className="text-[10px] text-white/80 drop-shadow">
                {planeLabel(anchor.plane)} · move phone to look around
              </span>
            </div>
          </>
        ) : null}
        {playing && echo.mediaUrl ? (
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
            {echo.kind === 'video' ? (
              <video src={echo.mediaUrl} controls playsInline autoPlay className="w-full rounded-xl max-h-40" />
            ) : (
              <audio src={echo.mediaUrl} controls autoPlay className="w-full" />
            )}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 p-3 flex gap-2 bg-black/90 safe-area-pb">
        <button type="button" onClick={onClose} className="frens-btn-outline flex-1 py-2.5 text-sm text-white border-white/30">
          Close
        </button>
        {!playing ? (
          <button type="button" onClick={handlePinTap} className="frens-btn-primary flex-1 py-2.5 text-sm">
            Play echo
          </button>
        ) : null}
      </div>
    </div>
  )
}
