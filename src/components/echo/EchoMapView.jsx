import { useEffect, useRef, useState, memo, forwardRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { batIcon } from './EchoIcon'
import {
  ECHO_CITY_RADIUS_M,
  ECHO_DISCOVER_RADIUS_MIN_M,
  ECHO_HINT_ZONE_RADIUS_M,
} from '../../lib/echoConstants'
import { clampSearchRadius } from '../../lib/echoRange'
import { clusterEchoesExplore } from '../../lib/echoCluster'
import { isFrenOf } from '../../lib/echoPrivacy'
import { addEchoMapTiles } from '../../lib/mapTiles'

const MARKER_INK = '#1a1a1a'
const MARKER_RING = '#444444'
const ZONE_STROKE = '#888888'
const ZONE_FILL = '#aaaaaa'

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Bat glyph — PNG is a light silhouette; force black via filter (avoid CSS mask + base64 commas). */
function batGlyphHtml(size = 16, extraClass = '') {
  const h = Math.round(size * 0.55)
  const src = String(batIcon || '').replace(/"/g, '&quot;')
  return `<img class="${extraClass}" src="${src}" alt="" width="${size}" height="${h}" style="
    display:block;width:${size}px;height:${h}px;object-fit:contain;
    filter:brightness(0);" draggable="false" />`
}

function avatarGlyphHtml(url, size = 28) {
  const src = escapeAttr(url)
  return `<img src="${src}" alt="" width="${size}" height="${size}" style="
    display:block;width:${size}px;height:${size}px;border-radius:9999px;object-fit:cover;"
    draggable="false" referrerpolicy="no-referrer" />`
}

function markerHtml(echo, frenGraph) {
  const useAvatar = (
    echo.mine
    || (isFrenOf(echo, frenGraph) && !echo.anonymous && Boolean(echo.avatarUrl))
  )
  const size = echo.mine ? 16 : 14
  const inner = useAvatar
    ? avatarGlyphHtml(echo.avatarUrl, echo.mine ? 28 : 26)
    : batGlyphHtml(size)
  const weight = echo.mine ? 2 : 1.5
  const pad = useAvatar ? '0' : undefined
  return `
    <div style="position:relative;width:32px;height:32px;border-radius:9999px;
      display:flex;align-items:center;justify-content:center;
      background:#ffffff;border:${weight}px solid ${MARKER_RING};
      box-shadow:0 2px 8px rgba(0,0,0,.12);overflow:hidden;${pad != null ? `padding:${pad};` : ''}">
      ${inner}
    </div>`
}

function batHintHtml(cityWide = false) {
  const title = cityWide
    ? 'A city-wide meme spot is out there — explore to discover it'
    : 'An aftersound is somewhere in this area — walk closer to discover it'
  return `
    <div class="frens-echo-bat-hint" title="${title}">
      ${batGlyphHtml(18)}
    </div>`
}

function clusterHtml(count) {
  return `
    <div class="frens-echo-cluster" title="${count} aftersounds here">
      ${batGlyphHtml(20)}
      <span class="frens-echo-cluster-count">${count}</span>
    </div>`
}

function clusterExploreHtml(echoes, frenGraph) {
  const count = echoes.length
  const rep = echoes.find(
    (e) => e.mine || (isFrenOf(e, frenGraph) && !e.anonymous && e.avatarUrl),
  )
  if (rep) {
    return `
      <div class="frens-echo-cluster" title="${count} aftersound${count === 1 ? '' : 's'} here">
        <div style="width:32px;height:32px;border-radius:9999px;overflow:hidden;
          border:1.5px solid ${MARKER_RING};background:#ffffff;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,.12);">
          ${avatarGlyphHtml(rep.avatarUrl, 28)}
        </div>
        <span class="frens-echo-cluster-count">${count}</span>
      </div>`
  }
  return clusterHtml(count)
}

function mapHasSize(map) {
  const el = map?.getContainer?.()
  return Boolean(el && el.clientWidth > 0 && el.clientHeight > 0)
}

/** Explore — don't zoom closer than a ~420m × 420m viewport (keeps tiles stable). */
function maxZoomForSpanM(map, spanM = ECHO_DISCOVER_RADIUS_MIN_M) {
  if (!map?.getContainer?.() || !mapHasSize(map)) return 15
  const center = map.getCenter()
  const lat = center.lat
  const half = spanM / 2
  const dLat = half / 111320
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6
  const dLon = half / (111320 * cosLat)
  const bounds = L.latLngBounds(
    [lat - dLat, center.lng - dLon],
    [lat + dLat, center.lng + dLon],
  )
  const z = map.getBoundsZoom(bounds, false)
  return Math.max(4, Math.min(z, 17))
}

function applyExploreZoomCap(map) {
  if (!map) return 15
  const cap = maxZoomForSpanM(map)
  map.setMaxZoom(cap)
  if (map.getZoom() > cap) map.setZoom(cap, { animate: false })
  return cap
}

function emitMapViewport(map, onViewportChange) {
  if (!map?._loaded || !mapHasSize(map)) return
  try {
    const b = map.getBounds()
    const c = map.getCenter()
    onViewportChange?.({
      zoom: map.getZoom(),
      center: { lat: c.lat, lon: c.lng },
      bounds: {
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      },
    })
  } catch {
    // Map mid-teardown — ignore.
  }
}

function destroyEchoMap(refs) {
  refs.mapRef.current?.remove()
  refs.mapRef.current = null
  refs.markersRef.current = null
  refs.hintsRef.current = null
  refs.browseRef.current = null
  refs.placePinRef.current = null
  refs.tileLayerRef.current = null
  refs.areaRef.current = null
  refs.cityRef.current = null
  refs.userRef.current = null
}

/** Leaflet adds classes to this node — keep it from re-rendering so React won't strip them. */
const LeafletMount = memo(forwardRef(function LeafletMount(_props, ref) {
  return (
    <div
      ref={ref}
      className="frens-echo-map w-full h-full"
      style={{ minHeight: '100%' }}
    />
  )
}))

export default function EchoMapView({
  center,
  zoom = 14,
  mode = 'near',
  echoes = [],
  hints = [],
  browseEchoes = [],
  searchRadiusM,
  userPos = null,
  placePin = null,
  frenGraph = null,
  onOpenEcho,
  onOpenCluster,
  onViewportChange,
  className = '',
  visible = true,
  mapRecoverTick = 0,
  mapSuspended = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(null)
  const hintsRef = useRef(null)
  const browseRef = useRef(null)
  const placePinRef = useRef(null)
  const tileLayerRef = useRef(null)
  const areaRef = useRef(null)
  const cityRef = useRef(null)
  const userRef = useRef(null)
  const zoomRef = useRef(zoom)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const mapSuspendedRef = useRef(mapSuspended)
  mapSuspendedRef.current = mapSuspended
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange
  const [mapZoom, setMapZoom] = useState(zoom)
  const scanRadiusM = clampSearchRadius(searchRadiusM ?? ECHO_CITY_RADIUS_M)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false
    let resizeTimer = null
    let ro = null

    const boot = () => {
      if (cancelled || mapRef.current || !containerRef.current) return
      if (!mapHasSize({ getContainer: () => containerRef.current })) {
        requestAnimationFrame(boot)
        return
      }

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lon],
        zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: false,
        attributionControl: false,
      })
      mapRef.current = map
      zoomRef.current = zoom

      tileLayerRef.current = addEchoMapTiles(L, map, {
        showLayerControl: true,
        onActiveLayerChange: (layer) => {
          tileLayerRef.current = layer
        },
      })

      markersRef.current = L.layerGroup().addTo(map)
      hintsRef.current = L.layerGroup().addTo(map)
      browseRef.current = L.layerGroup().addTo(map)
      placePinRef.current = L.layerGroup().addTo(map)

      areaRef.current = L.circle([center.lat, center.lon], {
        radius: ECHO_DISCOVER_RADIUS_MIN_M,
        color: ZONE_STROKE,
        weight: 1.5,
        opacity: mode === 'near' ? 0.55 : 0,
        fillColor: ZONE_FILL,
        fillOpacity: mode === 'near' ? 0.08 : 0,
      })
      cityRef.current = L.circle([center.lat, center.lon], {
        radius: scanRadiusM,
        color: ZONE_STROKE,
        weight: 1,
        opacity: mode === 'near' ? 0.25 : 0,
        dashArray: '6 8',
        fillColor: ZONE_FILL,
        fillOpacity: mode === 'near' ? 0.03 : 0,
      })
      userRef.current = L.circleMarker([center.lat, center.lon], {
        radius: 6,
        color: MARKER_INK,
        weight: 2,
        fillColor: '#6BC06B',
        fillOpacity: 0.9,
      })

      if (mode === 'near') {
        areaRef.current.addTo(map)
        cityRef.current.addTo(map)
        if (userPos) {
          userRef.current.setLatLng([userPos.lat, userPos.lon])
          userRef.current.addTo(map)
        }
      }

      const emitViewport = () => {
        const z = map.getZoom()
        zoomRef.current = z
        setMapZoom(z)
        emitMapViewport(map, onViewportChangeRef.current)
      }

      map.on('moveend', () => {
        if (mapSuspendedRef.current) return
        emitViewport()
      })
      map.on('zoomend', () => {
        if (mapSuspendedRef.current) return
        if (modeRef.current === 'explore') applyExploreZoomCap(map)
      })

      ro = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            clearTimeout(resizeTimer)
            resizeTimer = setTimeout(() => {
              if (mapSuspendedRef.current) return
              if (modeRef.current === 'explore') applyExploreZoomCap(map)
              if (mapHasSize(map)) map.invalidateSize({ animate: false })
            }, 120)
          })
        : null
      ro?.observe(containerRef.current)

      map.whenReady(() => {
        if (mapHasSize(map)) map.invalidateSize({ animate: false })
        emitViewport()
      })
    }

    boot()

    return () => {
      cancelled = true
      clearTimeout(resizeTimer)
      ro?.disconnect()
      destroyEchoMap({
        mapRef,
        markersRef,
        hintsRef,
        browseRef,
        placePinRef,
        tileLayerRef,
        areaRef,
        cityRef,
        userRef,
      })
    }
  }, [])

  // Explore — cap zoom so viewport stays ≥ 420m (prevents tile white-out).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (mode === 'explore') {
      applyExploreZoomCap(map)
      return
    }
    map.setMaxZoom(20)
  }, [mode])

  // Near-me mode: follow blurred user position.
  useEffect(() => {
    const map = mapRef.current
    if (!map || mode !== 'near') return
    if (!userPos) return
    map.setView([center.lat, center.lon], Math.max(zoomRef.current, 13), { animate: false })
  }, [mode, center.lat, center.lon, userPos])

  // Place pin for the searched location in explore mode.
  useEffect(() => {
    const group = placePinRef.current
    if (!group) return
    group.clearLayers()
    if (mode !== 'explore' || !placePin) return

    L.circleMarker([placePin.lat, placePin.lon], {
      radius: 8,
      color: '#1a1a1a',
      weight: 2,
      fillColor: '#6BC06B',
      fillOpacity: 0.95,
    }).addTo(group)
  }, [mode, placePin?.lat, placePin?.lon])

  useEffect(() => {
    const map = mapRef.current
    const showNear = mode === 'near'
    const marker = userRef.current

    areaRef.current?.setStyle({
      opacity: showNear ? 0.55 : 0,
      fillOpacity: showNear ? 0.08 : 0,
    })
    cityRef.current?.setStyle({
      opacity: showNear ? 0.25 : 0,
      fillOpacity: showNear ? 0.03 : 0,
    })

    if (!map || !marker) return

    if (showNear && userPos) {
      if (!map.hasLayer(areaRef.current) && areaRef.current) areaRef.current.addTo(map)
      if (!map.hasLayer(cityRef.current) && cityRef.current) cityRef.current.addTo(map)
      areaRef.current?.setLatLng([userPos.lat, userPos.lon])
      cityRef.current?.setLatLng([userPos.lat, userPos.lon])
      cityRef.current?.setRadius(scanRadiusM)
      marker.setLatLng([userPos.lat, userPos.lon])
      if (!map.hasLayer(marker)) marker.addTo(map)
      marker.setStyle({ opacity: 1, fillOpacity: 0.9 })
      return
    }

    if (map.hasLayer(marker)) map.removeLayer(marker)
    if (areaRef.current && map.hasLayer(areaRef.current)) map.removeLayer(areaRef.current)
    if (cityRef.current && map.hasLayer(cityRef.current)) map.removeLayer(cityRef.current)
  }, [mode, userPos, scanRadiusM])

  // Explore — fly to a searched place.
  useEffect(() => {
    const map = mapRef.current
    if (!map || mode !== 'explore' || !placePin?.lat || !placePin?.lon) return
    const targetZoom = Math.max(zoomRef.current, 11)
    map.setView([placePin.lat, placePin.lon], targetZoom, { animate: false })
    zoomRef.current = targetZoom
    setMapZoom(targetZoom)
  }, [mode, placePin?.lat, placePin?.lon])

  useEffect(() => {
    const group = markersRef.current
    if (!group || mode !== 'near') {
      group?.clearLayers()
      return
    }
    group.clearLayers()

    echoes.forEach((echo) => {
      const icon = L.divIcon({
        html: markerHtml(echo, frenGraph),
        className: 'frens-echo-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      L.marker([echo.lat, echo.lon], { icon })
        .addTo(group)
        .on('click', () => {
          const echoId = echo.id
          requestAnimationFrame(() => onOpenEcho?.(echoId))
        })
    })
  }, [echoes, frenGraph, onOpenEcho, mode])

  useEffect(() => {
    const group = hintsRef.current
    if (!group || mode !== 'near') {
      group?.clearLayers()
      return
    }
    group.clearLayers()

    hints.forEach((hint) => {
      const icon = L.divIcon({
        html: batHintHtml(hint.cityWide),
        className: 'frens-echo-bat-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })
      L.marker([hint.lat, hint.lon], { icon, interactive: false }).addTo(group)
      L.circle([hint.lat, hint.lon], {
        radius: hint.zoneRadiusM ?? ECHO_HINT_ZONE_RADIUS_M,
        color: ZONE_STROKE,
        weight: 1,
        opacity: hint.cityWide ? 0.28 : 0.35,
        dashArray: hint.cityWide ? '10 10' : '4 6',
        fillColor: ZONE_FILL,
        fillOpacity: hint.cityWide ? 0.04 : 0.06,
        interactive: false,
      }).addTo(group)
    })
  }, [hints, mode])

  useEffect(() => {
    const group = browseRef.current
    const map = mapRef.current
    if (!group || !map || mode !== 'explore') {
      group?.clearLayers()
      return
    }
    group.clearLayers()

    const clusters = clusterEchoesExplore(browseEchoes)

    function openExploreGroup(echoes) {
      if (!echoes?.length) return
      onOpenCluster?.(echoes)
    }

    clusters.forEach((item) => {
      const echoes = item.echoes || (item.echo ? [item.echo] : [])
      if (item.type === 'cluster') {
        const icon = L.divIcon({
          html: clusterExploreHtml(echoes, frenGraph),
          className: 'frens-echo-cluster-marker',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        })
        L.marker([item.lat, item.lon], { icon })
          .addTo(group)
          .on('click', (ev) => {
            L.DomEvent.stopPropagation(ev)
            openExploreGroup(echoes)
          })
        return
      }

      const echo = item.echo
      const icon = L.divIcon({
        html: markerHtml(echo, frenGraph),
        className: 'frens-echo-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      L.marker([echo.lat, echo.lon], { icon })
        .addTo(group)
        .on('click', (ev) => {
          L.DomEvent.stopPropagation(ev)
          openExploreGroup(echoes)
        })
    })
  }, [browseEchoes, mode, onOpenCluster, frenGraph])

  useEffect(() => {
    if (mapSuspended) return undefined
    const map = mapRef.current
    if (!map || !mapHasSize(map)) return undefined
    const t = setTimeout(() => {
      map.invalidateSize({ animate: false })
    }, 80)
    return () => clearTimeout(t)
  }, [mapSuspended, mapRecoverTick])

  const heightClass = mode === 'explore' ? 'h-96' : 'h-80'
  const minHeight = mode === 'explore' ? 384 : 320

  // Outer wrapper holds Tailwind layout/classes — inner div is Leaflet-owned only.
  // React must not rewrite className on the Leaflet container (strips leaflet-container → white map).
  return (
    <div
      className={`w-full ${heightClass} rounded-xl overflow-hidden border frens-border shadow-sm ${className}`}
      style={{ minHeight }}
    >
      <LeafletMount ref={containerRef} />
    </div>
  )
}
