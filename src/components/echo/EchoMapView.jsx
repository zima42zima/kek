import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { batIcon } from './EchoIcon'
import {
  ECHO_CITY_RADIUS_M,
  ECHO_DISCOVER_RADIUS_MIN_M,
  ECHO_HINT_ZONE_RADIUS_M,
} from '../../lib/echoConstants'
import { clampSearchRadius } from '../../lib/echoRange'
import { clusterEchoes } from '../../lib/echoCluster'
import { canBrowseGlobally } from '../../lib/echoPrivacy'
import { addEchoMapTiles, refreshActiveTiles } from '../../lib/mapTiles'

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

function markerHtml(echo) {
  const useAvatar = !echo.anonymous && Boolean(echo.avatarUrl)
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

function mapHasSize(map) {
  const el = map?.getContainer?.()
  return Boolean(el && el.clientWidth > 0 && el.clientHeight > 0)
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

function refreshMapTiles(map, tileLayer) {
  if (!map || !mapHasSize(map)) return
  refreshActiveTiles(map, tileLayer)
}

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
  onOpenEcho,
  onClusterZoom,
  onViewportChange,
  className = '',
  visible = true,
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
        opacity: 0.55,
        fillColor: ZONE_FILL,
        fillOpacity: 0.08,
      }).addTo(map)

      cityRef.current = L.circle([center.lat, center.lon], {
        radius: scanRadiusM,
        color: ZONE_STROKE,
        weight: 1,
        opacity: 0.25,
        dashArray: '6 8',
        fillColor: ZONE_FILL,
        fillOpacity: 0.03,
      }).addTo(map)

      userRef.current = L.circleMarker([center.lat, center.lon], {
        radius: 6,
        color: MARKER_INK,
        weight: 2,
        fillColor: '#6BC06B',
        fillOpacity: 0.9,
      }).addTo(map)

      const emitViewport = () => {
        const z = map.getZoom()
        zoomRef.current = z
        setMapZoom(z)
        emitMapViewport(map, onViewportChangeRef.current)
      }

      map.on('moveend', emitViewport)
      map.on('zoomend', emitViewport)

      ro = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            clearTimeout(resizeTimer)
            resizeTimer = setTimeout(() => {
              refreshMapTiles(map, tileLayerRef.current)
            }, 120)
          })
        : null
      ro?.observe(containerRef.current)

      map.whenReady(() => {
        refreshMapTiles(map, tileLayerRef.current)
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
    const showNear = mode === 'near'
    areaRef.current?.setStyle({ opacity: showNear ? 0.55 : 0 })
    cityRef.current?.setStyle({ opacity: showNear ? 0.25 : 0 })
    userRef.current?.setStyle({ opacity: showNear && userPos ? 1 : 0 })

    if (showNear && userPos) {
      areaRef.current?.setLatLng([userPos.lat, userPos.lon])
      cityRef.current?.setLatLng([userPos.lat, userPos.lon])
      cityRef.current?.setRadius(scanRadiusM)
      userRef.current?.setLatLng([userPos.lat, userPos.lon])
    }
  }, [mode, userPos, scanRadiusM])

  useEffect(() => {
    const group = markersRef.current
    if (!group || mode !== 'near') {
      group?.clearLayers()
      return
    }
    group.clearLayers()

    echoes.forEach((echo) => {
      const icon = L.divIcon({
        html: markerHtml(echo),
        className: 'frens-echo-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      L.marker([echo.lat, echo.lon], { icon })
        .addTo(group)
        .on('click', () => onOpenEcho?.(echo.id))
    })
  }, [echoes, onOpenEcho, mode])

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

    const clusters = clusterEchoes(browseEchoes, zoomRef.current)
    clusters.forEach((item) => {
      if (item.type === 'cluster') {
        const icon = L.divIcon({
          html: clusterHtml(item.count),
          className: 'frens-echo-cluster-marker',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        })
        L.marker([item.lat, item.lon], { icon })
          .addTo(group)
          .on('click', () => {
            const nextZoom = Math.min((map.getZoom() || 10) + 2, 16)
            map.setView([item.lat, item.lon], nextZoom, { animate: false })
            refreshMapTiles(map, tileLayerRef.current)
            onClusterZoom?.({ lat: item.lat, lon: item.lon, zoom: nextZoom })
          })
        return
      }

      const echo = item.echo
      const global = canBrowseGlobally(echo)
      const icon = L.divIcon({
        html: batHintHtml(false),
        className: 'frens-echo-bat-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })
      L.marker([item.lat, item.lon], { icon })
        .addTo(group)
        .on('click', () => {
          if (global) onOpenEcho?.(echo.id)
        })
    })
  }, [browseEchoes, mode, mapZoom, onOpenEcho, onClusterZoom])

  // Refresh tiles when map becomes visible or mode changes (not during fly animation).
  useEffect(() => {
    if (!visible) return
    const map = mapRef.current
    if (!map) return
    const delay = mode === 'explore' ? 280 : 150
    const t = setTimeout(() => refreshMapTiles(map, tileLayerRef.current), delay)
    return () => clearTimeout(t)
  }, [visible, mode])

  const heightClass = mode === 'explore' ? 'h-96' : 'h-80'
  const minHeight = mode === 'explore' ? 384 : 320

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass} rounded-xl overflow-hidden border frens-border frens-echo-map shadow-sm ${className}`}
      style={{ minHeight }}
    />
  )
}
