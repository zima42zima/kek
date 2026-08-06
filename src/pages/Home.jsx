import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePosts } from '../context/PostsContext'
import { useNotifications } from '../context/NotificationsContext'
import FrogLogo from '../components/FrogLogo'
import ThemeControls from '../components/ThemeControls'
import NotificationsPanel from '../components/NotificationsPanel'
import PeopleSearch from '../components/PeopleSearch'
import { SearchIcon } from '../components/icons/UiIcons'
import PostCard from '../components/PostCard'
import PostComposer from '../components/PostComposer'
import { APP_NAME } from '../lib/brand'
import ShowToFrensQuotaHint from '../components/ShowToFrensQuotaHint'
import Profile from './Profile'
import EchoMap from './EchoMap'
import Caves from './Caves'
import Messages from './Messages'
import RabbitHole from './RabbitHole'
import Playlists from './Playlists'
import Gatherer from './Gatherer'
import UserProfileModal from '../components/UserProfileModal'
import FollowListModal from '../components/FollowListModal'
import messagesIcon from '../assets/icons/messages.svg'
import homeIcon from '../assets/icons/home.svg'
import echoesIcon from '../assets/icons/echo-mark.png'
import rabbitholeIcon from '../assets/icons/rabbithole.svg'
import cavesIcon from '../assets/icons/caves-mark.png'
import profileIcon from '../assets/icons/profile.svg'
import { useDms } from '../context/DmsContext'
import {
  consumePostFocus,
  consumeEchoFocus,
  consumeOpenPlaylists,
  consumeOpenGatherer,
  requestPostFocus,
  requestEchoFocus,
  requestEchoExplorePlace,
} from '../lib/notificationNav'
import { buildAppPath, goApp, isKnownAppPath, parseAppRoute } from '../lib/appNav'
import { clearPostFromUrl } from '../lib/postShare'
import { GlobalPlaylistPauseButton } from '../context/PlaylistPlaybackContext'
import { maskImageStyle } from '../lib/maskIcon'

const FEED_PULL_TRIGGER = 64

/** Panel scroll target — skip hidden cave chat when Playlists tab is open. */
function findActivePanelScroller(root) {
  for (const el of root.querySelectorAll('[data-frens-panel-scroll]')) {
    if (!(el instanceof HTMLElement)) continue
    const { width, height } = el.getBoundingClientRect()
    if (width > 0 && height > 0) return el
  }
  return null
}

function FeedRefreshIndicator({ offset = 0, refreshing = false }) {
  if (!refreshing && offset < 8) return null

  const label = refreshing
    ? 'Refreshing…'
    : offset >= FEED_PULL_TRIGGER
      ? 'Release to refresh'
      : 'Pull to refresh'

  return (
    <div
      className="flex items-end justify-center overflow-hidden pointer-events-none"
      style={{ height: refreshing ? 28 : offset }}
      aria-hidden={!refreshing}
    >
      <span className="pb-1 text-[11px] frens-muted">{label}</span>
    </div>
  )
}

// Optical balance in a shared 24×24 box — solid/wide marks read bigger than outline/padded ones.
const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: homeIcon, iconScale: 1 },
  { id: 'echoes', label: 'Echo', icon: echoesIcon, iconScale: 1 },
  { id: 'rabbit', label: 'Rabbit Hole', icon: rabbitholeIcon, iconScale: 0.76 },
  { id: 'messages', label: 'Messages', icon: messagesIcon, iconScale: 1.18 },
  { id: 'caves', label: 'Caves', icon: cavesIcon, iconScale: 1.22 },
  { id: 'profile', label: 'Profile', icon: profileIcon, iconScale: 0.96 },
]

/**
 * Bottom-nav glyph — shared 24×24 box; optional scale shrinks the mask only (stays centered).
 */
