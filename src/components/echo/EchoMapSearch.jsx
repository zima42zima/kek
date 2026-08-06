import { useEffect, useRef, useState } from 'react'
import { forwardGeocode } from '../../lib/geo'
import { searchEchoPlaces } from '../../lib/echoes'
import { loadEchoSearchHistory, pushEchoSearchHistory, zoomForPlaceType } from '../../lib/echoSearchHistory'
import { SearchIcon, GlobeIcon, LocationIcon } from '../icons/UiIcons'
import EchoIcon from './EchoIcon'
import nearMeIcon from '../../assets/icons/near-me.svg'
import { maskImageStyle } from '../../lib/maskIcon'

function NearMeIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 align-middle ${className}`}
      style={{
        backgroundColor: 'currentColor',
        ...maskImageStyle(nearMeIcon),
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}

export default function EchoMapSearch({
  selectedPlace = null,
  onSelectPlace,
  onClearPlace,
  backendReady = false,
  cityLabel = null,
  placeholder = 'Search a city, café, landmark…',
}) {
  const [editing, setEditing] = useState(!selectedPlace)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [echoPlaces, setEchoPlaces] = useState([])
  const [history, setHistory] = useState(() => loadEchoSearchHistory())
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (selectedPlace) {
      setEditing(false)
    }
  }, [selectedPlace])

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!editing) return undefined
    clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setEchoPlaces([])
      return undefined
    }

    debounceRef.current = setTimeout(async () => {
      setBusy(true)
      try {
        const [geo, places] = await Promise.all([
          forwardGeocode(q).catch(() => []),
          backendReady ? searchEchoPlaces(q).catch(() => []) : Promise.resolve([]),
        ])
        setResults(geo)
        setEchoPlaces(places)
        setOpen(true)
      } finally {
        setBusy(false)
      }
    }, 320)

    return () => clearTimeout(debounceRef.current)
  }, [query, backendReady, editing])

  function commitPlace(place) {
    const payload = {
      id: place.id,
      label: place.label || place.shortLabel,
      lat: place.lat,
      lon: place.lon,
      zoom: place.zoom ?? zoomForPlaceType(place.type),
    }
    setHistory(pushEchoSearchHistory(payload))
    setQuery(payload.label)
    setOpen(false)
    setEditing(false)
    onSelectPlace?.(payload)
  }

  function pickGeo(place) {
    commitPlace({
      id: place.id,
      label: place.shortLabel || place.label,
      lat: place.lat,
      lon: place.lon,
      type: place.type,
    })
  }

  function pickEchoPlace(place) {
    commitPlace({
      id: place.placeKey,
      label: place.placeLabel || place.cityLabel,
      lat: place.lat,
      lon: place.lon,
      type: 'city',
    })
  }

  function pickHistory(entry) {
    commitPlace(entry)
  }

  function startSearchAgain() {
    setEditing(true)
    setQuery('')
    setResults([])
    setEchoPlaces([])
    onClearPlace?.()
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function cancelEdit() {
    setEditing(false)
    setQuery(selectedPlace?.label || '')
    setOpen(false)
  }

  const showHistory = editing && open && query.trim().length < 2 && history.length > 0
  const showResults = editing && open && (results.length > 0 || echoPlaces.length > 0)
  const showDropdown = showHistory || showResults

  if (!editing && selectedPlace) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl border frens-border px-3 py-2 frens-surface">
          <LocationIcon className="w-4 h-4 shrink-0 text-[#6BC06B]" />
          <span className="text-sm truncate">{selectedPlace.label}</span>
        </div>
        <button
          type="button"
          onClick={startSearchAgain}
          className="frens-btn-outline text-xs px-3 py-2 shrink-0 whitespace-nowrap"
        >
          Search again
        </button>
      </div>
    )
  }

  const locationHint =
    cityLabel && cityLabel !== 'your region'
      ? cityLabel
      : null

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border frens-border px-3 py-2 frens-surface">
        <SearchIcon className="w-4 h-4 shrink-0 frens-muted" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none min-w-0"
          aria-label="Search places on the echo map"
        />
        {busy ? <span className="text-[10px] frens-muted">…</span> : null}
        {selectedPlace ? (
          <button type="button" onClick={cancelEdit} className="text-[10px] frens-action shrink-0">
            cancel
          </button>
        ) : null}
      </div>

      {/* Location only when search is active (focused / dropdown open) */}
      {open && locationHint ? (
        <p className="text-[11px] frens-muted px-1 mt-1.5 inline-flex items-center gap-1">
          <LocationIcon className="w-3 h-3 shrink-0" />
          Near {locationHint}
        </p>
      ) : null}

      {showDropdown && (
        <div className="absolute z-[1200] left-0 right-0 mt-1 rounded-xl border frens-border frens-surface shadow-lg max-h-64 overflow-y-auto">
          {showHistory && (
            <div className="p-2 border-b frens-border">
              <p className="text-[10px] uppercase tracking-wide frens-muted px-2 py-1">Recent</p>
              <ul>
                {history.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => pickHistory(entry)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center gap-2"
                    >
                      <LocationIcon className="w-3.5 h-3.5 shrink-0 frens-muted" />
                      <span className="min-w-0 truncate">{entry.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {echoPlaces.length > 0 && (
            <div className="p-2 border-b frens-border">
              <p className="text-[10px] uppercase tracking-wide frens-muted px-2 py-1">Echo places</p>
              <ul>
                {echoPlaces.map((p) => (
                  <li key={p.placeKey}>
                    <button
                      type="button"
                      onClick={() => pickEchoPlace(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center gap-2"
                    >
                      <EchoIcon className="w-4 h-3 shrink-0" />
                      <span className="min-w-0 truncate">{p.placeLabel || p.cityLabel}</span>
                      <span className="text-[10px] frens-muted ml-auto shrink-0">{p.echoCount} echo{p.echoCount === 1 ? '' : 's'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] uppercase tracking-wide frens-muted px-2 py-1">Places</p>
              <ul>
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => pickGeo(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-start gap-2"
                    >
                      <GlobeIcon className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="min-w-0 line-clamp-2">{p.shortLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function EchoMapModeTabs({ mode, onChange, hasLocation, explorePlace }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => onChange('near')}
          disabled={!hasLocation}
          className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition ${
            mode === 'near' ? 'frens-btn-primary' : 'frens-btn-outline disabled:opacity-40'
          }`}
        >
          <NearMeIcon className="w-3.5 h-3.5" /> Near me
        </button>
        <button
          type="button"
          onClick={() => onChange('explore')}
          className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition ${
            mode === 'explore' ? 'frens-btn-primary' : 'frens-btn-outline'
          }`}
        >
          <GlobeIcon className="w-3.5 h-3.5" /> Explore
        </button>
      </div>
      {explorePlace && mode === 'explore' ? (
        <span className="text-[11px] frens-muted truncate">Exploring · {explorePlace.label}</span>
      ) : null}
    </div>
  )
}
