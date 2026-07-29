import { useEffect, useRef, useState } from 'react'

function hsvToRgb(h, s, v) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

const SIZE = 200

export default function ColorWheel({ value, onChange }) {
  const canvasRef = useRef(null)
  const draggingRef = useRef(false)
  const [brightness, setBrightness] = useState(1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(SIZE, SIZE)
    const r = SIZE / 2
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const dx = x - r
        const dy = y - r
        const dist = Math.sqrt(dx * dx + dy * dy)
        const idx = (y * SIZE + x) * 4
        if (dist <= r) {
          const hue = (Math.atan2(dy, dx) * 180) / Math.PI
          const [rr, gg, bb] = hsvToRgb((hue + 360) % 360, Math.min(1, dist / r), brightness)
          img.data[idx] = rr
          img.data[idx + 1] = gg
          img.data[idx + 2] = bb
          img.data[idx + 3] = 255
        } else {
          img.data[idx + 3] = 0
        }
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [brightness])

  function pickFromEvent(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scale = SIZE / rect.width
    const x = (e.clientX - rect.left) * scale
    const y = (e.clientY - rect.top) * scale
    const r = SIZE / 2
    const dx = x - r
    const dy = y - r
    const dist = Math.min(r, Math.sqrt(dx * dx + dy * dy))
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
    const [rr, gg, bb] = hsvToRgb(hue, dist / r, brightness)
    onChange?.(rgbToHex(rr, gg, bb))
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="rounded-full cursor-crosshair touch-none w-48 h-48"
        style={{ background: '#0e120e' }}
        onPointerDown={(e) => {
          draggingRef.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          pickFromEvent(e)
        }}
        onPointerMove={(e) => draggingRef.current && pickFromEvent(e)}
        onPointerUp={() => { draggingRef.current = false }}
      />
      <div className="w-48 flex items-center gap-2">
        <span className="text-xs frens-muted">K</span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(brightness * 100)}
          onChange={(e) => setBrightness(Number(e.target.value) / 100)}
          className="flex-1"
          aria-label="Brightness"
        />
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-full border frens-border"
          style={{ backgroundColor: value || '#000000' }}
        />
        <span className="text-xs frens-muted font-mono">{value || 'pick a color'}</span>
      </div>
    </div>
  )
}
