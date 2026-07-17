import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { blurCoord, clampToRadius } from '../../lib/geo'
import { ECHO_PIN_OFFSET_MAX_M } from '../../lib/echoConstants'
import { addEchoMapTiles } from '../../lib/mapTiles'
import { echoIcon } from './EchoIcon'

const MARKER_INK = '#1a1a1a'
const ZONE_STROKE = '#888888'
const ZONE_FILL = '#aaaaaa'

function pinHtml() {
  return `
    <div style="
      width:28px;height:28px;border-radius:9999px;
      display:flex;align-items:center;justify-content:center;
      background:#ffffff;border:2px solid ${MARKER_INK};
      box-shadow:0 2px 8px rgba(0,0,0,.15);">
      <span style="
        display:inline-block;width:14px;height:10px;background:${MARKER_INK};
        -webkit-mask:url(${echoIcon}) center/contain no-repeat;
        mask:url(${echoIcon}) center/contain no-repeat;"></span>
    </div>`
}

export default function EchoPinPlacer({ userPos, pinPos, onPinChange, maxRadiusM = ECHO_PIN_OFFSET_MAX_M }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const zoneRef = useRef(null)

  useEffect(() => {
    if (mapRef.current || !containerRef.current || !userPos) return

    const map = L.map(containerRef.current, {
      center: [userPos.lat, userPos.lon],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    })
    mapRef.current = map

    addEchoMapTiles(L, map)

    zoneRef.current = L.circle([userPos.lat, userPos.lon], {
      radius: maxRadiusM,
      color: ZONE_STROKE,
      weight: 1.5,
      opacity: 0.6,
      fillColor: ZONE_FILL,
      fillOpacity: 0.08,
    }).addTo(map)

    L.circleMarker([userPos.lat, userPos.lon], {
      radius: 5,
      color: MARKER_INK,
      weight: 2,
      fillColor: MARKER_INK,
      fillOpacity: 0.9,
    }).addTo(map)

    const start = pinPos || userPos
    const icon = L.divIcon({
      html: pinHtml(),
      className: 'frens-echo-pin-placer',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
    const marker = L.marker([start.lat, start.lon], { icon, draggable: true }).addTo(map)
    markerRef.current = marker

    marker.on('drag', () => {
      const { lat, lng: lon } = marker.getLatLng()
      onPinChange?.(clampToRadius(userPos, { lat, lon }, maxRadiusM))
    })

    marker.on('dragend', () => {
      const { lat, lng: lon } = marker.getLatLng()
      const clamped = clampToRadius(userPos, { lat, lon }, maxRadiusM)
      marker.setLatLng([clamped.lat, clamped.lon])
      onPinChange?.(clamped)
    })

    setTimeout(() => {
      if (mapRef.current) refreshMapTiles(mapRef.current, null)
    }, 200)
  }, [userPos, maxRadiusM])

  useEffect(() => {
    if (!mapRef.current || !userPos) return
    const blurred = blurCoord(userPos)
    mapRef.current.setView([blurred.lat, blurred.lon], 17)
    zoneRef.current?.setLatLng([userPos.lat, userPos.lon])
    zoneRef.current?.setRadius(maxRadiusM)
  }, [userPos, maxRadiusM])

  useEffect(() => {
    if (!markerRef.current || !pinPos) return
    markerRef.current.setLatLng([pinPos.lat, pinPos.lon])
  }, [pinPos?.lat, pinPos?.lon])

  useEffect(() => () => {
    mapRef.current?.remove()
    mapRef.current = null
    markerRef.current = null
    zoneRef.current = null
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-52 rounded-xl overflow-hidden border frens-border frens-echo-map shadow-sm"
    />
  )
}
