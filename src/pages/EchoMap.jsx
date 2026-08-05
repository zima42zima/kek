import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import EchoMapView from '../components/echo/EchoMapView'
import CreateEchoModal from '../components/echo/CreateEchoModal'
import EchoIntroModal from '../components/echo/EchoIntroModal'
import EchoView from '../components/echo/EchoView'
import EchoIcon from '../components/echo/EchoIcon'
import { LocationIcon, MapIcon } from '../components/icons/UiIcons'
import EchoRangeGallery from '../components/echo/EchoRangeGallery'
import EchoCollectionCard from '../components/echo/EchoCollectionCard'
import { echoWatchedPreviewUrl } from '../components/echo/EchoPreviewMedia'
import EchoMineCard from '../components/echo/EchoMineCard'
import EchoMineToolbar from '../components/echo/EchoMineToolbar'
import EchoEditModal from '../components/echo/EchoEditModal'
import ConfirmDialog from '../components/ConfirmDialog'
import EchoSearchRadiusSelect from '../components/echo/EchoRangeSelect'
import EchoMapSearch, { EchoMapModeTabs } from '../components/echo/EchoMapSearch'
import EchoPlacesPanel, { groupEchoesByPlace } from '../components/echo/EchoPlacesPanel'
import {
  ECHO_INTRO_KEY,
  ECHO_VIDEO_MAX_SEC,
  ECHO_CITY_RADIUS_M,
  ECHO_PIN_OFFSET_MAX_M,
  ECHO_HINT_FUZZ_RADIUS_M,
  ECHO_CITY_HINT_FUZZ_RADIUS_M,
  ECHO_CITY_HINT_ZONE_RADIUS_M,
  ECHO_PUBLIC_VISIBILITIES,
  ECHO_DEFAULT_DISCOVER_RADIUS_M,
  ECHO_POSITION_REFRESH_MS,
  ECHO_MOVE_THRESHOLD_M,
  ECHO_MINE_VIEW_KEY,
} from '../lib/echoConstants'
import {
  loadEchoes,
  saveEchoes,
  loadDiscovered,
  saveDiscovered,
  loadHinted,
  saveHinted,
  loadEchoAura,
  saveEchoAura,
  loadEchoHistory,
  recordEchoHistory,
  loadEchoCollection,
  migrateLegacySavedEchoes,
  addToEchoCollection,
  removeFromEchoCollection,
  saveEchoCollection,
  blobToDataUrl,
  loadWorldEchoes,
  publishToWorldPool,
  removeFromWorldPool,
  loadSearchRadius,
  saveSearchRadius,
} from '../lib/echoStorage'
import {
  isInDiscoverRange,
  isEchoScannable,
  isCityDiscoverRadius,
  sortByDistance,
  echoMatchesExplorePlace,
  echoInSameCity,
  formatRangeM,
  echoMapNavTarget,
} from '../lib/echoRange'
import { listFollowing, listFollowers, getProfileCard } from '../lib/social'
import {
  hydrateItemAvatar,
  hydrateItemAvatars,
  liveProfilesRecord,
  peekLiveProfile,
  prefetchLiveProfiles,
} from '../lib/liveAvatars'
import { distanceMeters, blurCoord, randomOffsetInRadius, fuzzHintCoord, reverseGeocode, approxLocationByIp } from '../lib/geo'
import { canHintEcho, canDiscoverEcho, canShowEchoPin, canBrowseGlobally } from '../lib/echoPrivacy'
import { applyCommentReactionToggle } from '../lib/commentReactions'
import {
  echoesInstalled,
  uploadEchoMedia,
  getEchoMediaUrl,
  attachMediaUrls,
  publishEcho as publishEchoRemote,
  listMyEchoes,
  listEchoesNear,
  listEchoesInBbox,
  getEchoById,
  deleteEcho as deleteEchoRemote,
  listEchoComments,
  addEchoComment,
  deleteEchoComment,
  listEchoFeedReactions,
  toggleEchoFeedReaction,
  EchoesNotInstalledError,
} from '../lib/echoes'
import { applyPostReactionToggle, normalizeReactions } from '../lib/postReactions'
import { consumeEchoExplorePlace } from '../lib/notificationNav'

function mergeWithWorld(mineEchoes, userId) {
  const world = loadWorldEchoes().filter((e) => e.ownerId !== userId)
  const byId = new Map()
  mineEchoes.forEach((e) => byId.set(e.id, { ...e, mine: true }))
  world.forEach((e) => {
    if (!byId.has(e.id)) {
      byId.set(e.id, { ...e, mine: false, saved: Boolean(e.saved) })
    }
  })
  return [...byId.values()]
}

