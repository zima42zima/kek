import { useEffect, useRef, useState } from 'react'
import { supabase, setPhotoAvatar } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { usePosts } from '../context/PostsContext'
import { ProfileAvatar } from '../components/FrogLogo'
import PostCard from '../components/PostCard'
import PostComposer from '../components/PostComposer'
import Modal from '../components/Modal'
import ProfileCaves from '../components/caves/ProfileCaves'
import ProfileEchoes from '../components/echo/ProfileEchoes'
import CavesManager from '../components/caves/CavesManager'
import CaveIcon from '../components/caves/CaveIcon'
import FollowListModal from '../components/FollowListModal'
import UserProfileModal from '../components/UserProfileModal'
import { MessageIcon, UserPlusIcon, PencilIcon, SettingsIcon } from '../components/icons/UiIcons'
import InviteGenerator from '../components/InviteGenerator'
import { useDms } from '../context/DmsContext'
import EmojiButton from '../components/EmojiButton'
import { insertAtCaret } from '../lib/insertText'
import { sanitizeImage } from '../lib/media'
import { fetchProfileForUser, upsertProfileFields, checkProfileDbSetup, getSupabaseProjectRef } from '../lib/profile'
import { displayNameErrorMessage, formatFrenHandle, normalizeDisplayName, validateDisplayNameFormat } from '../lib/frenName'
import { followCounts } from '../lib/social'
import RichText from '../components/RichText'
import FrenHandle from '../components/FrenHandle'
import { CosmosProfileLink, saveCosmosProfileUrl } from '../components/ProfileGallery'
import ProfilePlaylists from '../components/playlists/ProfilePlaylists'
import ProfileGatherer from '../components/gatherer/ProfileGatherer'
import ProfileLikedTracks from '../components/playlists/ProfileLikedTracks'
import ProfileOwlPost from '../components/owl/ProfileOwlPost'
import PsHubModal from '../components/folds-letters/PsHubModal'
import { consumeOpenPsFlag } from '../lib/psNav'
import { consumeOpenTrailFlag } from '../lib/trailNav'
import { getMyOwlSettings, OwlPostNotInstalledError } from '../lib/owlPost'
import ProfileTrail from '../components/ProfileTrail'

const SHOW_EMAIL_KEY = 'frens-show-email'

