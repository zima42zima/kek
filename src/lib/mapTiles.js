/**
 * Echo Map basemaps — CARTO Dark by default.
 *
 * Optional premium (via .env):
 * - VITE_MAPTILER_KEY → MapTiler Streets
 * - VITE_MAPBOX_TOKEN → Mapbox Streets
 */

const DEFAULT_LAYER_ID = 'dark'

function env(key) {
  const v = import.meta.env[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

const CARTO = {
  subdomains: 'abcd',
  maxZoom: 20,
  attribution: '© OpenStreetMap © CARTO',
}

/** Labeled basemaps available without an API key. */
const FREE_BASE_LAYERS = [
  {
    id: 'dark',
    label: 'Dark',
    create(L) {
      return L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { ...CARTO },
      )
    },
  },
  {
    id: 'esri-streets',
    label: 'Streets',
    attribution: 'Tiles © Esri',
    create(L) {
      return L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Tiles © Esri' },
      )
    },
  },
  {
    id: 'streets',
    label: 'Streets (CARTO)',
    create(L) {
      return L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { ...CARTO },
      )
    },
  },
  {
    id: 'light',
    label: 'Light',
    create(L) {
      return L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { ...CARTO },
      )
    },
  },
  {
    id: 'satellite',
    label: 'Satellite',
    attribution: 'Tiles © Esri',
    create(L) {
      return L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Tiles © Esri' },
      )
    },
  },
]

function setAttribution(control, prev, next) {
  if (!next || next === prev) return prev
  if (prev) control.removeAttribution(prev)
  control.addAttribution(next)
  return next
}

function premiumLayer(L) {
  const maptilerKey = env('VITE_MAPTILER_KEY')
  if (maptilerKey) {
    return {
      id: 'maptiler',
      label: 'Streets (MapTiler)',
      attribution: '© MapTiler © OpenStreetMap',
      create: () =>
        L.tileLayer(
          `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`,
          {
            tileSize: 512,
            zoomOffset: -1,
            maxZoom: 20,
            attribution: '© MapTiler © OpenStreetMap',
          },
        ),
    }
  }

  const mapboxToken = env('VITE_MAPBOX_TOKEN')
  if (mapboxToken) {
    return {
      id: 'mapbox',
      label: 'Streets (Mapbox)',
      attribution: '© Mapbox © OpenStreetMap',
      create: () =>
        L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
          {
            tileSize: 512,
            zoomOffset: -1,
            maxZoom: 22,
            attribution: '© Mapbox © OpenStreetMap',
          },
        ),
    }
  }

  return null
}

function buildLayerCatalog(L) {
  const premium = premiumLayer(L)
  const layers = premium ? [premium, ...FREE_BASE_LAYERS] : FREE_BASE_LAYERS
  return layers.map((def) => ({
    ...def,
    instance: def.create(L),
  }))
}

/** Redraw visible tiles after the map moves or resizes. */
export function refreshActiveTiles(map, layer, { forceRedraw = false, invalidate = true } = {}) {
  if (!map?.getContainer?.()?.clientWidth) return
  try {
    if (invalidate) map.invalidateSize({ animate: false })
    if (!forceRedraw) return
    const redraw = (l) => {
      if (l?._url && typeof l.redraw === 'function') l.redraw()
    }
    if (layer) redraw(layer)
    else map.eachLayer(redraw)
  } catch {
    // ignore
  }
}

/** Recover tiles after a modal/overlay (e.g. backdrop-blur) disrupted rendering. */
export function recoverEchoMapTiles(map, layer) {
  if (!map?.getContainer?.()?.clientWidth) return
  try {
    map.invalidateSize({ animate: false })
    const center = map.getCenter()
    const zoom = map.getZoom()
    map.setView(center, zoom, { animate: false })
    const redraw = (l) => {
      if (l?._url && typeof l.redraw === 'function') l.redraw()
    }
    if (layer) redraw(layer)
    else map.eachLayer(redraw)
  } catch {
    // ignore
  }
}

/**
 * Add basemap tiles to a Leaflet map.
 */
export function addEchoMapTiles(L, map, options = {}) {
  const { showLayerControl = false, defaultLayerId, onActiveLayerChange } = options
  const catalog = buildLayerCatalog(L)
  const defaultId = defaultLayerId || DEFAULT_LAYER_ID
  const defaultEntry =
    catalog.find((e) => e.id === defaultId)
    || catalog.find((e) => e.id === DEFAULT_LAYER_ID)
    || catalog[0]

  defaultEntry.instance.addTo(map)
  onActiveLayerChange?.(defaultEntry.instance)

  let currentAttribution =
    defaultEntry.instance.options?.attribution || defaultEntry.attribution || ''
  const attributionControl = L.control
    .attribution({ prefix: false })
    .addAttribution(currentAttribution)
    .addTo(map)

  if (showLayerControl && catalog.length > 1) {
    const baseLayers = Object.fromEntries(catalog.map((e) => [e.label, e.instance]))
    L.control
      .layers(baseLayers, null, { position: 'topright', collapsed: true })
      .addTo(map)

    map.on('baselayerchange', (ev) => {
      onActiveLayerChange?.(ev.layer)
      const label = catalog.find((e) => e.instance === ev.layer)
      const text = ev.layer.options?.attribution || label?.attribution || ''
      currentAttribution = setAttribution(attributionControl, currentAttribution, text)
      window.setTimeout(() => refreshActiveTiles(map, ev.layer, { forceRedraw: true }), 50)
    })
  }

  return defaultEntry.instance
}

export function activeMapProviderLabel() {
  if (env('VITE_MAPTILER_KEY')) return 'MapTiler Streets'
  if (env('VITE_MAPBOX_TOKEN')) return 'Mapbox Streets'
  return 'CARTO Dark'
}