function NavIcon({ src, scale = 1 }) {
  const maskSize = scale === 1 ? 'contain' : `${Math.round(scale * 100)}%`
  return (
    <span
      aria-hidden
      className="block w-6 h-6 shrink-0 bg-black dark:bg-white"
      style={{
        ...maskImageStyle(src),
        maskSize,
        WebkitMaskSize: maskSize,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}

function BottomNav({ active = 'home', onNavigate, dmUnread = 0 }) {
  return (
    <nav className="shrink-0 frens-surface">
      <div className="flex justify-around items-center py-2 px-0.5 frens-content-max">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id
          const showBadge = item.id === 'messages' && dmUnread > 0
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center gap-1 px-0.5 py-1 rounded-lg transition min-w-0 flex-1 max-w-[4.75rem]"
            >
              <NavIcon src={item.icon} scale={item.iconScale ?? 1} />
              {showBadge && (
                <span className="absolute top-0.5 right-[16%] min-w-[14px] h-3.5 px-0.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
                  {dmUnread > 9 ? '9+' : dmUnread}
                </span>
              )}
              <span
                className={`text-[10px] leading-tight text-center text-black dark:text-white truncate max-w-full ${
                  isActive ? 'font-medium' : 'font-normal'
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function BellIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

export default function Home() {
  const { profile } = useAuth()
  const { posts, refreshFeed, refreshing: feedRefreshing } = usePosts()
  const { unread } = useNotifications()
  const { totalUnread: dmUnread, openConversation, openConversationWithUser } = useDms()
  const location = useLocation()
  const navigate = useNavigate()
  const route = parseAppRoute(location)
  const activeTab = route.tab
  const mainRef = useRef(null)
  const profileRef = useRef(null)
  const feedPullStartY = useRef(null)
  const feedPullOffsetRef = useRef(0)
  const [feedPullOffset, setFeedPullOffset] = useState(0)
  const [profileRefreshing, setProfileRefreshing] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showPeopleSearch, setShowPeopleSearch] = useState(false)
  const [viewUserId, setViewUserId] = useState(null)
  const [followList, setFollowList] = useState(null)
  const [postFocus, setPostFocus] = useState(null)
  // Keep Profile mounted after first visit so Posts|_log doesn't remount/flash.
  const [profileMounted, setProfileMounted] = useState(() => activeTab === 'profile')

  const reloadHomeFeed = useCallback(async () => {
    await refreshFeed()
  }, [refreshFeed])

  const reloadProfileView = useCallback(async () => {
    setProfileRefreshing(true)
    try {
      await profileRef.current?.reload?.()
    } finally {
      setProfileRefreshing(false)
    }
  }, [])

  const scrollFeedToTop = useCallback((behavior = 'smooth') => {
    mainRef.current?.scrollTo({ top: 0, behavior })
  }, [])

  const handleNavigate = useCallback((tab, extras = {}) => {
    if (tab === 'home' && activeTab === 'home') {
      reloadHomeFeed()
      scrollFeedToTop()
      setPostFocus(null)
      if (route.postId) {
        goApp(navigate, { tab: 'home' }, { replace: true })
      }
      return
    }
    if (tab === 'profile' && activeTab === 'profile') {
      reloadProfileView()
      scrollFeedToTop()
      return
    }
    goApp(navigate, { tab, ...extras })
  }, [
    navigate,
    activeTab,
    route.postId,
    reloadHomeFeed,
    reloadProfileView,
    scrollFeedToTop,
  ])

  useEffect(() => {
    if (activeTab === 'profile') setProfileMounted(true)
  }, [activeTab])

  const handleOpenPost = useCallback((focus) => {
    if (focus?.postId) setPostFocus(focus)
  }, [])

  const handleOpenEcho = useCallback((echoId) => {
    if (echoId) goApp(navigate, { tab: 'echoes', echoId: String(echoId) })
  }, [navigate])

  const clearEchoFocus = useCallback(() => {
    goApp(navigate, { tab: 'echoes' }, { replace: true })
  }, [navigate])

  const handleOpenPlaylists = useCallback((targetUserId, playlistId = null) => {
    goApp(navigate, {
      tab: 'playlists',
      playlistsUserId: targetUserId || null,
      playlistId: playlistId || null,
    })
  }, [navigate])

  const handleOpenGatherer = useCallback((targetUserId, moodboardId = null) => {
    goApp(navigate, {
      tab: 'gatherer',
      gathererUserId: targetUserId || null,
      moodboardId: moodboardId || null,
    })
  }, [navigate])

  useEffect(() => {
    if (!isKnownAppPath(location.pathname)) {
      navigate('/', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    const queued = consumePostFocus()
    if (queued) {
      setPostFocus(queued)
      goApp(navigate, { tab: 'home' }, { replace: true })
    }
  }, [navigate])

  // Profile _log → open post: Home stays mounted, so re-check when landing on feed.
  useEffect(() => {
    if (activeTab !== 'home') return
    const queued = consumePostFocus()
    if (queued) setPostFocus(queued)
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'home' || !route.postId) return
    setPostFocus({ postId: String(route.postId), openComments: false })
    clearPostFromUrl()
  }, [activeTab, route.postId])

  useEffect(() => {
    const queued = consumeEchoFocus()
    if (queued) goApp(navigate, { tab: 'echoes', echoId: queued }, { replace: true })
  }, [navigate])

  useEffect(() => {
    const queued = consumeOpenPlaylists()
    if (queued) {
      goApp(navigate, {
        tab: 'playlists',
        playlistsUserId: queued.userId || null,
        playlistId: queued.playlistId || null,
      }, { replace: true })
    }
  }, [navigate, profile?.id])

  useEffect(() => {
    const queued = consumeOpenGatherer()
    if (queued) {
      goApp(navigate, {
        tab: 'gatherer',
        gathererUserId: queued.userId || null,
        moodboardId: queued.moodboardId || null,
      }, { replace: true })
    }
  }, [navigate, profile?.id])

  useEffect(() => {
    if (!postFocus || activeTab !== 'home') return
    const postId = String(postFocus.postId)
    const exists = posts.some((p) => String(p.id) === postId)
    if (!exists) {
      setPostFocus(null)
      return
    }
    const scroll = () => {
      const el = document.getElementById(`post-${postId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    requestAnimationFrame(() => requestAnimationFrame(scroll))
    const t = setTimeout(() => setPostFocus(null), 4000)
    return () => clearTimeout(t)
  }, [postFocus, activeTab, posts])

  async function messagePerson(person) {
    const id = await openConversationWithUser(person.userId, person)
    setFollowList(null)
    setViewUserId(null)
    if (id) goApp(navigate, { tab: 'messages', conversationId: id })
  }

  async function openDmConversation(conversationId) {
    if (!conversationId) return
    await openConversation(conversationId)
  }

  const caveDetailOpen = activeTab === 'caves' && Boolean(route.caveId)
  const dmDetailOpen = activeTab === 'messages' && Boolean(route.conversationId)
  const panelDetailOpen = caveDetailOpen || dmDetailOpen

  // When a DM/cave chat is open, only the message pane scrolls. Forward wheel
  // from header / gutters / chrome so scroll works like the rest of the app.
  useEffect(() => {
    if (!panelDetailOpen) return undefined
    const feed = document.querySelector('.frens-feed')
    if (!feed) return undefined

    function onWheel(e) {
      if (e.ctrlKey || e.metaKey) return
      if (e.target instanceof Element && e.target.closest('[data-frens-modal-backdrop]')) return
      const scroller = findActivePanelScroller(feed)
      if (!scroller) return
      if (scroller.contains(e.target)) return

      const path = typeof e.composedPath === 'function' ? e.composedPath() : []
      for (const el of path) {
        if (!(el instanceof HTMLElement) || el === scroller || el === feed) continue
        const style = window.getComputedStyle(el)
        const oy = style.overflowY
        if (
          (oy === 'auto' || oy === 'scroll') &&
          el.scrollHeight > el.clientHeight + 1
        ) {
          return
        }
      }

      scroller.scrollTop += e.deltaY
      e.preventDefault()
    }

    feed.addEventListener('wheel', onWheel, { passive: false })
    return () => feed.removeEventListener('wheel', onWheel)
  }, [panelDetailOpen])

  // Pull down at top of home or profile to refresh (touch).
  useEffect(() => {
    const el = mainRef.current
    const canPull = activeTab === 'home' || activeTab === 'profile'
    if (!el || !canPull || panelDetailOpen) return undefined

    function resetPull() {
      feedPullStartY.current = null
      feedPullOffsetRef.current = 0
      setFeedPullOffset(0)
    }

    function onTouchStart(e) {
      if (feedRefreshing || profileRefreshing || el.scrollTop > 1) return
      feedPullStartY.current = e.touches[0].clientY
    }

    function onTouchMove(e) {
      if (feedPullStartY.current == null || feedRefreshing || profileRefreshing) return
      if (el.scrollTop > 1) {
        resetPull()
        return
      }
      const dy = e.touches[0].clientY - feedPullStartY.current
      if (dy <= 0) {
        resetPull()
        return
      }
      const offset = Math.min(dy * 0.5, 88)
      feedPullOffsetRef.current = offset
      setFeedPullOffset(offset)
      if (dy > 10) e.preventDefault()
    }

    async function onTouchEnd() {
      if (feedPullStartY.current == null) return
      const shouldRefresh = feedPullOffsetRef.current >= FEED_PULL_TRIGGER
      resetPull()
      if (!shouldRefresh) return
      if (activeTab === 'home') await reloadHomeFeed()
      else if (activeTab === 'profile') await reloadProfileView()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [
    activeTab,
    panelDetailOpen,
    feedRefreshing,
    profileRefreshing,
    reloadHomeFeed,
    reloadProfileView,
  ])

  return (
    <div className="frens-feed">
      <header className="shrink-0 px-4 py-3 flex items-center gap-3">
        <FrogLogo className="w-8 h-8 shrink-0" />
        <h1 className="frens-title-xl">{APP_NAME}</h1>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowPeopleSearch(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Search"
            title="Search"
          >
            <SearchIcon className="w-5 h-5" />
          </button>
          <GlobalPlaylistPauseButton />
          <button
            type="button"
            onClick={() => setShowNotifs(true)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
          >
            <BellIcon />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-black text-white dark:bg-white dark:text-black text-[10px] frens-badge-count flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <ThemeControls />
        </div>
      </header>

      <main
        ref={mainRef}
        className={`flex-1 min-h-0 flex flex-col overscroll-none ${
          panelDetailOpen ? 'overflow-hidden' : 'overflow-y-auto frens-scroll'
        }`}
      >
        <div
          className={`frens-content-max w-full ${
            panelDetailOpen
              ? 'flex-1 min-h-0 flex flex-col overflow-hidden'
              : 'p-4'
          }`}
        >
          {(activeTab === 'home' || activeTab === 'profile') && (
            <FeedRefreshIndicator
              offset={feedPullOffset}
              refreshing={activeTab === 'home' ? feedRefreshing : profileRefreshing}
            />
          )}
          {activeTab === 'home' && (
            <>
              <PostComposer collapsible />
              <ShowToFrensQuotaHint />

              {posts.length === 0 ? (
                <div className="border frens-border rounded-xl p-8 text-center">
                  <p className="text-sm frens-body-text mb-1">
                    You&apos;re the first fren here{profile?.frenName ? `, ${profile.frenName}` : ''}.
                  </p>
                  <p className="text-xs frens-muted">Post something to start the cave.</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onOpenProfile={setViewUserId}
                      highlight={postFocus && String(postFocus.postId) === String(post.id)}
                      openComments={postFocus?.openComments && String(postFocus.postId) === String(post.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'echoes' && (
            <EchoMap
              focusEchoId={route.echoId}
              onClearEchoFocus={clearEchoFocus}
              onOpenProfile={setViewUserId}
            />
          )}

          {activeTab === 'caves' && (
            <Caves
              caveId={route.caveId}
              onCaveChange={(id) => goApp(navigate, { tab: 'caves', caveId: id || null })}
            />
          )}

          {activeTab === 'messages' && (
            <Messages
              conversationId={route.conversationId}
              onConversationChange={(id) => goApp(navigate, { tab: 'messages', conversationId: id || null })}
            />
          )}

          {profileMounted && (
            <div
              className={activeTab === 'profile' ? '' : 'hidden'}
              aria-hidden={activeTab !== 'profile'}
            >
              <Profile
                ref={profileRef}
                active={activeTab === 'profile'}
                onNavigate={handleNavigate}
                onOpenEcho={handleOpenEcho}
                onOpenPlaylists={handleOpenPlaylists}
                onOpenGatherer={handleOpenGatherer}
              />
            </div>
          )}

          {activeTab === 'rabbit' && (
            <RabbitHole
              topicId={route.topicId}
              onTopicChange={(id) => goApp(navigate, { tab: 'rabbit', topicId: id || null })}
            />
          )}

          {activeTab === 'playlists' && (
            <Playlists
              userId={route.playlistsUserId || profile?.id}
              editable={!route.playlistsUserId || route.playlistsUserId === profile?.id}
              initialPlaylistId={route.playlistId}
              onConsumedInitialPlaylist={() => {
                if (route.playlistId) {
                  goApp(navigate, {
                    tab: 'playlists',
                    playlistsUserId: route.playlistsUserId || null,
                    playlistId: null,
                  }, { replace: true })
                }
              }}
              onOpenFrenPlaylist={(ownerId, playlistId) => {
                goApp(navigate, {
                  tab: 'playlists',
                  playlistsUserId: ownerId,
                  playlistId: playlistId || null,
                })
              }}
              onBack={() => goApp(navigate, { tab: 'profile' })}
            />
          )}

          {activeTab === 'gatherer' && (
            <Gatherer
              userId={route.gathererUserId || profile?.id}
              editable={!route.gathererUserId || route.gathererUserId === profile?.id}
              initialMoodboardId={route.moodboardId}
              onConsumedInitialMoodboard={() => {
                if (route.moodboardId) {
                  goApp(navigate, {
                    tab: 'gatherer',
                    gathererUserId: route.gathererUserId || null,
                    moodboardId: null,
                  }, { replace: true })
                }
              }}
              onBack={() => goApp(navigate, { tab: 'profile' })}
            />
          )}

          {activeTab !== 'home' &&
            activeTab !== 'profile' &&
            activeTab !== 'echoes' &&
            activeTab !== 'caves' &&
            activeTab !== 'messages' &&
            activeTab !== 'rabbit' &&
            activeTab !== 'playlists' &&
            activeTab !== 'gatherer' && (
              <div className="border frens-border rounded-xl p-8 text-center">
                <p className="frens-muted text-sm">coming soon</p>
              </div>
            )}
        </div>
      </main>

      <BottomNav
        active={activeTab === 'playlists' || activeTab === 'gatherer' ? 'profile' : activeTab}
        onNavigate={handleNavigate}
        dmUnread={dmUnread}
      />

      {showPeopleSearch && (
        <PeopleSearch
          open={showPeopleSearch}
          onClose={() => setShowPeopleSearch(false)}
          onSelectUser={setViewUserId}
          onSelectPost={(post) => {
            if (!post?.id) return
            requestPostFocus({ postId: post.id })
            handleOpenPost({ postId: post.id })
            goApp(navigate, { tab: 'home', postId: post.id })
          }}
          onSelectEcho={(echo) => {
            if (!echo?.id) return
            requestEchoFocus(echo.id)
            handleOpenEcho(echo.id)
          }}
          onSelectPlace={(place) => {
            if (!place?.lat || !place?.lon) return
            requestEchoExplorePlace({
              id: place.placeKey || null,
              label: place.placeLabel || place.cityLabel || 'Place',
              lat: place.lat,
              lon: place.lon,
              zoom: 13,
            })
            goApp(navigate, { tab: 'echoes' })
          }}
        />
      )}

      {showNotifs && (
        <NotificationsPanel
          onClose={() => setShowNotifs(false)}
          onNavigate={handleNavigate}
          onOpenDm={openDmConversation}
          onOpenProfile={setViewUserId}
          onOpenPost={handleOpenPost}
          onOpenEcho={handleOpenEcho}
        />
      )}

      {followList && (
        <FollowListModal
          userId={followList.userId}
          initialTab={followList.tab}
          onClose={() => setFollowList(null)}
          onOpenUser={setViewUserId}
          onMessage={messagePerson}
        />
      )}

      {viewUserId && (
        <UserProfileModal
          userId={viewUserId}
          onClose={() => setViewUserId(null)}
          onOpenList={(id, tab) => setFollowList({ userId: id, tab })}
          onNavigate={handleNavigate}
          onOpenProfile={setViewUserId}
          onOpenEcho={handleOpenEcho}
          onOpenPlaylists={handleOpenPlaylists}
          onOpenGatherer={handleOpenGatherer}
        />
      )}
    </div>
  )
}
