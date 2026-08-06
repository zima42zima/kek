import { useEffect, useRef, useState } from 'react'
import EchoIcon from './EchoIcon'
import {
  createSpatialAnchor,
  watchDeviceOrientation,
  planeLabel,
} from '../../lib/spatialEcho'

import { OPTION_ACTIVE, OPTION_IDLE, LocationIcon } from '../icons/UiIcons'

const PLANES = [
  { id: 'wall', label: 'Wall' },
  { id: 'floor', label: 'Floor' },
  { id: 'table', label: 'Surface' },
]

export default function SpatialEchoPlacer({
  tier = 'spatial',
  userPos,
  onPlaced,
  onCancel,
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const orientationRef = useRef(null)
  const [permission, setPermission] = useState('idle')
  const [plane, setPlane] = useState('wall')
  const [pin, setPin] = useState(null)
  const [error, setError] = useState('')

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported')
      return undefined
    }

    let cancelled = false
    setPermission('prompting')

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
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
      .catch(() => {
        if (!cancelled) setPermission('denied')
      })

    const stopOrientation = watchDeviceOrientation((reading) => {
      orientationRef.current = reading
    })

    return () => {
      cancelled = true
      stopOrientation()
      stopStream()
    }
  }, [])

  function handleTap(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    setPin({ nx, ny })
    setError('')
  }

  function confirmPlacement() {
    if (!pin) {
      setError('Tap the scene where your echo should live.')
      return
    }
    const anchor = createSpatialAnchor({
      point: pin,
      orientation: orientationRef.current,
      position: userPos
        ? { lat: userPos.lat, lon: userPos.lon, accuracy: userPos.accuracy }
        : null,
      plane,
      tier,
    })
    onPlaced?.(anchor)
  }

  if (permission === 'unsupported' || permission === 'denied') {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-sm frens-body-text">
          {permission === 'denied'
            ? 'Camera access is needed to pin a spatial echo.'
            : 'Spatial placement needs a secure connection and camera.'}
        </p>
        <button type="button" onClick={onCancel} className="frens-btn-outline px-4 py-2 text-sm">
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs frens-muted text-center inline-flex items-center justify-center gap-1">
        <LocationIcon className="w-3.5 h-3.5" />
        Tap where your echo should appear when someone returns
      </p>

      <div
        className="spatial-echo-camera relative rounded-xl overflow-hidden bg-black aspect-[3/4] max-h-[52vh] cursor-crosshair"
        onClick={handleTap}
        role="presentation"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        {permission === 'prompting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">
            Opening camera…
          </div>
        )}
        <div className="spatial-echo-reticle pointer-events-none" aria-hidden />
        {pin ? (
          <div
            className="spatial-echo-pin pointer-events-none"
            style={{ left: `${pin.nx * 100}%`, top: `${pin.ny * 100}%` }}
          >
            <EchoIcon className="w-8 h-6 drop-shadow-lg" />
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 justify-center">
        {PLANES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlane(p.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              plane === p.id ? OPTION_ACTIVE : `${OPTION_IDLE} frens-muted`
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pin ? (
        <p className="text-[10px] frens-muted text-center">
          Pinned on {planeLabel(plane).toLowerCase()} — tap elsewhere to move
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p> : null}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="frens-btn-outline flex-1 py-2.5 text-sm">
          Back
        </button>
        <button
          type="button"
          onClick={confirmPlacement}
          disabled={permission !== 'granted'}
          className="frens-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
        >
          Pin echo here
        </button>
      </div>
    </div>
  )
}