export default function EchoMap({ focusEchoId = null, onOpenProfile, onClearEchoFocus }) {
  const { user, profile } = useAuth()
  const { pushLocal } = useNotifications()
  const userId = user?.id ?? null

  const [status, setStatus] = useState('idle')
  const [userPos, setUserPos] = useState(null)
  const [cityLabel, setCityLabel] = useState('your region')
  const [tab, setTab] = useState('map')
  const [echoes, setEchoes] = useState([])
  const [backendReady, setBackendReady] = useState(false)
  const [echoesLoading, setEchoesLoading] = useState(true)
  const [discovered, setDiscovered] = useState(() => loadDiscovered(userId))
  const [hinted, setHinted] = useState(() => loadHinted(userId))
  const [auraMap, setAuraMap] = useState(() => loadEchoAura(userId))
  const [history, setHistory] = useState(() => loadEchoHistory(userId))
  const [historyEchoCache, setHistoryEchoCache] = useState({})
  const [savedCollection, setSavedCollection] = useState(() => (
    userId ? migrateLegacySavedEchoes(userId) : []
  ))
  const [followingIds, setFollowingIds] = useState(() => new Set())
  const [followerIds, setFollowerIds] = useState(() => new Set())
  const [ownerProfiles, setOwnerProfiles] = useState({})
  const [showCreate, setShowCreate] = useState(false)
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !localStorage.getItem(ECHO_INTRO_KEY)
    } catch {
      return true
    }
  })
  const [openId, setOpenId] = useState(null)
  const [exploreClusterEchoes, setExploreClusterEchoes] = useState([])
  const [mapRecoverTick, setMapRecoverTick] = useState(0)
  const [editEcho, setEditEcho] = useState(null)
  const [pendingDeleteEchoId, setPendingDeleteEchoId] = useState(null)
  const [commentsByEchoId, setCommentsByEchoId] = useState({})
  const [reactionsByEchoId, setReactionsByEchoId] = useState({})
  const commentsFetchGen = useRef(0)
  const [sortBy, setSortBy] = useState('newest')
  const [mineView, setMineView] = useState(() => {
    try {
      return localStorage.getItem(ECHO_MINE_VIEW_KEY) === 'list' ? 'list' : 'board'
    } catch {
      return 'board'
    }
  })
  const [mineKindFilter, setMineKindFilter] = useState('all')
  const [collectionKindFilter, setCollectionKindFilter] = useState('all')
  const [searchRadiusM, setSearchRadiusM] = useState(() => loadSearchRadius())
  const [mapMode, setMapMode] = useState('near')
  const [browseEchoes, setBrowseEchoes] = useState([])
  const [exploreCityEchoes, setExploreCityEchoes] = useState([])
  const [explorePlace, setExplorePlace] = useState(null)
  const [exploreCenter, setExploreCenter] = useState(null)
  useEffect(() => {
    if (mapMode !== 'explore' || explorePlace || !userPos) return
    setExploreCenter((prev) => prev ?? blurCoord(userPos))
  }, [mapMode, explorePlace, userPos])

  const refreshBrowseEchoes = useCallback(async (bounds) => {
    if (!backendReady || !bounds) return
    try {
      const rows = await listEchoesInBbox({
        south: bounds.south,
        west: bounds.west,
        north: bounds.north,
        east: bounds.east,
      }, userId)
      const withUrls = await attachMediaUrls(rows.map((e) => ({ ...e, mine: e.ownerId === userId })))
      setBrowseEchoes(withUrls)
    } catch { /* keep last browse list */ }
  }, [backendReady, userId])

  const handleViewportChange = useCallback((viewport) => {
    if (mapMode !== 'explore') return
    setExploreCenter(viewport.center)
    refreshBrowseEchoes(viewport.bounds)
  }, [mapMode, refreshBrowseEchoes])

  function handleSearchPlace(place) {
    if (!place?.lat || !place?.lon) return
    setMapMode('explore')
    setExplorePlace(place)
    setExploreCenter({ lat: place.lat, lon: place.lon })
  }

  // Absolute search (header) → open explore at a place
  useEffect(() => {
    const place = consumeEchoExplorePlace()
    if (!place) return
    handleSearchPlace(place)
    setTab('map')
  }, [])

  function handleClearExplorePlace() {
    setExplorePlace(null)
    if (userPos) setExploreCenter(blurCoord(userPos))
  }

  function handleMapModeChange(nextMode) {
    if (nextMode === 'explore' && !explorePlace) {
      if (userPos) setExploreCenter(blurCoord(userPos))
      else if (!exploreCenter) setExploreCenter({ lat: 20, lon: 0 })
    }
    setMapMode(nextMode)
  }

  const mapCenter = useMemo(() => {
    if (mapMode === 'explore') {
      if (explorePlace) return { lat: explorePlace.lat, lon: explorePlace.lon }
      if (exploreCenter) return exploreCenter
      if (userPos) return blurCoord(userPos)
      return { lat: 20, lon: 0 }
    }
    return userPos ? blurCoord(userPos) : (explorePlace || exploreCenter || { lat: 20, lon: 0 })
  }, [mapMode, exploreCenter, explorePlace, userPos])

  const mapZoom = mapMode === 'explore'
    ? (explorePlace?.zoom ?? 3)
    : 14

  const mapInstanceKey = useMemo(() => {
    if (mapMode !== 'explore') return 'near'
    if (!explorePlace) return 'explore-browse'
    return explorePlace.id
      || `${explorePlace.lat.toFixed(5)}-${explorePlace.lon.toFixed(5)}`
  }, [mapMode, explorePlace])
  const [rangeScanTick, setRangeScanTick] = useState(0)
  const seededRef = useRef(false)
  const watchRef = useRef(null)
  const lastScanPosRef = useRef(null)
  const consumedFocusRef = useRef(null)
  const userPosRef = useRef(userPos)
  userPosRef.current = userPos

  const refreshPosition = useCallback(({ highAccuracy = false } = {}) => new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('no geolocation'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        seedFromPosition(p)
        resolve(p)
      },
      reject,
      {
        enableHighAccuracy: highAccuracy,
        timeout: highAccuracy ? 12000 : 10000,
        maximumAge: highAccuracy ? 0 : 45000,
      },
    )
  }), [])

  const profileForComments = useMemo(() => ({
    userId,
    frenName: profile?.frenName || 'you',
    avatarType: profile?.avatarType || 'frog',
    avatarUrl: profile?.avatarUrl || null,
  }), [userId, profile])

  const frenGraph = useMemo(
    () => ({ followingIds, followerIds }),
    [followingIds, followerIds],
  )

  useEffect(() => {
    if (mapMode !== 'explore' || !explorePlace?.lat || !explorePlace?.lon || !backendReady || !userId) {
      setExploreCityEchoes([])
      return undefined
    }

    let cancelled = false
    ;(async () => {
      try {
        const rows = await listEchoesNear(
          explorePlace.lat,
          explorePlace.lon,
          ECHO_CITY_RADIUS_M,
          userId,
        )
        const filtered = rows.filter((e) => canDiscoverEcho(e, frenGraph))
        const withUrls = await attachMediaUrls(
          filtered.map((e) => ({ ...e, mine: e.ownerId === userId })),
        )
        if (!cancelled) setExploreCityEchoes(withUrls)
      } catch (err) {
        console.error('Could not load city echoes:', err?.message || err)
      }
    })()

    return () => { cancelled = true }
  }, [
    mapMode,
    explorePlace?.lat,
    explorePlace?.lon,
    explorePlace?.label,
    backendReady,
    userId,
    frenGraph,
  ])

  const refreshServerEchoes = useCallback(async () => {
    if (!userId || !backendReady) return
    try {
      const mine = await listMyEchoes(userId)
      let nearby = []
      if (userPos) {
        try {
          nearby = await listEchoesNear(
            userPos.lat,
            userPos.lon,
            Math.max(searchRadiusM, ECHO_CITY_RADIUS_M),
            userId,
          )
        } catch (err) {
          console.error('Could not load nearby echoes:', err?.message || err)
        }
      }
      const byId = new Map()
      mine.forEach((e) => {
        byId.set(e.id, {
          ...e,
          mine: true,
          authorName: e.anonymous ? (e.authorName || 'a fren') : (profile?.frenName?.trim() || e.authorName),
          avatarType: e.anonymous ? 'frog' : (profile?.avatarType || e.avatarType),
          avatarUrl: e.anonymous ? null : (profile?.avatarUrl ?? e.avatarUrl),
        })
      })
      const localCollection = loadEchoCollection(userId)
      const savedById = new Map(localCollection.map((s) => [s.id, s]))
      nearby.forEach((e) => {
        if (e.ownerId === userId) return
        if (!canDiscoverEcho(e, frenGraph)) return
        const savedEntry = savedById.get(e.id)
        byId.set(e.id, {
          ...e,
          mine: false,
          saved: Boolean(savedEntry),
          savedAt: savedEntry?.savedAt,
        })
      })
      // Same-browser dev fallback — local world pool from other accounts.
      loadWorldEchoes().forEach((e) => {
        if (e.ownerId === userId || byId.has(e.id)) return
        if (!canDiscoverEcho(e, frenGraph)) return
        const savedEntry = savedById.get(e.id)
        byId.set(e.id, {
          ...e,
          mine: false,
          saved: Boolean(savedEntry),
          savedAt: savedEntry?.savedAt,
        })
      })
      const merged = [...byId.values()]
      localCollection.forEach((saved) => {
        if (!byId.has(saved.id)) merged.push({ ...saved, mine: false, saved: true })
      })
      const withUrls = await attachMediaUrls(merged)
      setEchoes(withUrls)
    } catch (err) {
      console.error('Echo refresh failed:', err?.message || err)
    }
  }, [userId, backendReady, userPos, frenGraph, profile, searchRadiusM])

  const mergeRemoteEcho = useCallback(async (echoId) => {
    if (!userId || !backendReady || !echoId) return
    try {
      const fetched = await getEchoById(echoId, userId)
      if (!fetched || fetched.ownerId === userId || !canDiscoverEcho(fetched, frenGraph)) return
      const [withUrl] = await attachMediaUrls([{ ...fetched, mine: false }])
      setEchoes((prev) => {
        if (prev.some((e) => e.id === echoId)) {
          return prev.map((e) => (e.id === echoId ? { ...e, ...withUrl, mine: false } : e))
        }
        return [...prev, withUrl]
      })
    } catch {
      refreshServerEchoes()
    }
  }, [userId, backendReady, frenGraph, refreshServerEchoes])

  useEffect(() => {
    let cancelled = false
    echoesInstalled().then((ok) => {
      if (!cancelled) setBackendReady(ok)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!userId) {
      setEchoes([])
      setEchoesLoading(false)
      return
    }
    setDiscovered(loadDiscovered(userId))
    setHinted(loadHinted(userId))
    setAuraMap(loadEchoAura(userId))
    setHistory(loadEchoHistory(userId))
    setSavedCollection(migrateLegacySavedEchoes(userId))

    if (backendReady) {
      setEchoesLoading(true)
      refreshServerEchoes().finally(() => setEchoesLoading(false))
      return
    }
    setEchoes(mergeWithWorld(loadEchoes(userId), userId))
    setEchoesLoading(false)
  }, [userId, backendReady, refreshServerEchoes])

  useEffect(() => {
    if (!userId || backendReady) return
    saveEchoes(userId, echoes.filter((e) => e.mine))
  }, [echoes, userId, backendReady])

  useEffect(() => {
    saveDiscovered(userId, discovered)
  }, [discovered, userId])

  useEffect(() => {
    saveHinted(userId, hinted)
  }, [hinted, userId])

  useEffect(() => {
    saveEchoAura(userId, auraMap)
  }, [auraMap, userId])

  useEffect(() => {
    if (!userId) return
    listFollowing(userId)
      .then((list) => setFollowingIds(new Set(list.map((p) => p.userId))))
      .catch(() => {})
    listFollowers(userId)
      .then((list) => setFollowerIds(new Set(list.map((p) => p.userId))))
      .catch(() => {})
  }, [userId])

  const avatarHydrateOpts = useMemo(
    () => ({ selfUserId: userId, selfProfile: profile }),
    [userId, profile],
  )

  const hydrateEchoList = useCallback(
    (list) => hydrateItemAvatars(list, ownerProfiles, avatarHydrateOpts),
    [ownerProfiles, avatarHydrateOpts],
  )

  // Keep echo author avatars + handles in sync with live profiles.
  useEffect(() => {
    if (!userId) return undefined

    const ownerIds = [...new Set(
      [...echoes, ...browseEchoes, ...exploreCityEchoes]
        .filter((e) => e.ownerId && !e.mine && !e.anonymous)
        .map((e) => e.ownerId),
    )]
    if (ownerIds.length === 0) return undefined

    let cancelled = false
    prefetchLiveProfiles(ownerIds).then(() => {
      if (cancelled) return
      const next = liveProfilesRecord()
      setOwnerProfiles((prev) => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
        for (const k of keys) {
          const a = prev[k]
          const b = next[k]
          if (
            a?.avatarUrl !== b?.avatarUrl
            || a?.avatarType !== b?.avatarType
            || a?.frenName !== b?.frenName
          ) {
            return next
          }
        }
        return prev
      })
    })
    return () => { cancelled = true }
  }, [userId, echoes, browseEchoes, exploreCityEchoes])

  useEffect(() => {
    if (!focusEchoId) {
      consumedFocusRef.current = null
      return undefined
    }
    if (consumedFocusRef.current === focusEchoId) return undefined

    let cancelled = false

    async function openFocused() {
      let echo = echoes.find((e) => e.id === focusEchoId)
        || browseEchoes.find((e) => e.id === focusEchoId)

      if (!echo && backendReady && userId) {
        try {
          const fetched = await getEchoById(focusEchoId, userId)
          if (fetched && canDiscoverEcho(fetched, frenGraph)) {
            const [withUrl] = await attachMediaUrls([{ ...fetched, mine: false }])
            echo = withUrl
            if (!cancelled) {
              setEchoes((prev) => (
                prev.some((e) => e.id === focusEchoId) ? prev : [...prev, echo]
              ))
            }
          }
        } catch { /* ignore */ }
      }

      if (!echo || cancelled) return

      consumedFocusRef.current = focusEchoId
      onClearEchoFocus?.()
      setTab(echo.mine ? 'mine' : 'map')
      setOpenId(focusEchoId)
      if (!echo.mine && ECHO_PUBLIC_VISIBILITIES.has(echo.visibility)) {
        setDiscovered((prev) => new Set([...prev, focusEchoId]))
        setHinted((prev) => new Set([...prev, focusEchoId]))
      }
      if (echo.lat != null && echo.lon != null) {
        setMapMode('near')
        setExplorePlace(null)
      }
    }

    openFocused()
    return () => { cancelled = true }
  }, [focusEchoId, echoes, browseEchoes, backendReady, userId, frenGraph, onClearEchoFocus])

  function closeOpenEcho() {
    setOpenId(null)
    setExploreClusterEchoes([])
    setMapRecoverTick((t) => t + 1)
    if (focusEchoId) onClearEchoFocus?.()
  }

  async function seedFromPosition(p, { approx = false } = {}) {
    setUserPos(p)
    setStatus('located')
    if (!seededRef.current) {
      seededRef.current = true
      try {
        const city = await reverseGeocode(p.lat, p.lon)
        setCityLabel(approx ? `${city} (approx · dev)` : city)
      } catch {
        setCityLabel(approx ? 'your region (approx · dev)' : 'your region')
      }
    }
  }

  async function locate() {
    if (!window.isSecureContext) {
      if (import.meta.env.DEV) {
        setStatus('locating')
        try {
          const p = await approxLocationByIp()
          await seedFromPosition({ lat: p.lat, lon: p.lon }, { approx: true })
        } catch {
          await seedFromPosition({ lat: 37.7749, lon: -122.4194 }, { approx: true })
        }
        return
      }
      setStatus('insecure')
      return
    }
    if (!('geolocation' in navigator)) {
      setStatus('denied')
      return
    }
    setStatus('locating')
    try {
      await refreshPosition({ highAccuracy: false })
    } catch {
      setStatus('denied')
    }
  }

  // Request location when opening the map so nearby echoes can load.
  useEffect(() => {
    if (tab !== 'map' || status !== 'idle') return
    locate().catch(() => {})
  }, [tab, status])

  // Low-accuracy refresh while the map tab is open — not continuous high-accuracy tracking.
  useEffect(() => {
    if (tab !== 'map' || status !== 'located' || !window.isSecureContext) return undefined
    if (!('geolocation' in navigator)) return undefined

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        seedFromPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      () => {},
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    )

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
      }
    }
  }, [tab, status])

  // Every 10s, refresh in-range gallery when the user has moved.
  useEffect(() => {
    if (tab !== 'map' || status !== 'located') return undefined

    const tick = () => {
      const pos = userPosRef.current
      if (!pos) return
      const prev = lastScanPosRef.current
      if (prev && distanceMeters(prev, pos) < ECHO_MOVE_THRESHOLD_M) return
      lastScanPosRef.current = pos
      setRangeScanTick((n) => n + 1)
      refreshPosition({ highAccuracy: false }).catch(() => {})
      if (backendReady) refreshServerEchoes()
    }

    if (userPosRef.current && !lastScanPosRef.current) {
      lastScanPosRef.current = userPosRef.current
    }
    const id = setInterval(tick, ECHO_POSITION_REFRESH_MS)
    return () => clearInterval(id)
  }, [tab, status, backendReady, refreshServerEchoes, refreshPosition])

  function handleSearchRadiusChange(meters) {
    setSearchRadiusM(meters)
    saveSearchRadius(meters)
  }

  const resolveActorName = useCallback(async (echo) => {
    if (echo.ownerId && echo.ownerId !== userId) {
      const cached = peekLiveProfile(echo.ownerId)
      if (cached?.frenName) return cached.frenName
      try {
        const card = await getProfileCard(echo.ownerId)
        if (card?.frenName) return card.frenName
      } catch { /* ignore */ }
    }
    return echo.authorName || 'a fren'
  }, [userId])

  // Followed fren left echo in your city — local hint when backend notifications unavailable.
  useEffect(() => {
    if (!userPos || backendReady) return

    const newlyHinted = echoes.filter(
      (e) =>
        canHintEcho(e, frenGraph) &&
        (followingIds.has(e.ownerId) || followerIds.has(e.ownerId)) &&
        !hinted.has(e.id) &&
        distanceMeters(userPos, { lat: e.lat, lon: e.lon }) <= ECHO_CITY_RADIUS_M,
    )
    if (newlyHinted.length === 0) return

    setHinted((prev) => {
      const next = new Set(prev)
      newlyHinted.forEach((e) => next.add(e.id))
      return next
    })

    newlyHinted.forEach(async (e) => {
      const name = await resolveActorName(e)
      pushLocal({
        type: 'echo_follow',
        echoId: e.id,
        actorId: e.ownerId,
        actorName: name,
        actorAvatarType: e.avatarType,
        actorAvatarUrl: e.avatarUrl,
        cityLabel,
        dedupeKey: `echo-follow:${e.id}`,
      })
    })
  }, [userPos, echoes, hinted, frenGraph, followingIds, followerIds, pushLocal, cityLabel, resolveActorName, backendReady])

  // Realtime + notification refresh — pick up new echoes from other frens.
  useEffect(() => {
    if (!backendReady || !userId) return undefined

    function onNotificationsRefreshed(e) {
      const rows = e.detail?.rows
      if (!rows?.some((n) => (
        n.type === 'echo_published'
        || n.type === 'echo_friends'
        || n.type === 'echo_follow'
      ))) return
      refreshServerEchoes()
    }

    window.addEventListener('frens:notifications-refreshed', onNotificationsRefreshed)

    const channel = supabase
      .channel(`echo-map:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'echoes' },
        (payload) => {
          const row = payload.new
          if (!row || row.hidden || row.visibility === 'private') return
          if (row.owner_id === userId) return
          mergeRemoteEcho(row.id)
          refreshServerEchoes()
        },
      )
      .subscribe()

    return () => {
      window.removeEventListener('frens:notifications-refreshed', onNotificationsRefreshed)
      supabase.removeChannel(channel)
    }
  }, [backendReady, userId, refreshServerEchoes, mergeRemoteEcho])

  // Physically close — discover & open notification.
  useEffect(() => {
    if (!userPos) return

    const newlyDiscovered = echoes.filter(
      (e) =>
        canDiscoverEcho(e, frenGraph) &&
        !discovered.has(e.id) &&
        isInDiscoverRange(e, userPos) &&
        isEchoScannable(e, userPos, searchRadiusM) &&
        !isCityDiscoverRadius(e),
    )
    if (newlyDiscovered.length === 0) return

    setDiscovered((prev) => {
      const next = new Set(prev)
      newlyDiscovered.forEach((e) => next.add(e.id))
      return next
    })

    newlyDiscovered.forEach(async (e) => {
      const name = await resolveActorName(e)
      pushLocal({
        type: 'echo',
        echoId: e.id,
        actorId: e.ownerId,
        actorName: name,
        actorAvatarType: e.avatarType,
        actorAvatarUrl: e.avatarUrl,
        dedupeKey: `echo-discover:${e.id}`,
      })
    })
  }, [userPos, echoes, discovered, frenGraph, pushLocal, resolveActorName])

  const liveEchoes = useMemo(
    () => hydrateEchoList(echoes),
    [echoes, hydrateEchoList],
  )

  const liveBrowseEchoes = useMemo(
    () => hydrateEchoList(browseEchoes),
    [browseEchoes, hydrateEchoList],
  )

  const liveExploreCityEchoes = useMemo(
    () => hydrateEchoList(exploreCityEchoes),
    [exploreCityEchoes, hydrateEchoList],
  )

  const mapEchoes = useMemo(
    () => liveEchoes.filter((e) => canShowEchoPin(e, { discovered })),
    [liveEchoes, discovered],
  )

  const batHints = useMemo(() => {
    if (!userPos) return []
    return liveEchoes
      .filter((e) => {
        if (!canHintEcho(e, frenGraph)) return false
        if (discovered.has(e.id)) return false
        if (!isEchoScannable(e, userPos, searchRadiusM)) return false
        if (isCityDiscoverRadius(e)) return true
        return !isInDiscoverRange(e, userPos)
      })
      .map((e) => {
        const cityWide = isCityDiscoverRadius(e)
        const fuzzRadiusM = cityWide ? ECHO_CITY_HINT_FUZZ_RADIUS_M : ECHO_HINT_FUZZ_RADIUS_M
        const fuzzy = fuzzHintCoord(e.id, { lat: e.lat, lon: e.lon }, fuzzRadiusM)
        return {
          id: e.id,
          lat: fuzzy.lat,
          lon: fuzzy.lon,
          zoneRadiusM: cityWide ? ECHO_CITY_HINT_ZONE_RADIUS_M : ECHO_HINT_ZONE_RADIUS_M,
          cityWide,
          global: canBrowseGlobally(e),
        }
      })
  }, [liveEchoes, discovered, userPos, frenGraph, searchRadiusM])

  const inRangeEchoes = useMemo(() => {
    if (!userPos) return []
    return sortByDistance(
      liveEchoes.filter(
        (e) =>
          canDiscoverEcho(e, frenGraph) &&
          isEchoScannable(e, userPos, searchRadiusM) &&
          isInDiscoverRange(e, userPos),
      ),
      userPos,
    )
  }, [liveEchoes, userPos, frenGraph, searchRadiusM, rangeScanTick])

  const nearbyForPlaces = useMemo(() => {
    if (!userPos) return []
    return sortByDistance(
      liveEchoes.filter(
        (e) =>
          canDiscoverEcho(e, frenGraph) &&
          isEchoScannable(e, userPos, searchRadiusM),
      ),
      userPos,
    )
  }, [liveEchoes, userPos, frenGraph, searchRadiusM, rangeScanTick])

  const placeGroups = useMemo(
    () => groupEchoesByPlace(nearbyForPlaces),
    [nearbyForPlaces],
  )

  const swipeGalleryEchoes = useMemo(() => {
    function mergeDiscoverable(...lists) {
      const byId = new Map()
      lists.flat().forEach((e) => {
        if (!e?.id || byId.has(e.id)) return
        if (!e.mine && !canDiscoverEcho(e, frenGraph)) return
        byId.set(e.id, e)
      })
      return [...byId.values()]
    }

    function decorate(list, anchor) {
      return list.map((echo) => ({
        ...echo,
        inRange: userPos
          ? isInDiscoverRange(echo, userPos)
          : canBrowseGlobally(echo),
      })).sort((a, b) => {
        if (!anchor?.lat || !anchor?.lon) return 0
        const da = distanceMeters(anchor, { lat: a.lat, lon: a.lon })
        const db = distanceMeters(anchor, { lat: b.lat, lon: b.lon })
        return da - db
      })
    }

    if (mapMode === 'near') {
      if (!userPos) return []
      const scanRadius = Math.max(searchRadiusM, ECHO_CITY_RADIUS_M)
      const merged = mergeDiscoverable(
        liveEchoes.filter(
          (e) => !e.mine && canDiscoverEcho(e, frenGraph) && echoInSameCity(e, cityLabel),
        ),
        liveEchoes.filter(
          (e) =>
            !e.mine &&
            canDiscoverEcho(e, frenGraph) &&
            isEchoScannable(e, userPos, scanRadius),
        ),
      )
      if (merged.length === 0) return []
      return decorate(merged, userPos)
    }

    if (mapMode === 'explore') {
      const anchor = explorePlace || exploreCenter
      const placeLabel = explorePlace?.label
      const fromBrowse = explorePlace
        ? liveBrowseEchoes.filter(
            (e) =>
              echoMatchesExplorePlace(e, explorePlace)
              || (placeLabel && echoInSameCity(e, placeLabel)),
          )
        : liveBrowseEchoes
      const merged = mergeDiscoverable(explorePlace ? liveExploreCityEchoes : [], fromBrowse)
      if (merged.length === 0) return []
      return decorate(merged, anchor)
    }

    return []
  }, [
    mapMode,
    userPos,
    cityLabel,
    liveEchoes,
    searchRadiusM,
    explorePlace,
    exploreCenter,
    liveBrowseEchoes,
    liveExploreCityEchoes,
    frenGraph,
  ])

  const exploreMapEchoes = useMemo(() => {
    if (mapMode !== 'explore') return []
    const byId = new Map()
    for (const echo of liveExploreCityEchoes) {
      if (echo?.id && Number.isFinite(echo.lat) && Number.isFinite(echo.lon)) {
        byId.set(echo.id, echo)
      }
    }
    for (const echo of liveBrowseEchoes) {
      if (echo?.id && Number.isFinite(echo.lat) && Number.isFinite(echo.lon)) {
        byId.set(echo.id, echo)
      }
    }
    return [...byId.values()]
  }, [mapMode, liveExploreCityEchoes, liveBrowseEchoes])

  const swipeGalleryTitle = useMemo(() => {
    if (mapMode === 'near') {
      return cityLabel && cityLabel !== 'your region'
        ? `Public aftersounds · ${cityLabel}`
        : 'Public aftersounds near you'
    }
    if (explorePlace?.label) return `Public aftersounds · ${explorePlace.label}`
    return 'World aftersounds in this view'
  }, [mapMode, cityLabel, explorePlace])

  const mapOverlayOpen = showCreate || !!openId || showIntro
  const mapHidden = mapOverlayOpen

  const myEchoes = useMemo(() => {
    const list = liveEchoes.filter((e) => e.mine)
    const sorted = [...list]
    if (sortBy === 'oldest') sorted.sort((a, b) => a.createdAt - b.createdAt)
    else if (sortBy === 'kind') sorted.sort((a, b) => a.kind.localeCompare(b.kind))
    else sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    return sorted
  }, [liveEchoes, sortBy])

  const mineKindCounts = useMemo(() => {
    const counts = { all: myEchoes.length, image: 0, video: 0, audio: 0 }
    myEchoes.forEach((e) => {
      if (e.kind === 'image') counts.image += 1
      else if (e.kind === 'video') counts.video += 1
      else if (e.kind === 'audio') counts.audio += 1
    })
    return counts
  }, [myEchoes])

  const filteredMyEchoes = useMemo(() => {
    if (mineKindFilter === 'all') return myEchoes
    return myEchoes.filter((e) => e.kind === mineKindFilter)
  }, [myEchoes, mineKindFilter])

  const displayCollection = useMemo(() => {
    return savedCollection
      .map((entry) => {
        const live = liveEchoes.find((e) => e.id === entry.id)
          || browseEchoes.find((e) => e.id === entry.id)
        if (!live) return { ...entry, saved: true, mine: false }
        return {
          ...live,
          saved: true,
          savedAt: entry.savedAt ?? live.savedAt,
          mediaPath: entry.mediaPath || live.mediaPath,
          mediaUrl: entry.mediaUrl || live.mediaUrl,
          collectionPreviewUrl: entry.collectionPreviewUrl || entry.mediaUrl || live.mediaUrl,
          coverPath: entry.coverPath || live.coverPath,
          coverUrl: entry.coverUrl || live.coverUrl,
          mine: false,
        }
      })
      .filter((e) => !e.mine)
      .sort((a, b) => (b.savedAt ?? b.createdAt ?? 0) - (a.savedAt ?? a.createdAt ?? 0))
  }, [savedCollection, liveEchoes, browseEchoes])

  const collectionKindCounts = useMemo(() => {
    const counts = { all: displayCollection.length, image: 0, video: 0, audio: 0 }
    displayCollection.forEach((e) => {
      if (e.kind === 'image') counts.image += 1
      else if (e.kind === 'video') counts.video += 1
      else if (e.kind === 'audio') counts.audio += 1
    })
    return counts
  }, [displayCollection])

  const filteredCollection = useMemo(() => {
    const list = collectionKindFilter === 'all'
      ? displayCollection
      : displayCollection.filter((e) => e.kind === collectionKindFilter)
    const sorted = [...list]
    if (sortBy === 'oldest') {
      sorted.sort((a, b) => (a.savedAt ?? a.createdAt ?? 0) - (b.savedAt ?? b.createdAt ?? 0))
    } else if (sortBy === 'kind') {
      sorted.sort((a, b) => a.kind.localeCompare(b.kind))
    } else {
      sorted.sort((a, b) => (b.savedAt ?? b.createdAt ?? 0) - (a.savedAt ?? a.createdAt ?? 0))
    }
    return sorted
  }, [displayCollection, collectionKindFilter, sortBy])

  const findEchoById = useCallback((id) => {
    if (!id) return null
    return liveEchoes.find((e) => e.id === id)
      || liveBrowseEchoes.find((e) => e.id === id)
      || liveExploreCityEchoes.find((e) => e.id === id)
      || displayCollection.find((e) => e.id === id)
      || historyEchoCache[id]
      || null
  }, [liveEchoes, liveBrowseEchoes, liveExploreCityEchoes, displayCollection, historyEchoCache])

  function handleMineViewChange(view) {
    setMineView(view)
    try {
      localStorage.setItem(ECHO_MINE_VIEW_KEY, view)
    } catch { /* ignore */ }
  }

  function touchEchoHistory(echo, { interaction } = {}) {
    if (!userId || !echo?.id) return
    const previewUrl = echoWatchedPreviewUrl(echo) || echo.collectionPreviewUrl || echo.mediaUrl || echo.coverUrl || null
    const next = recordEchoHistory(userId, {
      echoId: echo.id,
      kind: echo.kind,
      authorName: echo.authorName,
      ownerId: echo.ownerId,
      label: echo.label || '',
      visibility: echo.visibility || 'world',
      discoverRadiusM: echo.discoverRadiusM,
      browseGlobally: echo.browseGlobally,
      mediaPath: echo.mediaPath || null,
      coverPath: echo.coverPath || null,
      collectionPreviewUrl: previewUrl,
      avatarType: echo.avatarType,
      avatarUrl: echo.avatarUrl,
      interaction: interaction || 'viewed',
    })
    setHistory(next)
  }

  const heardCollection = useMemo(() => history.map((h) => {
    const live = findEchoById(h.echoId)
    const previewUrl = h.collectionPreviewUrl || live?.collectionPreviewUrl || echoWatchedPreviewUrl(live) || null
    const echo = live
      ? {
          ...live,
          collectionPreviewUrl: previewUrl || live.collectionPreviewUrl,
          mediaUrl: live.mediaUrl || (live.kind === 'image' ? previewUrl : live.mediaUrl),
          coverUrl: live.coverUrl || (live.kind !== 'image' ? previewUrl : live.coverUrl),
        }
      : hydrateItemAvatar({
        id: h.echoId,
        kind: h.kind,
        authorName: h.authorName,
        ownerId: h.ownerId,
        label: h.label || '',
        visibility: h.visibility || 'world',
        discoverRadiusM: h.discoverRadiusM,
        browseGlobally: h.browseGlobally,
        mediaPath: h.mediaPath || null,
        coverPath: h.coverPath || null,
        collectionPreviewUrl: previewUrl,
        mediaUrl: h.kind === 'image' ? previewUrl : null,
        coverUrl: h.kind !== 'image' ? previewUrl : null,
        avatarType: h.avatarType,
        avatarUrl: h.avatarUrl,
        mine: false,
      }, ownerProfiles, avatarHydrateOpts)
    return {
      heardAt: h.listenedAt,
      interaction: h.interaction,
      echo,
    }
  }), [history, liveEchoes, liveBrowseEchoes, liveExploreCityEchoes, displayCollection, historyEchoCache, ownerProfiles, avatarHydrateOpts])

  useEffect(() => {
    if (tab !== 'history' || !userId || history.length === 0) return undefined

    let cancelled = false
    ;(async () => {
      for (const h of history) {
        const live = echoes.find((e) => e.id === h.echoId)
          || browseEchoes.find((e) => e.id === h.echoId)
          || exploreCityEchoes.find((e) => e.id === h.echoId)
          || displayCollection.find((e) => e.id === h.echoId)
        if (live?.mediaUrl || h.collectionPreviewUrl) continue
        if (!backendReady) continue

        try {
          let row = live || {
            id: h.echoId,
            kind: h.kind,
            mediaPath: h.mediaPath,
            coverPath: h.coverPath,
          }
          if (!row.mediaPath && !row.coverPath) {
            const fetched = await getEchoById(h.echoId, userId)
            if (fetched) row = fetched
          }
          const [withUrl] = await attachMediaUrls([{ ...row, mine: false }])
          if (cancelled || !withUrl) continue
          setHistoryEchoCache((prev) => (
            prev[h.echoId]?.mediaUrl ? prev : { ...prev, [h.echoId]: withUrl }
          ))
        } catch { /* ignore */ }
      }
    })()

    return () => { cancelled = true }
  }, [tab, history, userId, backendReady, echoes, browseEchoes, exploreCityEchoes, displayCollection])

  function openCreateFlow() {
    if (!window.isSecureContext && !import.meta.env.DEV) {
      locate()
      return
    }
    setShowCreate(true)
    if (!userPos) locate().catch(() => {})
    refreshPosition({ highAccuracy: true }).catch(() => {})
  }

  function dismissIntro(startCreate = false) {
    try {
      localStorage.setItem(ECHO_INTRO_KEY, '1')
    } catch { /* ignore */ }
    setShowIntro(false)
    if (startCreate) openCreateFlow()
  }

  async function publishEcho({
    kind, mediaUrl, mediaBlob, coverUrl, coverBlob,
    visibility, allowComments, anonymous, voiceFilter, senseFilter, spatial, pinPosition,
    discoverRadiusM, placeLabel, browseGlobally, expiresAt, title,
  }) {
    const handle = profile?.frenName?.trim() || 'you'
    const stayAnon = Boolean(anonymous)
    const spot = pinPosition
      || (spatial?.position
        ? { lat: spatial.position.lat, lon: spatial.position.lon }
        : userPos
          ? randomOffsetInRadius(userPos, ECHO_PIN_OFFSET_MAX_M)
          : { lat: 0, lon: 0 })
    const vis = visibility ?? 'world'
    const discoverR = ECHO_PUBLIC_VISIBILITIES.has(vis)
      ? (discoverRadiusM ?? ECHO_DEFAULT_DISCOVER_RADIUS_M)
      : null

    if (backendReady && mediaBlob && userId) {
      try {
        const mediaPath = await uploadEchoMedia(mediaBlob)
        const coverPath = coverBlob ? await uploadEchoMedia(coverBlob) : null
        const id = await publishEchoRemote({
          kind,
          visibility: vis,
          mediaPath,
          coverPath,
          lat: spot.lat,
          lon: spot.lon,
          voiceFilter: kind === 'audio' ? (voiceFilter ?? 'normal') : null,
          senseFilter: kind === 'video' ? (senseFilter ?? 'clear') : null,
          allowComments,
          shareOnProfile: ECHO_PUBLIC_VISIBILITIES.has(vis),
          label: '',
          title: title || '',
          cityLabel,
          placeLabel: placeLabel || null,
          browseGlobally: Boolean(browseGlobally),
          expiresAt: expiresAt || null,
          discoverRadiusM: discoverR,
          anonymous: stayAnon,
        })
        const resolvedUrl = await getEchoMediaUrl(mediaPath)
        const resolvedCover = coverPath ? await getEchoMediaUrl(coverPath) : null
        const echo = {
          id,
          kind,
          mediaUrl: resolvedUrl,
          mediaPath,
          coverUrl: resolvedCover || coverUrl || null,
          coverPath,
          ownerId: userId,
          authorName: handle,
          avatarType: profile?.avatarType || 'frog',
          avatarUrl: stayAnon ? null : (profile?.avatarUrl || null),
          anonymous: stayAnon,
          lat: spot.lat,
          lon: spot.lon,
          visibility: vis,
          shareOnProfile: ECHO_PUBLIC_VISIBILITIES.has(vis),
          allowComments: Boolean(allowComments),
          voiceFilter: kind === 'audio' ? (voiceFilter ?? 'normal') : null,
          senseFilter: kind === 'video' ? (senseFilter ?? 'clear') : null,
          spatial: spatial ?? null,
          discoverRadiusM: discoverR,
          placeLabel: placeLabel || null,
          browseGlobally: Boolean(browseGlobally),
          expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
          auraCount: 0,
          comments: [],
          createdAt: Date.now(),
          mine: true,
          saved: false,
          label: '',
          title: (title || '').trim().slice(0, 222),
        }
        setEchoes((prev) => [echo, ...prev])
        setShowCreate(false)
        dismissIntro(false)
        return
      } catch (err) {
        console.error('Echo publish failed:', err)
        const raw = err?.message || 'Could not publish aftersound'
        if (kind === 'image' && /kind|check|invalid/i.test(raw)) {
          throw new Error('Meme aftersounds need supabase-patch-echoes-images.sql run in Supabase SQL Editor.')
        }
        throw new Error(raw)
      }
    }

    const storedUrl = mediaBlob ? await blobToDataUrl(mediaBlob) : mediaUrl
    const storedCover = coverBlob ? await blobToDataUrl(coverBlob) : coverUrl
    const echo = {
      id: `echo-${Date.now()}`,
      kind,
      mediaUrl: storedUrl,
      coverUrl: storedCover || null,
      ownerId: userId ?? 'me',
      authorName: handle,
      avatarType: profile?.avatarType || 'frog',
      avatarUrl: stayAnon ? null : (profile?.avatarUrl || null),
      anonymous: stayAnon,
      lat: spot.lat,
      lon: spot.lon,
      visibility: vis,
      shareOnProfile: ECHO_PUBLIC_VISIBILITIES.has(vis),
      allowComments: Boolean(allowComments),
      voiceFilter: kind === 'audio' ? (voiceFilter ?? 'normal') : null,
      senseFilter: kind === 'video' ? (senseFilter ?? 'clear') : null,
      spatial: spatial ?? null,
      discoverRadiusM: discoverR,
      placeLabel: placeLabel || null,
      browseGlobally: Boolean(browseGlobally),
      expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
      auraCount: 0,
      comments: [],
      createdAt: Date.now(),
      mine: true,
      saved: false,
      label: '',
      title: (title || '').trim().slice(0, 222),
    }
    setEchoes((prev) => [echo, ...prev])
    if (!backendReady && ECHO_PUBLIC_VISIBILITIES.has(echo.visibility)) publishToWorldPool(echo)
    setShowCreate(false)
    dismissIntro(false)
  }

  async function deleteEcho(id) {
    if (!id) return

    if (backendReady) {
      try {
        await deleteEchoRemote(id)
      } catch (err) {
        console.error('Echo delete failed:', err)
        window.alert(err?.message || 'Could not delete aftersound.')
        return
      }
    } else {
      removeFromWorldPool(id)
    }
    setEchoes((prev) => prev.filter((e) => e.id !== id))
    setBrowseEchoes((prev) => prev.filter((e) => e.id !== id))
    closeOpenEcho()
    setEditEcho(null)
  }

  function saveEcho(id) {
    const echo = echoes.find((e) => e.id === id)
      || browseEchoes.find((e) => e.id === id)
      || displayCollection.find((e) => e.id === id)
    if (!echo || echo.mine) return
    const next = addToEchoCollection(userId, echo)
    setSavedCollection(next)
    setEchoes((prev) => prev.map((e) => (
      e.id === id ? { ...e, saved: true, savedAt: Date.now() } : e
    )))
  }

  function unsaveEcho(id) {
    if (!userId || !id) return
    const next = removeFromEchoCollection(userId, id)
    setSavedCollection(next)
    setEchoes((prev) => prev.map((e) => (
      e.id === id ? { ...e, saved: false, savedAt: undefined } : e
    )))
    if (openId === id) closeOpenEcho()
  }

  useEffect(() => {
    if (!backendReady || !userId || tab !== 'collection') return undefined
    if (savedCollection.length === 0) return undefined

    let cancelled = false
    ;(async () => {
      let changed = false
      const next = await Promise.all(savedCollection.map(async (entry) => {
        let row = entry
        if (row.kind === 'image' && !row.mediaPath) {
          try {
            const fetched = await getEchoById(row.id, userId)
            if (fetched?.mediaPath) {
              row = {
                ...row,
                mediaPath: fetched.mediaPath,
                coverPath: fetched.coverPath || row.coverPath,
                kind: fetched.kind || row.kind,
              }
            }
          } catch { /* ignore */ }
        }
        if (row.kind !== 'image' || !row.mediaPath) return row
        try {
          const url = await getEchoMediaUrl(row.mediaPath)
          if (!url) return row
          if (url === row.collectionPreviewUrl && url === row.mediaUrl) return row
          changed = true
          return { ...row, mediaUrl: url, collectionPreviewUrl: url }
        } catch {
          if (!row.collectionPreviewUrl && !row.mediaUrl) return row
          changed = true
          return { ...row, mediaUrl: null, collectionPreviewUrl: null }
        }
      }))
      if (cancelled || !changed) return
      setSavedCollection(next)
      saveEchoCollection(userId, next)
      setEchoes((prev) => prev.map((e) => {
        const refreshed = next.find((n) => n.id === e.id)
        if (!refreshed?.mediaUrl) return e
        return {
          ...e,
          mediaUrl: refreshed.mediaUrl,
          collectionPreviewUrl: refreshed.collectionPreviewUrl,
          mediaPath: refreshed.mediaPath || e.mediaPath,
        }
      }))
    })()
    return () => { cancelled = true }
  }, [backendReady, userId, tab, savedCollection])

  useEffect(() => {
    if (!openId || !backendReady) return
    const echo = echoes.find((e) => e.id === openId)
      || displayCollection.find((e) => e.id === openId)
      || browseEchoes.find((e) => e.id === openId)
    if (!echo) return
    const needsMedia = echo.mediaPath && !echo.mediaUrl
    const needsCover = echo.coverPath && !echo.coverUrl
    if (!needsMedia && !needsCover) return
    ;(async () => {
      const updates = {}
      if (needsMedia) {
        try { updates.mediaUrl = await getEchoMediaUrl(echo.mediaPath) } catch { /* */ }
      }
      if (needsCover) {
        try { updates.coverUrl = await getEchoMediaUrl(echo.coverPath) } catch { /* */ }
      }
      if (Object.keys(updates).length === 0) return
      setEchoes((prev) => prev.map((e) => (e.id === openId ? { ...e, ...updates } : e)))
      setSavedCollection((prev) => {
        if (!prev.some((e) => e.id === openId)) return prev
        const next = prev.map((e) => (e.id === openId ? { ...e, ...updates } : e))
        saveEchoCollection(userId, next)
        return next
      })
    })()
  }, [openId, backendReady, echoes, displayCollection, browseEchoes, userId])

  useEffect(() => {
    if (!openId || !backendReady) return undefined
    const echoId = openId
    const gen = ++commentsFetchGen.current
    let cancelled = false
    ;(async () => {
      try {
        const comments = await listEchoComments(echoId)
        if (cancelled || gen !== commentsFetchGen.current) return
        setCommentsByEchoId((prev) => {
          const existing = prev[echoId] ?? []
          const byId = new Map()
          for (const c of comments) byId.set(String(c.id), c)
          for (const c of existing) {
            const key = String(c.id)
            if (!byId.has(key)) byId.set(key, c)
          }
          return {
            ...prev,
            [echoId]: [...byId.values()].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
          }
        })
      } catch (err) {
        if (!(err instanceof EchoesNotInstalledError)) {
          /* keep local comments if list fails */
        }
      }
      try {
        const reactions = normalizeReactions(await listEchoFeedReactions(echoId))
        if (!cancelled) {
          setReactionsByEchoId((prev) => ({ ...prev, [echoId]: reactions }))
        }
      } catch (err) {
        if (!(err instanceof EchoesNotInstalledError)) {
          /* keep empty reactions if not installed */
        }
      }
    })()
    return () => { cancelled = true }
  }, [openId, backendReady])

  function updateEchoSettings(id, patch) {
    setEchoes((prev) => prev.map((e) => {
      if (e.id !== id) return e
      const updated = { ...e, ...patch }
      if (!backendReady) {
        if (ECHO_PUBLIC_VISIBILITIES.has(updated.visibility)) publishToWorldPool(updated)
        else removeFromWorldPool(id)
      }
      return updated
    }))
  }

  function navigateEchoPlace(echo, { closeModal = false } = {}) {
    const target = echoMapNavTarget(echo)
    if (!target) return
    if (closeModal) closeOpenEcho()
    setTab('map')
    handleSearchPlace({
      lat: target.lat,
      lon: target.lon,
      label: target.label,
      zoom: target.zoom,
      id: `echo-${echo.id}`,
    })
  }

  function showEchoOnMap(echo) {
    navigateEchoPlace(echo)
  }

  function applyAuraChange(echoId, { auraCount, iGaveAura }) {
    if (!backendReady) {
      setAuraMap((prev) => {
        const next = { ...prev }
        if (iGaveAura) next[echoId] = true
        else delete next[echoId]
        return next
      })
    }
    setEchoes((prev) => prev.map((e) => (
      e.id === echoId ? { ...e, auraCount, iGaveAura } : e
    )))
    if (iGaveAura) {
      const echo = findEchoById(echoId)
      if (echo) touchEchoHistory(echo, { interaction: 'reacted' })
    }
  }

  function toggleComments(echoId, enabled) {
    setEchoes((prev) => prev.map((e) => (e.id === echoId ? { ...e, allowComments: enabled } : e)))
    const echo = echoes.find((e) => e.id === echoId)
    if (!backendReady && echo?.visibility && ECHO_PUBLIC_VISIBILITIES.has(echo.visibility)) {
      publishToWorldPool({ ...echo, allowComments: enabled })
    }
  }

  async function addComment(echoId, comment) {
    // Invalidate in-flight list fetches so a stale empty result can't wipe this comment.
    commentsFetchGen.current += 1
    const tempId = comment.id
    setCommentsByEchoId((prev) => ({
      ...prev,
      [echoId]: [...(prev[echoId] ?? []), comment],
    }))

    let nextComment = comment
    if (backendReady) {
      try {
        const saved = await addEchoComment(echoId, comment.text, profile, user?.id)
        nextComment = {
          ...comment,
          ...saved,
          authorId: saved.authorId || comment.authorId || user?.id,
          userId: saved.userId || comment.userId || user?.id,
        }
        setCommentsByEchoId((prev) => ({
          ...prev,
          [echoId]: (prev[echoId] ?? []).map((c) => (
            String(c.id) === String(tempId) ? nextComment : c
          )),
        }))
      } catch (err) {
        if (!(err instanceof EchoesNotInstalledError)) {
          setCommentsByEchoId((prev) => ({
            ...prev,
            [echoId]: (prev[echoId] ?? []).filter((c) => String(c.id) !== String(tempId)),
          }))
          throw err
        }
      }
    }

    const echo = findEchoById(echoId)
    if (echo) {
      const touched = {
        ...echo,
        comments: [
          ...(commentsByEchoId[echoId] ?? []).filter((c) => String(c.id) !== String(tempId)),
          nextComment,
        ],
      }
      if (!backendReady && echo.visibility && ECHO_PUBLIC_VISIBILITIES.has(echo.visibility)) {
        publishToWorldPool(touched)
      }
      touchEchoHistory(touched, { interaction: 'commented' })
    }
  }

  async function removeComment(echoId, commentId) {
    if (backendReady) {
      try {
        await deleteEchoComment(commentId)
      } catch (err) {
        if (!(err instanceof EchoesNotInstalledError)) throw err
      }
    }
    setCommentsByEchoId((prev) => ({
      ...prev,
      [echoId]: (prev[echoId] ?? []).filter((c) => String(c.id) !== String(commentId)),
    }))
    if (!backendReady) {
      const echo = findEchoById(echoId)
      if (echo?.visibility && ECHO_PUBLIC_VISIBILITIES.has(echo.visibility)) {
        publishToWorldPool({
          ...echo,
          comments: (commentsByEchoId[echoId] ?? echo.comments ?? []).filter(
            (c) => String(c.id) !== String(commentId),
          ),
        })
      }
    }
  }

  function toggleCommentReaction(echoId, commentId, emoji) {
    const em = (emoji || '').trim()
    if (!em || !commentId) return
    setCommentsByEchoId((prev) => ({
      ...prev,
      [echoId]: (prev[echoId] ?? []).map((c) => (
        String(c.id) === String(commentId)
          ? { ...c, reactions: applyCommentReactionToggle(c.reactions, em) }
          : c
      )),
    }))
  }

  async function toggleEchoReaction(echoId, reactionId) {
    const id = (reactionId || '').trim()
    if (!echoId || !id) return
    setReactionsByEchoId((prev) => ({
      ...prev,
      [echoId]: applyPostReactionToggle(prev[echoId] ?? [], id),
    }))
    if (!backendReady) return
    try {
      const next = normalizeReactions(await toggleEchoFeedReaction(echoId, id))
      setReactionsByEchoId((prev) => ({ ...prev, [echoId]: next }))
    } catch (err) {
      if (!(err instanceof EchoesNotInstalledError)) {
        setReactionsByEchoId((prev) => ({
          ...prev,
          [echoId]: applyPostReactionToggle(prev[echoId] ?? [], id),
        }))
      }
    }
  }

  function handleReviewed(echo) {
    touchEchoHistory(echo, { interaction: 'viewed' })
  }

  const openEchoBase = useMemo(() => {
    if (!openId) return null
    return exploreClusterEchoes.find((e) => e.id === openId)
      || findEchoById(openId)
  }, [openId, exploreClusterEchoes, findEchoById])
  const openEcho = openEchoBase
    ? {
        ...openEchoBase,
        comments: commentsByEchoId[openEchoBase.id] ?? openEchoBase.comments ?? [],
        reactions: reactionsByEchoId[openEchoBase.id] ?? openEchoBase.reactions ?? [],
      }
    : null
  const openEchoNearby = openEcho && userPos
    ? isInDiscoverRange(openEcho, userPos)
    : false
  const openRangeEchoes = useMemo(() => {
    if (!openId) return []
    if (exploreClusterEchoes.some((e) => e.id === openId)) return exploreClusterEchoes
    if (swipeGalleryEchoes.some((e) => e.id === openId)) return swipeGalleryEchoes
    return []
  }, [openId, exploreClusterEchoes, swipeGalleryEchoes])

  function openGalleryEcho(id) {
    if (!id) return
    setExploreClusterEchoes([])
    const echo = swipeGalleryEchoes.find((e) => e.id === id)
      || liveEchoes.find((e) => e.id === id)
      || liveBrowseEchoes.find((e) => e.id === id)
      || liveExploreCityEchoes.find((e) => e.id === id)
    if (!echo) return
    if (canBrowseGlobally(echo) || echo.mine || (userPos && isInDiscoverRange(echo, userPos))) {
      setDiscovered((prev) => new Set([...prev, id]))
    }
    setOpenId(id)
  }

  function handleRangeEchoChange(nextId) {
    if (!nextId) return
    if (exploreClusterEchoes.some((e) => e.id === nextId)) {
      setOpenId(nextId)
      return
    }
    openGalleryEcho(nextId)
  }

  const handleOpenCluster = useCallback((echoes) => {
    const list = (Array.isArray(echoes) ? echoes : [])
      .map((e) => findEchoById(e.id) || e)
      .filter((e) => e?.id)
    if (list.length === 0) return
    setExploreClusterEchoes(list)
    setDiscovered((prev) => new Set([...prev, ...list.map((e) => e.id)]))
    setOpenId(list[0].id)
  }, [findEchoById])

  const handleOpenEcho = useCallback(async (id, flyTarget, echoHint = null) => {
    if (flyTarget?.lat != null) {
      handleSearchPlace({
        lat: flyTarget.lat,
        lon: flyTarget.lon,
        label: flyTarget.label,
      })
      return
    }
    if (!id) return
    setExploreClusterEchoes([])

    if (swipeGalleryEchoes.some((e) => e.id === id)) {
      openGalleryEcho(id)
      return
    }

    let echo = echoHint || findEchoById(id)
    if (!echo && backendReady && userId) {
      try {
        const fetched = await getEchoById(id, userId)
        if (fetched) {
          const [withUrl] = await attachMediaUrls([{
            ...fetched,
            mine: fetched.ownerId === userId,
          }])
          echo = hydrateItemAvatar(withUrl, ownerProfiles, avatarHydrateOpts)
          setBrowseEchoes((prev) => (
            prev.some((e) => e.id === id) ? prev : [...prev, withUrl]
          ))
        }
      } catch { /* ignore */ }
    }
    if (!echo) return

    if (
      mapMode === 'explore'
      || canBrowseGlobally(echo)
      || echo.mine
      || (userPos && isInDiscoverRange(echo, userPos))
    ) {
      setDiscovered((prev) => new Set([...prev, id]))
    }
    setOpenId(id)
  }, [
    swipeGalleryEchoes,
    mapMode,
    backendReady,
    userId,
    ownerProfiles,
    avatarHydrateOpts,
    userPos,
    findEchoById,
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="frens-title-xl leading-tight">Aftersound</h2>
        </div>
        <button
          type="button"
          onClick={openCreateFlow}
          className="frens-btn-primary px-3 py-2 text-sm rounded-full inline-flex items-center gap-1"
          title={userPos ? 'Drop an aftersound' : 'Enable location first'}
        >
          <span className="text-base leading-none font-medium" aria-hidden>+</span>
          Aftersound
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['map', 'mine', 'collection', 'history'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-full capitalize ${tab === t ? 'frens-btn-primary' : 'frens-btn-outline'}`}
          >
            {t === 'mine'
              ? `My Aftersounds (${myEchoes.length})`
              : t === 'collection'
                ? `Collection (${displayCollection.length})`
                : t === 'history'
                  ? `Log (${history.length})`
                  : 'Map'}
          </button>
        ))}
      </div>

      {tab === 'map' && (
        <>
          <EchoMapSearch
            selectedPlace={explorePlace}
            onSelectPlace={handleSearchPlace}
            onClearPlace={handleClearExplorePlace}
            backendReady={backendReady}
            cityLabel={cityLabel}
          />

          <EchoMapModeTabs
            mode={mapMode}
            onChange={handleMapModeChange}
            hasLocation={status === 'located'}
            explorePlace={explorePlace}
          />

          {mapMode === 'near' && status !== 'located' && !explorePlace ? (
            <div className="border frens-border rounded-xl p-8 text-center">
              <MapIcon className="w-10 h-10 mx-auto mb-2 opacity-70" />
              <p className="text-sm frens-body-text mb-1">See aftersounds around you</p>
              <p className="text-xs frens-muted mb-4">
                Bats fly where frens left aftersounds — walk close to discover them. Or search a city above to explore.
              </p>
              <button type="button" onClick={locate} className="frens-btn-outline px-4 py-2 text-sm inline-flex items-center gap-1.5">
                <LocationIcon className="w-4 h-4" />
                {status === 'locating' ? 'Finding your region…' : 'Enable location'}
              </button>
              {status === 'denied' && (
                <p className="text-xs frens-hint mt-3">
                  Location was blocked. Allow it for this site in your browser, then tap again — or use Explore to search places.
                </p>
              )}
              {status === 'insecure' && (
                <p className="text-xs frens-hint mt-3">
                  Location needs a secure connection. Open the app over https:// (or localhost).
                </p>
              )}
            </div>
          ) : (
            <>
              {mapMode === 'near' && (
                <EchoSearchRadiusSelect
                  value={searchRadiusM}
                  onChange={handleSearchRadiusChange}
                  cityLabel={cityLabel}
                />
              )}
              {mapMode === 'explore' && explorePlace ? (
                <p className="text-xs frens-muted px-1">
                  {explorePlace.label} · 🌍 = open from anywhere
                </p>
              ) : null}
              <EchoMapView
                key={mapInstanceKey}
                visible={!showCreate && !showIntro}
                className={mapOverlayOpen ? 'pointer-events-none' : ''}
                center={mapCenter}
                zoom={mapZoom}
                mode={mapMode}
                userPos={mapMode === 'near' ? userPos : null}
                echoes={mapEchoes}
                hints={mapMode === 'near' ? batHints : []}
                browseEchoes={mapMode === 'explore' ? exploreMapEchoes : []}
                searchRadiusM={searchRadiusM}
                placePin={explorePlace}
                frenGraph={frenGraph}
                onOpenEcho={handleOpenEcho}
                onOpenCluster={handleOpenCluster}
                onViewportChange={handleViewportChange}
                mapRecoverTick={mapRecoverTick}
                mapSuspended={!!openId}
              />
              {!mapHidden && mapMode === 'explore' && explorePlace && swipeGalleryEchoes.length === 0 && (
                <p className="text-xs frens-muted px-1 text-center">
                  {browseEchoes.length > 0
                    ? `${browseEchoes.length} world aftersound${browseEchoes.length === 1 ? '' : 's'} in this view — pan the map or pick a closer spot`
                    : 'No world aftersounds here yet — drop one with 🌍 Browsable from anywhere'}
                </p>
              )}
              {!mapHidden && mapMode === 'near' && (
                <div className="flex items-center justify-between text-xs frens-muted px-1">
                  <span className="inline-flex items-center gap-1">
                    <EchoIcon className="w-4 h-3" /> scanning {formatRangeM(searchRadiusM)}
                  </span>
                  {inRangeEchoes.length > 0 && (
                    <span className="frens-muted">
                      {inRangeEchoes.length} in range now
                    </span>
                  )}
                </div>
              )}
              {!mapHidden && swipeGalleryEchoes.length > 0 && (
                <EchoRangeGallery
                  echoes={swipeGalleryEchoes}
                  userPos={mapMode === 'near' ? userPos : null}
                  anchor={mapMode === 'explore' ? (explorePlace || exploreCenter) : userPos}
                  title={swipeGalleryTitle}
                  hint={mapMode === 'explore' ? 'swipe cards · tap for full detail' : 'swipe cards · approximate spots'}
                  onOpenEcho={openGalleryEcho}
                />
              )}
              {!mapHidden && mapMode === 'near' && placeGroups.length > 0 && swipeGalleryEchoes.length === 0 && (
                <EchoPlacesPanel
                  cityLabel={cityLabel}
                  placeGroups={placeGroups}
                  onOpenEcho={handleOpenEcho}
                />
              )}
              {!mapHidden && mapMode === 'explore' && !explorePlace && browseEchoes.length === 0 && (
                <p className="text-xs frens-muted text-center py-2">
                  Search a place above to fly the map there.
                </p>
              )}
            </>
          )}
        </>
      )}

      {tab === 'mine' && (
        <div className="space-y-3">
          <EchoMineToolbar
            kindFilter={mineKindFilter}
            onKindFilterChange={setMineKindFilter}
            view={mineView}
            onViewChange={handleMineViewChange}
            sortBy={sortBy}
            onSortChange={setSortBy}
            counts={mineKindCounts}
            hint="Private labels · tap to open"
          />

          {myEchoes.length === 0 ? (
            <div className="border frens-border rounded-xl p-8 text-center">
              <p className="text-sm frens-muted inline-flex items-center gap-1 justify-center">
                No aftersounds yet — tap <EchoIcon className="w-4 h-3" /> Meme to leave audio or a short video.
              </p>
            </div>
          ) : filteredMyEchoes.length === 0 ? (
            <div className="border frens-border rounded-xl p-8 text-center">
              <p className="text-sm frens-muted">No aftersounds match this filter.</p>
            </div>
          ) : (
            <div className={
              mineView === 'board'
                ? 'grid grid-cols-2 gap-3'
                : 'flex flex-col gap-2'
            }>
              {filteredMyEchoes.map((echo) => (
                <EchoMineCard
                  key={echo.id}
                  echo={echo}
                  layout={mineView}
                  onShowOnMap={showEchoOnMap}
                  onNavigateWorld={showEchoOnMap}
                  onView={(e) => setOpenId(e.id)}
                  onEdit={(e) => setEditEcho(e)}
                  onDelete={(id) => setPendingDeleteEchoId(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'collection' && (
        <div className="space-y-3">
          <EchoMineToolbar
            kindFilter={collectionKindFilter}
            onKindFilterChange={setCollectionKindFilter}
            view={mineView}
            onViewChange={handleMineViewChange}
            sortBy={sortBy}
            onSortChange={setSortBy}
            counts={collectionKindCounts}
            hint="Saved from frens · tap to open"
          />

          {displayCollection.length === 0 ? (
            <div className="border frens-border rounded-xl p-8 text-center">
              <p className="text-sm frens-muted">
                Aftersounds you save from frens and discoveries show up here — open one on the map and tap Save to my collection.
              </p>
            </div>
          ) : filteredCollection.length === 0 ? (
            <div className="border frens-border rounded-xl p-8 text-center">
              <p className="text-sm frens-muted">No aftersounds match this filter.</p>
            </div>
          ) : (
            <div className={
              mineView === 'board'
                ? 'grid grid-cols-2 gap-3'
                : 'flex flex-col gap-2'
            }>
              {filteredCollection.map((echo) => (
                <EchoMineCard
                  key={echo.id}
                  echo={echo}
                  variant="saved"
                  layout={mineView}
                  savedAt={echo.savedAt}
                  auraMap={auraMap}
                  backendReady={backendReady}
                  onShowOnMap={showEchoOnMap}
                  onNavigateWorld={showEchoOnMap}
                  onView={(e) => setOpenId(e.id)}
                  onUnsave={(e) => unsaveEcho(e.id)}
                  onAuraChange={applyAuraChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {heardCollection.length === 0 ? (
            <div className="border frens-border rounded-xl p-8 text-center">
              <p className="text-sm frens-muted">Aftersounds you open — meme, video, or audio — show up here.</p>
            </div>
          ) : (
            heardCollection.map(({ echo, heardAt, interaction }) => (
              <EchoCollectionCard
                key={`${echo.id}-${heardAt}`}
                echo={echo}
                variant="log"
                heardAt={heardAt}
                logInteraction={interaction}
                auraMap={auraMap}
                backendReady={backendReady}
                onView={(e) => setOpenId(e.id)}
                onAuraChange={applyAuraChange}
              />
            ))
          )}
        </div>
      )}

      {showIntro && (
        <EchoIntroModal
          onClose={() => dismissIntro(false)}
          onStart={() => dismissIntro(true)}
        />
      )}
      {showCreate && (
        <CreateEchoModal
          userPos={userPos}
          onPublish={publishEcho}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editEcho && (
        <EchoEditModal
          echo={editEcho}
          onSave={(patch) => updateEchoSettings(editEcho.id, patch)}
          onDelete={(id) => setPendingDeleteEchoId(id)}
          onClose={() => setEditEcho(null)}
        />
      )}
      {openEcho && (
        <EchoView
          echo={openEcho}
          mine={openEcho.mine}
          profile={profileForComments}
          auraCount={openEcho.auraCount ?? 0}
          iGaveAura={openEcho.iGaveAura ?? Boolean(auraMap[openEcho.id])}
          spatialNearby={openEchoNearby}
          useRemoteAura={backendReady}
          rangeEchoes={openRangeEchoes}
          onRangeEchoChange={handleRangeEchoChange}
          onAuraChange={applyAuraChange}
          onSave={saveEcho}
          onUnsave={unsaveEcho}
          onNavigateToPlace={(echo) => navigateEchoPlace(echo, { closeModal: true })}
          onClose={closeOpenEcho}
          onOpenProfile={onOpenProfile}
          onAddComment={addComment}
          onRemoveComment={removeComment}
          onToggleCommentReaction={toggleCommentReaction}
          onToggleComments={toggleComments}
          onToggleReaction={userId ? toggleEchoReaction : undefined}
          onReviewed={handleReviewed}
          onDelete={openEcho.mine ? (id) => setPendingDeleteEchoId(id) : undefined}
        />
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteEchoId)}
        title="Delete aftersound?"
        message="This can’t be undone."
        confirmLabel="Delete"
        onCancel={() => setPendingDeleteEchoId(null)}
        onConfirm={() => {
          const id = pendingDeleteEchoId
          setPendingDeleteEchoId(null)
          if (id) deleteEcho(id)
        }}
      />
    </div>
  )
}