export default function Profile({
  onNavigate,
  onOpenEcho,
  onOpenPlaylists,
  onOpenGatherer,
  /** When false, profile stays mounted but hidden (keeps Posts|_log state stable). */
  active = true,
}) {
  const { profile: contextProfile, user, refreshProfile, signOut } = useAuth()
  const { postsByUser, loadPostsForUser } = usePosts()
  const { openConversationWithUser, totalUnread: dmUnread } = useDms()
  const [profile, setProfile] = useState(contextProfile)
  const [bio, setBio] = useState('')
  const [frenName, setFrenName] = useState('')
  const [cosmosUrl, setCosmosUrl] = useState('')
  const [shareLocation, setShareLocation] = useState(false)
  // Don't block the whole shell if auth already has a profile — avoids Posts|_log flash.
  const [loading, setLoading] = useState(() => !contextProfile)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [userId, setUserId] = useState(user?.id ?? null)
  const [userEmail, setUserEmail] = useState(user?.email ?? null)
  const [dbSetup, setDbSetup] = useState(null)
  const [showEmail, setShowEmail] = useState(() => {
    try { return localStorage.getItem(SHOW_EMAIL_KEY) === '1' } catch { return false }
  })
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [counts, setCounts] = useState({ following: 0, followers: 0 })
  const [followList, setFollowList] = useState(null) // { userId, tab }
  const [viewUserId, setViewUserId] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPsPanel, setShowPsPanel] = useState(false)
  const [psSection, setPsSection] = useState(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [owlSettings, setOwlSettings] = useState(null)
  /** Profile feed: posts vs _log (replies / aura — no quotes or reposts). */
  const [profileView, setProfileView] = useState(() => (consumeOpenTrailFlag() ? 'log' : 'posts'))
  const fileInputRef = useRef(null)
  const bioRef = useRef(null)

  // Home “_log →” and return visits: open trail when flag is set while active.
  useEffect(() => {
    if (!active) return
    if (consumeOpenTrailFlag()) setProfileView('log')
  }, [active])

  useEffect(() => {
    checkProfileDbSetup().then(setDbSetup)
  }, [])

  useEffect(() => {
    setProfile(contextProfile)
  }, [contextProfile])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setSaveMsg('')

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        if (!cancelled) setLoading(false)
        return
      }

      if (!cancelled) {
        setUserId(authUser.id)
        setUserEmail(authUser.email ?? null)
      }

      try {
        const row = await fetchProfileForUser(authUser.id, authUser.email)
        if (!cancelled) {
          setProfile(row)
          if (row) {
            setBio(row.bio || '')
            setFrenName(row.frenName || '')
            setCosmosUrl(row.cosmosUrl || '')
            setShareLocation(row.shareLocation ?? false)
          } else {
            setFrenName(authUser.email?.split('@')[0] || '')
          }
        }
      } catch (err) {
        if (!cancelled) setSaveMsg(`Could not load profile: ${err.message}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!userId) return
    loadPostsForUser(userId)
  }, [userId, loadPostsForUser])

  function loadCounts() {
    if (!userId) return
    followCounts(userId)
      .then(setCounts)
      .catch(() => { /* social SQL not installed yet — leave counts at 0 */ })
  }

  useEffect(() => {
    loadCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!userId) return
    getMyOwlSettings()
      .then(setOwlSettings)
      .catch((err) => {
        if (!(err instanceof OwlPostNotInstalledError)) {
          /* leave owl row hidden until SQL is installed */
        }
      })
  }, [userId])

  useEffect(() => {
    const open = consumeOpenPsFlag()
    if (open) {
      setPsSection(open)
      setShowPsPanel(true)
    }
  }, [])

  function toggleShowEmail() {
    setShowEmail((prev) => {
      const next = !prev
      try { localStorage.setItem(SHOW_EMAIL_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    if (!userId) {
      setSaveMsg('Not signed in. Log out and log in again.')
      return
    }

    setSaving(true)
    setSaveMsg('')

    try {
      const trimmedName = normalizeDisplayName(frenName)
      const formatErr = validateDisplayNameFormat(trimmedName)
      if (formatErr) {
        setSaveMsg(formatErr)
        setSaving(false)
        return
      }

      await upsertProfileFields(userId, {
        silly_name: trimmedName,
        bio: bio.trim(),
      })
      const savedCosmos = await saveCosmosProfileUrl(userId, cosmosUrl)

      const updated = await fetchProfileForUser(userId, userEmail)
      setProfile(updated)
      if (updated) {
        setBio(updated.bio || '')
        setFrenName(updated.frenName || '')
        setCosmosUrl(updated.cosmosUrl || savedCosmos || '')
      }

      await refreshProfile()
      setSaveMsg('Saved ✓')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch (err) {
      setSaveMsg(displayNameErrorMessage(err) || 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarSelect(e) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setAvatarError('')

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.')
      return
    }

    setAvatarBusy(true)
    try {
      const { dataUrl } = await sanitizeImage(file, { maxDimension: 256 })
      await setPhotoAvatar(userId, dataUrl)
      const updated = await fetchProfileForUser(userId, userEmail)
      setProfile(updated)
      await refreshProfile()
    } catch (err) {
      setAvatarError(err.message || 'Could not update photo.')
    } finally {
      setAvatarBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleToggleLocation() {
    if (!userId) return

    const next = !shareLocation
    setShareLocation(next)

    try {
      await upsertProfileFields(userId, { share_location: next })
      const updated = await fetchProfileForUser(userId, userEmail)
      setProfile(updated)
      await refreshProfile()
    } catch {
      setShareLocation(!next)
    }
  }

  const displayProfile = profile ?? contextProfile ?? {
    frenName: frenName || userEmail?.split('@')[0] || 'nameless fren',
    bio: null,
    oneHumanThing: null,
    avatarType: 'frog',
    avatarUrl: null,
    coverUrl: null,
    cosmosUrl: null,
    isFounder: false,
    shareLocation: false,
  }

  // Only fully block when we have nothing to show (first paint, no auth profile yet).
  if (loading && !profile && !contextProfile) {
    return (
      <div className="p-8 text-center">
        <p className="frens-muted text-sm">Loading your profile...</p>
      </div>
    )
  }

  const email = userEmail || user?.email || null
  const myPosts = userId ? postsByUser(userId) : []

  async function messagePerson(person) {
    await openConversationWithUser(person.userId, person)
    setFollowList(null)
    setViewUserId(null)
    onNavigate?.('messages')
  }

  return (
    <div className="space-y-4">
      {dbSetup && !dbSetup.ok && (
        <div className="border border-red-400 dark:border-red-500 rounded-xl p-4 bg-red-50 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-1">Database setup needed</p>
          <p className="text-xs text-red-600 dark:text-red-400">{dbSetup.message}</p>
          {getSupabaseProjectRef() && (
            <p className="text-xs frens-hint mt-2">Your app points to project: {getSupabaseProjectRef()}</p>
          )}
        </div>
      )}

      {/* Profile header (cover removed — avatar only) */}
      <div>
        {/* Avatar + quiet tools (icons only — edit/settings aren't daily) */}
        <div className="flex items-end justify-between px-1 gap-2">
          <div className="rounded-full p-1 frens-surface">
            <ProfileAvatar profile={displayProfile} className="w-24 h-24" logoClassName="w-14 h-auto" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="frens-btn-outline w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              aria-label="Edit profile"
              title="Edit profile"
            >
              <PencilIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="frens-btn-outline w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="frens-btn-outline w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              aria-label="Invite a fren"
              title="Invite a fren"
            >
              <UserPlusIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('messages')}
              className="relative frens-btn-outline w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              aria-label={dmUnread ? `Messages (${dmUnread} unread)` : 'Messages'}
              title="Messages"
            >
              <MessageIcon className="w-5 h-5" />
              {dmUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
                  {dmUnread > 9 ? '9+' : dmUnread}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Minimal info */}
        <div className="px-1 mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <FrenHandle size="lg">{displayProfile.frenName}</FrenHandle>
            {displayProfile.frenHandle && (
              <span className="text-sm frens-muted">{formatFrenHandle(displayProfile.frenHandle)}</span>
            )}
            {displayProfile.isFounder && (
              <span className="text-[10px] text-[#6BC06B] dark:text-white border frens-border rounded-full px-2 py-0.5">
                first fren
              </span>
            )}
          </div>

          {displayProfile.oneHumanThing && (
            <p className="text-sm frens-body-text italic mt-1">&ldquo;{displayProfile.oneHumanThing}&rdquo;</p>
          )}
          {displayProfile.bio && (
            <RichText text={displayProfile.bio} className="text-sm frens-body-text mt-1" />
          )}

          <CosmosProfileLink url={displayProfile.cosmosUrl} />

          {userId ? <ProfileLikedTracks onOpenPlaylists={onOpenPlaylists} /> : null}

          {showEmail && email && (
            <p className="text-xs frens-muted mt-1">✉ {email} · only you can see this</p>
          )}

          <div className="flex gap-4 mt-2 text-sm">
            <button
              type="button"
              onClick={() => userId && setFollowList({ userId, tab: 'following' })}
              className="hover:underline"
            >
              <span className="frens-stat">{counts.following}</span> <span className="frens-muted">Following</span>
            </button>
            <button
              type="button"
              onClick={() => userId && setFollowList({ userId, tab: 'followers' })}
              className="hover:underline"
            >
              <span className="frens-stat">{counts.followers}</span> <span className="frens-muted">Followers</span>
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <ProfileCaves onNavigate={onNavigate} />
            {userId && (
              <ProfileEchoes userId={userId} onNavigate={onNavigate} onOpenEcho={onOpenEcho} />
            )}
            {userId && (
              <ProfilePlaylists userId={userId} onOpenPlaylists={onOpenPlaylists} />
            )}
            {userId && (
              <ProfileGatherer userId={userId} onOpenGatherer={onOpenGatherer} onNavigate={onNavigate} />
            )}
            {owlSettings && (
              <ProfileOwlPost
                open={owlSettings.enabled}
                pendingCount={owlSettings.pendingCount}
                onClick={() => { setPsSection(null); setShowPsPanel(true) }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Posts | _log — always both visible; selection only changes style + body */}
      <div className="border-t frens-border pt-3 space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2 px-1 min-h-[2.25rem]">
          <button
            type="button"
            onClick={() => setProfileView('posts')}
            aria-pressed={profileView === 'posts'}
            className={`text-sm px-3 py-1.5 rounded-full transition shrink-0 ${
              profileView === 'posts'
                ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                : 'frens-muted hover:text-black dark:hover:text-white'
            }`}
          >
            Posts
          </button>
          <button
            type="button"
            onClick={() => setProfileView('log')}
            aria-pressed={profileView === 'log'}
            className={`text-sm px-3 py-1.5 rounded-full transition shrink-0 ${
              profileView === 'log'
                ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                : 'frens-muted hover:text-black dark:hover:text-white'
            }`}
          >
            _log
          </button>
        </div>

        {profileView === 'posts' ? (
          <>
            <PostComposer collapsible />
            {myPosts.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm frens-muted">No posts yet — share your first echo</p>
              </div>
            ) : (
              myPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  authorProfile={userId ? { ...displayProfile, id: userId } : null}
                  onOpenProfile={setViewUserId}
                />
              ))
            )}
          </>
        ) : (
          <ProfileTrail
            userId={userId}
            onOpenProfile={setViewUserId}
          />
        )}
      </div>

      {followList && (
        <FollowListModal
          userId={followList.userId}
          initialTab={followList.tab}
          onClose={() => { setFollowList(null); loadCounts() }}
          onOpenUser={(id) => setViewUserId(id)}
          onMessage={messagePerson}
        />
      )}

      {viewUserId && (
        <UserProfileModal
          userId={viewUserId}
          onClose={() => { setViewUserId(null); loadCounts() }}
          onOpenList={(id, tab) => setFollowList({ userId: id, tab })}
          onNavigate={onNavigate}
          onOpenProfile={setViewUserId}
          onOpenEcho={onOpenEcho}
          onOpenPlaylists={onOpenPlaylists}
          onOpenGatherer={onOpenGatherer}
        />
      )}

      {showInviteModal && (
        <Modal onClose={() => setShowInviteModal(false)} maxWidth="max-w-lg">
          <InviteGenerator compact inModal />
        </Modal>
      )}

      {showPsPanel && (
        <PsHubModal
          initialSection={psSection}
          onClose={() => { setShowPsPanel(false); setPsSection(null) }}
          onSettingsChange={setOwlSettings}
        />
      )}

      {showEditor && (
        <Modal title="Edit profile" onClose={() => setShowEditor(false)}>
          <div className="flex items-center gap-3 mb-4">
            <ProfileAvatar profile={displayProfile} className="w-16 h-16" logoClassName="w-10 h-auto" />
            <div className="flex flex-wrap gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                className="frens-btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {avatarBusy ? 'Updating...' : 'Upload photo'}
              </button>
            </div>
          </div>
          {avatarError && <p className="text-xs text-red-500 dark:text-red-400 mb-3">{avatarError}</p>}

          <form onSubmit={handleSaveProfile} className="space-y-3">
            {displayProfile.frenHandle && (
              <div>
                <label className="block frens-label mb-1">Handle</label>
                <p className="frens-input py-2.5 bg-gray-50 dark:bg-gray-950 text-sm frens-muted cursor-default">
                  {formatFrenHandle(displayProfile.frenHandle)}
                </p>
                <p className="text-xs frens-hint mt-1">
                  Permanent — tied to your account. Friends search for this to find you.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="edit-name" className="block frens-label mb-1">Display name</label>
              <input
                id="edit-name"
                type="text"
                value={frenName}
                onChange={(e) => setFrenName(e.target.value)}
                placeholder="Lenchi, unga bunga, …"
                className="frens-input"
              />
              <p className="text-xs frens-hint mt-1">What other frens see on posts — change anytime.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-bio" className="block frens-label">Bio</label>
                <EmojiButton
                  onPick={(emoji) => setBio((prev) => insertAtCaret(bioRef.current, prev, emoji))}
                  align="right"
                />
              </div>
              <textarea
                id="edit-bio"
                ref={bioRef}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="say something human..."
                rows={3}
                className="frens-input"
              />
            </div>

            <div>
              <label htmlFor="edit-cosmos" className="block frens-label mb-1">Cosmos (optional)</label>
              <input
                id="edit-cosmos"
                type="text"
                value={cosmosUrl}
                onChange={(e) => setCosmosUrl(e.target.value)}
                placeholder="@yourhandle or https://www.cosmos.so/you"
                className="frens-input"
              />
              <p className="text-xs frens-hint mt-1">Your Cosmos profile link — shown on your profile for other frens.</p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button type="submit" disabled={saving} className="frens-btn-primary px-5 py-2 text-sm disabled:opacity-50">
                {saving ? 'Saving...' : 'Save profile'}
              </button>
              {saveMsg && (
                <span className={`text-xs ${saveMsg.includes('✓') ? 'text-[#6BC06B]' : 'text-red-500 dark:text-red-400'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </form>
        </Modal>
      )}

      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)}>
          <div className="space-y-4">
            {email && (
              <div className="rounded-xl border frens-border px-4 py-3">
                <p className="text-xs frens-hint mb-1">Signed in as</p>
                <p className="text-sm frens-body-text break-all">{email}</p>
              </div>
            )}

            <SettingToggle
              title="Show my email on my profile"
              hint="Only visible to you — never shown to other frens."
              checked={showEmail}
              onToggle={toggleShowEmail}
            />

            <SettingToggle
              title="Share my city on Echoes"
              hint="Only city level, never exact location."
              checked={shareLocation}
              onToggle={handleToggleLocation}
            />

            <div>
              <p className="text-sm frens-body-text mb-1 flex items-center gap-1.5">
                <CaveIcon className="w-4 h-4" /> Your caves
              </p>
              <p className="text-xs frens-hint mb-2">
                Choose which caves show on your profile and, if you own them, who can join.
              </p>
              <CavesManager
                onOpenCave={(id) => {
                  setShowSettings(false)
                  onNavigate?.('caves', { caveId: id })
                }}
              />
            </div>

            <div className="border-t frens-border pt-4">
              <button
                type="button"
                onClick={signOut}
                className="frens-btn-outline w-full py-2.5 text-sm text-red-600 dark:text-red-400 border-red-300 dark:border-red-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SettingToggle({ title, hint, checked, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm frens-body-text">{title}</p>
        <p className="text-xs frens-hint mt-1">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
          checked ? 'bg-black dark:bg-white' : 'bg-gray-200 border border-frens dark:bg-gray-800'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full transition-transform ${
            checked ? 'translate-x-5 bg-white dark:bg-black' : 'translate-x-0 bg-gray-400 dark:bg-gray-500'
          }`}
        />
      </button>
    </div>
  )
}
