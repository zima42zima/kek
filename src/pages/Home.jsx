import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePosts } from '../context/PostsContext'
import { useNotifications } from '../context/NotificationsContext'
import FrogLogo from '../components/FrogLogo'
import ThemeControls from '../components/ThemeControls'
import NotificationsPanel from '../components/NotificationsPanel'
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
import homeIcon from '../assets/icons/world.png'
import echoesIcon from '../assets/icons/echo.png'
import rabbitholeIcon from '../assets/icons/rabbit.png'
import cavesIcon from '../assets/icons/caves.svg'
import profileIcon from '../assets/icons/profile.svg'
import { useDms } from '../context/DmsContext'
import { consumePostFocus, consumeEchoFocus, consumeOpenPlaylists, consumeOpenGatherer } from '../lib/notificationNav'
import { buildAppPath, goApp, isKnownAppPath, parseAppRoute } from '../lib/appNav'
import { clearPostFromUrl } from '../lib/postShare'
import { GlobalPlaylistPauseButton } from '../context/PlaylistPlaybackContext'

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: homeIcon },
  { id: 'echoes', label: 'Echo Map', icon: echoesIcon },
  { id: 'rabbit', label: 'Rabbit Hole', icon: rabbitholeIcon },
  { id: 'messages', label: 'Messages', icon: messagesIcon },
  { id: 'caves', label: 'Caves', icon: cavesIcon },
  { id: 'profile', label: 'Profile', icon: profileIcon },
]

function NavIcon({ src, active }) {
  return (
    <span
      aria-hidden
      className={`frens-nav-icon ${active ? 'frens-nav-icon-active' : ''}`}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
      }}
    />
  )
}

function BottomNav({ active = 'home', onNavigate, dmUnread = 0 }) {
  return (
    <nav className="shrink-0 border-t frens-border frens-surface">
      <div className="flex justify-around items-center py-2 px-1 frens-content-max">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id
          const showBadge = item.id === 'messages' && dmUnread > 0
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center gap-1 px-1 py-1 rounded-lg transition min-w-[2.75rem]"
            >
              <NavIcon src={item.icon} active={isActive} />
              {showBadge && (
                <span className="absolute top-0 right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-[#6BC06B] text-white text-[9px] frens-badge-count flex items-center justify-center">
                  {dmUnread > 9 ? '9+' : dmUnread}
                </span>
              )}
              <span
                className={`text-[10px] leading-none ${
                  isActive
                    ? 'text-[#6BC06B] dark:text-white font-medium'
                    : 'frens-muted'
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
  const { posts } = usePosts()
  const { unread } = useNotifications()
  const { totalUnread: dmUnread, openConversation, openConversationWithUser } = useDms()
  const location = useLocation()
  const navigate = useNavigate()
  const route = parseAppRoute(location)
  const activeTab = route.tab

  const handleNavigate = useCallback((tab, extras = {}) => {
    goApp(navigate, { tab, ...extras })
  }, [navigate])

  const [showNotifs, setShowNotifs] = useState(false)
  const [viewUserId, setViewUserId] = useState(null)
  const [followList, setFollowList] = useState(null)
  const [postFocus, setPostFocus] = useState(null)

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

  return (
    <div className="frens-feed">
      <header className="shrink-0 px-4 py-3 flex items-center gap-3">
        <FrogLogo className="w-8 h-8 shrink-0" />
        <h1 className="frens-title-xl">{APP_NAME}</h1>
        <div className="ml-auto flex items-center gap-3">
          <GlobalPlaylistPauseButton />
          <button
            type="button"
            onClick={() => setShowNotifs(true)}
            className="relative frens-action w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
          >
            <BellIcon />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#6BC06B] text-white text-[10px] frens-badge-count flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <ThemeControls />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className={`frens-content-max w-full ${panelDetailOpen ? '' : 'p-4'}`}>
          {activeTab === 'home' && (
            <>
              <PostComposer />
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

          {activeTab === 'profile' && (
            <Profile
              onNavigate={handleNavigate}
              onOpenEcho={handleOpenEcho}
              onOpenPlaylists={handleOpenPlaylists}
              onOpenGatherer={handleOpenGatherer}
            />
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
