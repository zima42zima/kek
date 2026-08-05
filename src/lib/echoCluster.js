/** Grid-based echo clustering for map zoom levels. */

import { distanceMeters } from './geo'

function cellSizeDeg(zoom) {
  if (zoom <= 4) return 12
  if (zoom <= 6) return 4
  if (zoom <= 8) return 1.5
  if (zoom <= 10) return 0.5
  if (zoom <= 12) return 0.15
  if (zoom <= 14) return 0.04
  return 0
}

export function clusterEchoes(echoes, zoom) {
  const cellDeg = cellSizeDeg(zoom)
  if (!cellDeg || !echoes?.length) {
    return (echoes ?? []).map((echo) => ({
      type: 'single',
      echo,
      lat: echo.lat,
      lon: echo.lon,
      count: 1,
    }))
  }

  const buckets = new Map()
  for (const echo of echoes) {
    if (!Number.isFinite(echo.lat) || !Number.isFinite(echo.lon)) continue
    const key = `${Math.floor(echo.lat / cellDeg)},${Math.floor(echo.lon / cellDeg)}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(echo)
  }

  return [...buckets.values()].map((group) => {
    const lat = group.reduce((s, e) => s + e.lat, 0) / group.length
    const lon = group.reduce((s, e) => s + e.lon, 0) / group.length
    if (group.length === 1) {
      return { type: 'single', echo: group[0], lat, lon, count: 1 }
    }
    return { type: 'cluster', echoes: group, lat, lon, count: group.length }
  })
}

/** Group echoes by place label for "around you" sections. */
export function groupEchoesByPlace(echoes) {
  const groups = new Map()
  for (const echo of echoes ?? []) {
    const key = (echo.placeLabel || echo.cityLabel || 'Nearby').trim()
    if (!groups.has(key)) {
      groups.set(key, { placeLabel: key, cityLabel: echo.cityLabel || null, echoes: [] })
    }
    groups.get(key).echoes.push(echo)
  }
  return [...groups.values()].sort((a, b) => b.echoes.length - a.echoes.length)
}

/** Explore map — group nearby world echoes (~280m) regardless of zoom. */
export function clusterEchoesExplore(echoes, clusterRadiusM = 280) {
  const valid = (echoes ?? []).filter(
    (e) => e?.id && Number.isFinite(e.lat) && Number.isFinite(e.lon),
  )
  const used = new Set()
  const out = []

  for (const seed of valid) {
    if (used.has(seed.id)) continue
    const group = [seed]
    used.add(seed.id)

    let expanded = true
    while (expanded) {
      expanded = false
      for (const e of valid) {
        if (used.has(e.id)) continue
        if (group.some((g) => distanceMeters(g, e) <= clusterRadiusM)) {
          group.push(e)
          used.add(e.id)
          expanded = true
        }
      }
    }

    const lat = group.reduce((s, e) => s + e.lat, 0) / group.length
    const lon = group.reduce((s, e) => s + e.lon, 0) / group.length
    if (group.length === 1) {
      out.push({ type: 'single', echo: group[0], echoes: group, lat, lon, count: 1 })
    } else {
      out.push({ type: 'cluster', echoes: group, lat, lon, count: group.length })
    }
  }

  return out
}
