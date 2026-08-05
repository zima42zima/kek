import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import { prepareImageAttachment, finalizeImageUrl, finalizeGifUrl } from '../../lib/imageAttach'
import { hasRichEmbeds } from '../../lib/urls'
import { insertAtCaret } from '../../lib/insertText'
import ChatComposer from '../ChatComposer'
import EmojiReactions from '../EmojiReactions'
import { PinIcon, LinkIcon, UserPlusIcon, SearchIcon } from '../icons/UiIcons'
import CaveAccessLabel from '../CaveAccessLabel'
import PinnedLabel from '../PinnedLabel'
import { CaveGlyph } from './CaveIcon'
import CaveCoverEditor, { CaveCoverBanner, CaveCoverThumb } from './CaveCover'
import AddMembersModal from './AddMembersModal'
import { removeCaveMemberRemote, CavesNotInstalledError } from '../../lib/caves'
import { useCaves } from '../../context/CavesContext'
import CaveRoleBadge from './CaveRoleBadge'
import RichText from '../RichText'
import ConfirmDialog from '../ConfirmDialog'
import { SharedImage, textBubbleClass } from '../SharedMedia'
import {
  MOD_ROLES,
  DEFAULT_TITLE_ID,
  activeFunTitle,
  activeModRole,
  getCaveRoles,
  isCaveKeeper,
  isCaveOwner,
  memberById,
} from '../../lib/caveRoles'

import CaveRolesEditor from './CaveRolesEditor'
import CavePlaylists from './CavePlaylists'
import { MusicNoteIcon } from '../icons/UiIcons'
import FrensSelect from '../FrensSelect'
import { appOrigin } from '../../lib/brand'

function caveInviteUrl(caveId) {
  return `${appOrigin()}/caves/${encodeURIComponent(caveId)}`
}

function caveViewStorageKey(caveId) {
  return `frens-cave-view-${caveId}`
}

function readStoredCaveView(caveId) {
  try {
    return sessionStorage.getItem(caveViewStorageKey(caveId)) === 'playlists' ? 'playlists' : 'chat'
  } catch {
    return 'chat'
  }
}

function storeCaveView(caveId, view) {
  try {
    sessionStorage.setItem(caveViewStorageKey(caveId), view)
  } catch { /* ignore */ }
}

function InviteModal({ cave, onClose }) {
  const [copied, setCopied] = useState(false)
  const link = caveInviteUrl(cave.id)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="frens-surface border frens-border rounded-2xl p-6 w-full max-w-sm">
        <h2 className="frens-title-lg mb-1">Add frens to {cave.name}</h2>
        <p className="text-xs frens-muted mb-4">Share this invite link with frens you trust.</p>
        <div className="flex gap-2">
          <input readOnly value={link} className="frens-input py-2 text-xs" />
          <button type="button" onClick={copy} className="frens-btn-primary px-4 py-2 text-sm shrink-0">
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        <button type="button" onClick={onClose} className="frens-btn-outline w-full mt-4 py-2.5 text-sm">
          Done
        </button>
      </div>
    </div>
  )
}

function CaveEditor({ cave, currentUserId, onUpdateCave, onClose, onDeleted }) {
  const { assignCaveTitle, assignCaveModRole, setCaveCover, setCaveRoles, deleteCave } = useCaves()
  const [memberError, setMemberError] = useState('')
  const [roleError, setRoleError] = useState('')
  const [roleBusy, setRoleBusy] = useState('')
  const [coverError, setCoverError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showRolesEditor, setShowRolesEditor] = useState(false)
  const isOwner = isCaveOwner(cave, currentUserId)
  const isKeeper = isCaveKeeper(cave, currentUserId)
  const caveRoles = getCaveRoles(cave)

  async function saveCover(url) {
    setCoverError('')
    const result = await setCaveCover(cave.id, url)
    if (!result?.ok) setCoverError(result?.message || 'Could not save cover.')
  }

  async function removeCover() {
    setCoverError('')
    const result = await setCaveCover(cave.id, null)
    if (!result?.ok) setCoverError(result?.message || 'Could not remove cover.')
  }

  async function handleDeleteCave() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleteError('')
    setDeleteBusy(true)
    try {
      const result = await deleteCave(cave.id)
      if (!result?.ok) {
        setDeleteError(result?.message || 'Could not delete cave.')
        setDeleteBusy(false)
        return
      }
      onClose?.()
      onDeleted?.(cave.id)
    } catch (err) {
      setDeleteError(err.message || 'Could not delete cave.')
      setDeleteBusy(false)
    }
  }

  async function setFunTitle(memberId, titleId) {
    setRoleError('')
    setRoleBusy(memberId)
    const title = caveRoles.find((t) => t.id === titleId)
    const weeks = title?.weeks ?? 2
    const result = await assignCaveTitle(cave.id, memberId, titleId, weeks)
    setRoleBusy('')
    if (!result?.ok) setRoleError(result?.message || 'Could not assign title.')
  }

  async function setModRole(memberId, modRole) {
    setRoleError('')
    setRoleBusy(`${memberId}-mod`)
    const mod = MOD_ROLES.find((r) => r.id === modRole)
    const weeks = mod?.weeks ?? 1
    const result = await assignCaveModRole(cave.id, memberId, modRole, weeks)
    setRoleBusy('')
    if (!result?.ok) setRoleError(result?.message || 'Could not assign mod role.')
  }

  async function kick(memberId) {
    setMemberError('')
    onUpdateCave((c) => ({ ...c, members: c.members.filter((m) => m.id !== memberId) }))
    try {
      await removeCaveMemberRemote(cave.id, memberId, false)
    } catch (err) {
      setMemberError(err instanceof CavesNotInstalledError
        ? 'Kick needs the latest database update — run supabase-patch-cave-members.sql.'
        : (err.message || 'Could not remove member.'))
    }
  }

  async function ban(memberId) {
    setMemberError('')
    onUpdateCave((c) => ({
      ...c,
      members: c.members.filter((m) => m.id !== memberId),
      banned: [...(c.banned || []), memberId],
    }))
    try {
      await removeCaveMemberRemote(cave.id, memberId, true)
    } catch (err) {
      setMemberError(err instanceof CavesNotInstalledError
        ? 'Ban needs the latest database update — run supabase-patch-cave-members.sql.'
        : (err.message || 'Could not ban member.'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="frens-surface border frens-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="frens-title-lg">Cave settings</h2>
          <button type="button" onClick={onClose} className="frens-muted text-xl leading-none" aria-label="Close">×</button>
        </div>
        <p className="text-xs frens-muted mb-5">
          Roles expire — keep it fresh.
        </p>

        {isKeeper ? (
          <section className="mb-6">
            <h3 className="frens-label mb-1">Cover photo</h3>
            <p className="text-xs frens-muted mb-3">
              Optional. Shows in the caves list and at the top of this cave.
            </p>
            <CaveCoverEditor
              coverUrl={cave.coverUrl}
              editable
              onSave={saveCover}
              onRemove={removeCover}
            />
            {coverError ? (
              <p className="text-xs text-red-500 dark:text-red-400 mt-2">{coverError}</p>
            ) : null}
          </section>
        ) : null}

        {isKeeper ? (
          <section className={isOwner ? 'mb-6' : ''}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="frens-label">Roles</h3>
              <button
                type="button"
                onClick={() => setShowRolesEditor(true)}
                className="text-xs frens-action shrink-0"
              >
                Edit roles
              </button>
            </div>
            <p className="text-xs frens-muted mb-3">
              Assign from this cave&apos;s catalog (max 12). Edit names, marks, and add roles with +.
            </p>
            {roleError ? (
              <p className="text-xs text-red-500 dark:text-red-400 mb-2">{roleError}</p>
            ) : null}
            <ul className="space-y-3">
              {cave.members.map((m) => {
                const isSelf = m.id === currentUserId
                const isMemberOwner = m.id === cave.ownerId
                const title = activeFunTitle(m, cave)
                const mod = activeModRole(m)
                const busy = roleBusy === m.id || roleBusy === `${m.id}-mod`
                const titleValue = caveRoles.some((r) => r.id === title.id) ? title.id : DEFAULT_TITLE_ID
                return (
                  <li key={m.id} className="border frens-border rounded-xl px-3 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <ProfileAvatar profile={m} className="w-8 h-8 shrink-0" logoClassName="w-5 h-auto" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {m.name} {isSelf && <span className="frens-muted text-xs font-normal">(you)</span>}
                          {isMemberOwner && <span className="frens-muted text-xs font-normal"> · founder</span>}
                        </p>
                        <CaveRoleBadge member={m} cave={cave} />
                      </div>
                    </div>
                    {!isMemberOwner ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-[10px] frens-muted uppercase tracking-wide">Role</span>
                          <FrensSelect
                            value={titleValue}
                            disabled={busy}
                            onChange={(id) => setFunTitle(m.id, id)}
                            ariaLabel="Cave role"
                            options={caveRoles.map((t) => ({
                              value: t.id,
                              label: `${t.emoji || ''} ${t.label}`.trim(),
                            }))}
                          />
                        </label>
                        {isOwner ? (
                          <label className="block">
                            <span className="text-[10px] frens-muted uppercase tracking-wide">Mod role</span>
                            <FrensSelect
                              value={mod?.id || ''}
                              disabled={busy}
                              onChange={(id) => setModRole(m.id, id)}
                              ariaLabel="Mod role"
                              options={[
                                { value: '', label: 'none' },
                                ...MOD_ROLES.map((r) => ({ value: r.id, label: r.label })),
                              ]}
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs frens-muted">Founder is always Cave Keeper</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {showRolesEditor ? (
          <CaveRolesEditor
            roles={caveRoles}
            onSave={(roles) => setCaveRoles(cave.id, roles)}
            onClose={() => setShowRolesEditor(false)}
          />
        ) : null}

        {isOwner ? (
          <section className="mb-6">
            <h3 className="frens-label mb-2">Members</h3>
            {memberError ? (
              <p className="text-xs text-red-500 dark:text-red-400 mb-2">{memberError}</p>
            ) : null}
            <ul className="space-y-2">
              {cave.members.map((m) => {
                const isSelf = m.id === currentUserId
                return (
                  <li key={m.id} className="flex items-center gap-2 border frens-border rounded-lg px-3 py-2">
                    <ProfileAvatar profile={m} className="w-8 h-8" logoClassName="w-5 h-auto" />
                    <span className="text-sm truncate flex-1">
                      {m.name} {isSelf && <span className="frens-muted text-xs">(you)</span>}
                    </span>
                    <CaveRoleBadge member={m} cave={cave} compact />
                    {!isSelf && (
                      <>
                        <button type="button" onClick={() => kick(m.id)} className="text-xs frens-action">
                          kick
                        </button>
                        <button type="button" onClick={() => ban(m.id)} className="text-xs text-red-500 dark:text-red-400">
                          ban
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {isOwner ? (
          <section className="border-t frens-border pt-5">
            <h3 className="frens-label mb-1 text-red-600 dark:text-red-400">Delete cave</h3>
            <p className="text-xs frens-muted mb-3">
              Permanently removes this cave and its messages. Everyone who was in it gets a notification.
            </p>
            {deleteError ? (
              <p className="text-xs text-red-500 dark:text-red-400 mb-2">{deleteError}</p>
            ) : null}
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-xs frens-body-text">
                  Delete <span className="font-medium">{cave.name}</span>? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={handleDeleteCave}
                    className="flex-1 text-sm py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition"
                  >
                    {deleteBusy ? 'Deleting…' : 'Yes, delete forever'}
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => setConfirmDelete(false)}
                    className="frens-btn-outline flex-1 py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDeleteCave}
                className="w-full text-sm py-2.5 rounded-xl border border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
              >
                Delete this cave
              </button>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}

/** Moderator-only × — confirm before hiding spam. */
function ModHideButton({ onHide }) {
  const [confirm, setConfirm] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="frens-muted w-4 h-4 rounded-full flex items-center justify-center text-[11px] leading-none opacity-45 hover:opacity-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition shrink-0"
        aria-label="Hide spam"
      >
        ×
      </button>
      <ConfirmDialog
        open={confirm}
        title="Hide spam?"
        message="This message will be hidden for everyone except cave mods."
        confirmLabel="Hide"
        onConfirm={() => {
          setConfirm(false)
          onHide?.()
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}

function messageSearchText(m) {
  return [m.authorName, m.text, m.replyPreview?.text, m.replyPreview?.authorName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function dayKey(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDayLabel(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function CaveDaySep({ label }) {
  if (!label) return null
  return (
    <div className="flex justify-center py-2" role="separator" aria-label={label}>
      <span className="text-[11px] frens-muted tracking-wide">{label}</span>
    </div>
  )
}

function ChatMessage({
  message,
  member,
  mine,
  caveId,
  cave = null,
  currentUserProfile = null,
  canModerate,
  onReact,
  onHide,
  onReply,
  replies = [],
  highlight = false,
  nested = false,
}) {
  const canReact = caveId && message.id != null && !String(message.id).startsWith('tmp-')
  const canMod = canModerate && canReact
  const replyCount = replies.length
  const avatarProfile =
    mine && currentUserProfile ? currentUserProfile : member || message
  const hasText = Boolean(message.text?.trim())
  const hasImage = Boolean(message.image)

  const reactionControls = canReact ? (
    <EmojiReactions
      reactions={message.reactions || []}
      mine={mine}
      canReact={canReact}
      onReact={onReact}
      onReply={onReply ? () => onReply(message) : null}
      controlsOnly
    />
  ) : null

  const modHide = canMod && !message.hidden && onHide ? (
    <ModHideButton onHide={onHide} />
  ) : null

  const sideControls = reactionControls || modHide ? (
    <div className={`flex items-center gap-1 shrink-0 ${mine ? 'flex-row-reverse' : ''}`}>
      {reactionControls}
      {modHide}
    </div>
  ) : null

  return (
    <div
      id={message.id != null ? `cave-msg-${message.id}` : undefined}
      className={`w-full ${highlight ? 'rounded-xl ring-1 ring-black/15 dark:ring-white/20 bg-black/[0.02] dark:bg-white/[0.03] p-1 -mx-1' : ''}`}
    >
      <div
        className={`flex gap-2.5 min-w-0 items-start ${mine ? 'flex-row-reverse' : ''} ${
          message.hidden ? 'opacity-50' : ''
        }`}
      >
        <ProfileAvatar
          profile={avatarProfile}
          className={`${nested ? 'w-7 h-7' : 'w-8 h-8'} shrink-0 mt-0.5`}
          logoClassName={nested ? 'w-4 h-auto' : 'w-5 h-auto'}
        />
        <div className={`flex-1 min-w-0 max-w-[85%] flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
          {(message.pinned || message.hidden || (member && !nested)) ? (
            <div className={`flex items-center gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
              {member && !nested ? <CaveRoleBadge member={member} cave={cave} compact /> : null}
              {message.pinned ? <PinIcon className="w-3 h-3 shrink-0" /> : null}
              {message.hidden ? <span className="text-[10px] frens-muted">(hidden)</span> : null}
            </div>
          ) : null}
          {message.replyPreview ? (
            <div
              className={`text-[10px] frens-muted border-l-2 frens-border pl-2 py-0.5 max-w-full ${
                mine ? 'border-l-0 border-r-2 pr-2 pl-0' : ''
              }`}
            >
              <span className="font-medium">{message.replyPreview.authorName}</span>
              {message.replyPreview.text ? (
                <span className="opacity-80"> — {String(message.replyPreview.text).slice(0, 80)}</span>
              ) : null}
            </div>
          ) : null}
          {message.sticker ? (
            <span className="text-4xl leading-none block">{message.sticker}</span>
          ) : (
            <>
              {hasImage ? (
                <div className={`max-w-full ${hasText ? 'mb-1' : ''}`}>
                  <SharedImage src={message.image} variant="chat" />
                  {!hasText && sideControls ? (
                    <div className={`flex mt-0.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {sideControls}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {hasText ? (
                <div className={`flex items-start gap-1.5 max-w-full ${mine ? 'flex-row-reverse' : ''}`}>
                  <div className="min-w-0 max-w-full">
                    {hasRichEmbeds(message.text) ? (
                      <RichText text={message.text} className="min-w-0 max-w-full [overflow-wrap:anywhere] break-words" />
                    ) : (
                      <div className={textBubbleClass(mine)}>
                        <RichText
                          text={message.text}
                          className="min-w-0 max-w-full [overflow-wrap:anywhere] break-words"
                        />
                      </div>
                    )}
                  </div>
                  {sideControls}
                </div>
              ) : !hasImage && sideControls ? (
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  {sideControls}
                </div>
              ) : null}
            </>
          )}
          <EmojiReactions
            reactions={message.reactions || []}
            mine={mine}
            canReact={canReact}
            onReact={onReact}
            chipsOnly
          />
        </div>
      </div>

      {!nested && replyCount > 0 ? (
        <div
          className={`mt-1.5 ${
            mine ? 'mr-4 sm:mr-6 pr-3 border-r-2' : 'ml-4 sm:ml-6 pl-3 border-l-2'
          } frens-border space-y-2`}
        >
          <p className="text-[10px] frens-muted tracking-wide">
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </p>
          {replies.map((r) => (
            <ChatMessage
              key={r.id}
              message={r}
              member={r._member}
              mine={r._mine}
              caveId={caveId}
              cave={cave}
              currentUserProfile={currentUserProfile}
              canModerate={canModerate}
              onReact={r._onReact}
              onHide={r._onHide}
              onReply={onReply}
              nested
              highlight={r._highlight}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}


export default function CaveDetail({ cave, currentUserId, currentUserProfile, onUpdateCave, onSendMessage, onBack, onDeleted }) {
  const { reactToCaveMessage, hideCaveMessage } = useCaves()
  const [draft, setDraft] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [caveView, setCaveView] = useState(() => readStoredCaveView(cave.id))
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [expandedThreads, setExpandedThreads] = useState(() => new Set())
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const searchInputRef = useRef(null)
  const chromeRef = useRef(null)
  const rootRef = useRef(null)
  const sendingRef = useRef(false)

  const isKeeper = isCaveKeeper(cave, currentUserId)
  const visibleMessages = (cave.messages || []).filter((m) => !m.hidden || isKeeper)
  const q = searchQuery.trim().toLowerCase()
  const searchHitIds = q
    ? new Set(visibleMessages.filter((m) => messageSearchText(m).includes(q)).map((m) => String(m.id)))
    : null

  // Threads: roots + replies under parent
  const repliesByParent = new Map()
  visibleMessages.forEach((m) => {
    if (m.parentId == null || m.parentId === '') return
    const key = String(m.parentId)
    if (!repliesByParent.has(key)) repliesByParent.set(key, [])
    repliesByParent.get(key).push(m)
  })
  const rootMessages = visibleMessages.filter((m) => m.parentId == null || m.parentId === '')
  const pinned = rootMessages.filter((m) => m.pinned)
  let chatMessages = rootMessages.filter((m) => !m.pinned)
  if (searchHitIds) {
    // Keep roots that match or have a matching reply; auto-expand those threads
    chatMessages = chatMessages.filter((m) => {
      const id = String(m.id)
      if (searchHitIds.has(id)) return true
      const kids = repliesByParent.get(id) || []
      return kids.some((r) => searchHitIds.has(String(r.id)))
    })
  }

  useEffect(() => {
    setCaveView(readStoredCaveView(cave.id))
  }, [cave.id])

  useLayoutEffect(() => {
    const chrome = chromeRef.current
    const root = rootRef.current
    if (!chrome || !root) return undefined
    const syncChromeHeight = () => {
      const h = Math.ceil(chrome.getBoundingClientRect().height)
      root.style.setProperty('--frens-cave-chrome-h', `${h}px`)
    }
    syncChromeHeight()
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncChromeHeight)
      : null
    ro?.observe(chrome)
    window.addEventListener('resize', syncChromeHeight)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', syncChromeHeight)
    }
  }, [caveView, cave.name, isKeeper])

  useEffect(() => {
    if (caveView !== 'chat') return
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [cave.messages.length, caveView])

  function author() {
    return {
      authorId: currentUserId,
      authorName: currentUserProfile?.frenName || 'you',
      avatarType: currentUserProfile?.avatarType || 'frog',
      avatarUrl: currentUserProfile?.avatarUrl || null,
    }
  }

  function pushMessage(fields) {
    const auth = author()
    const payload = { ...fields }
    if (replyTo?.id != null) {
      payload.parentId = replyTo.id
      payload.replyPreview = {
        authorName: replyTo.authorName || 'a fren',
        text: (replyTo.text || '').slice(0, 120),
      }
    }
    if (onSendMessage) {
      onSendMessage(payload, auth)
      return
    }
    onUpdateCave((c) => ({
      ...c,
      messages: [
        ...c.messages,
        { id: Date.now(), ts: 'just now', ...auth, ...payload },
      ],
    }))
  }

  function handleSend(e) {
    e?.preventDefault?.()
    const text = draft.trim()
    if (!text || sendingRef.current) return
    sendingRef.current = true
    const parent = replyTo
    pushMessage({ text })
    setDraft('')
    setReplyTo(null)
    if (parent?.id != null) {
      setExpandedThreads((prev) => {
        const next = new Set(prev)
        next.add(String(parent.id))
        return next
      })
    }
    // Allow next send after React applies draft clear (avoids double Enter/submit).
    requestAnimationFrame(() => {
      sendingRef.current = false
    })
  }

  function startReply(message) {
    // Reply to a reply still threads under the original root
    if (message.parentId != null) {
      setReplyTo({
        id: message.parentId,
        authorName: message.replyPreview?.authorName || message.authorName,
        text: message.replyPreview?.text || message.text || '',
      })
      setExpandedThreads((prev) => new Set(prev).add(String(message.parentId)))
    } else {
      setReplyTo({
        id: message.id,
        authorName: message.authorName,
        text: message.text || (message.image ? '[image]' : '') || (message.sticker ? message.sticker : ''),
      })
      setExpandedThreads((prev) => new Set(prev).add(String(message.id)))
    }
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function decorateReplies(parentId) {
    const kids = repliesByParent.get(String(parentId)) || []
    return kids.map((r) => ({
      ...r,
      _member: memberById(cave, r.authorId),
      _mine: r.authorId === currentUserId,
      _onReact: (emoji) => reactToCaveMessage(cave.id, r.id, emoji),
      _onHide: () => hideCaveMessage(cave.id, r.id),
      _highlight: Boolean(q && searchHitIds?.has(String(r.id))),
    }))
  }

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  // Auto-expand threads that match search
  useEffect(() => {
    if (!searchHitIds || searchHitIds.size === 0) return
    setExpandedThreads((prev) => {
      const next = new Set(prev)
      repliesByParent.forEach((kids, parentId) => {
        if (kids.some((r) => searchHitIds.has(String(r.id))) || searchHitIds.has(String(parentId))) {
          next.add(String(parentId))
        }
      })
      return next
    })
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError('')
    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.')
      return
    }
    setImageBusy(true)
    try {
      const { dataUrl, blob } = await prepareImageAttachment(file, { maxDimension: 1200 })
      const image = await finalizeImageUrl({ image: dataUrl, blob, prefix: 'caves' })
      pushMessage({ image })
      setReplyTo(null)
    } catch (err) {
      setImageError(err.message || 'Could not process that image.')
    } finally {
      setImageBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function addEmoji(emoji) {
    setDraft((prev) => insertAtCaret(textareaRef.current, prev, emoji))
  }

  async function sendGif(url) {
    if (!url) return
    const image = await finalizeGifUrl(url, { prefix: 'caves' })
    pushMessage({ image })
    setReplyTo(null)
  }

  function switchCaveView(view) {
    setCaveView(view)
    storeCaveView(cave.id, view)
  }

  return (
    // Fill shell between app header and bottom nav; composer docks under messages.
    <div ref={rootRef} className="flex flex-col h-full min-h-0 w-full overflow-hidden">
      {/* Compact cave chrome */}
      <div ref={chromeRef} className="shrink-0 z-20 frens-surface">
        <CaveCoverBanner coverUrl={cave.coverUrl} className="border-b frens-border" />
        <div className="px-3 pt-2 pb-1 flex items-center gap-2">
          <button type="button" onClick={onBack} className="frens-muted text-lg px-1 shrink-0" aria-label="Back to caves">
            ‹
          </button>
          <CaveCoverThumb coverUrl={cave.coverUrl} className="w-8 h-8" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate leading-tight">{cave.name}</p>
            <p className="text-[11px] frens-muted leading-tight flex items-center gap-1">
              <span>{cave.members.length} {cave.members.length === 1 ? 'member' : 'members'}</span>
              <span aria-hidden>·</span>
              <CaveAccessLabel access={cave.access} />
            </p>
          </div>
          {isKeeper ? (
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="frens-action text-[11px] px-2 py-1 shrink-0"
            >
              Settings
            </button>
          ) : null}
        </div>

        <div className="px-3 pb-2 flex items-center gap-1.5">
          <div className="flex gap-1 flex-1 min-w-0 p-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
            <button
              type="button"
              onClick={() => switchCaveView('chat')}
              className={`flex-1 py-1.5 text-[11px] rounded-full transition touch-manipulation ${
                caveView === 'chat' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'frens-muted'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => switchCaveView('playlists')}
              className={`flex-1 py-1.5 text-[11px] rounded-full inline-flex items-center justify-center gap-1 transition touch-manipulation ${
                caveView === 'playlists' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'frens-muted'
              }`}
            >
              <MusicNoteIcon className="w-3 h-3" />
              Playlists
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={`frens-action w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 shrink-0 ${
              searchOpen || searchQuery ? 'text-black dark:text-white' : ''
            }`}
            aria-label="Search conversation"
            title="Search conversation"
            aria-pressed={searchOpen}
          >
            <SearchIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="frens-action w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
            aria-label="Add members"
            title="Add members"
          >
            <UserPlusIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="frens-action w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
            aria-label="Invite link"
            title="Invite link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
        </div>
        {searchOpen || searchQuery ? (
          <div className="px-3 pb-2">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 frens-muted pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search this cave…"
                className="frens-input w-full text-sm py-2 pl-9 pr-8"
                autoComplete="off"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs frens-muted px-1"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={
          caveView === 'chat'
            ? 'flex flex-col flex-1 min-h-0'
            : 'hidden'
        }
        aria-hidden={caveView !== 'chat'}
      >
        {/* Messages — full-bleed scroll hit area; content capped like DMs */}
        <div
          data-frens-panel-scroll
          className="flex-1 min-h-0 overflow-y-auto overscroll-none frens-scroll"
        >
          <div className="px-3 pt-3 pb-3 space-y-2.5 frens-content-max w-full">
          {pinned.length > 0 && !q ? (
            <div className="rounded-xl p-2 space-y-2.5 bg-black/[0.02] dark:bg-white/[0.02]">
              <p className="text-[10px] frens-muted uppercase tracking-wide px-1 inline-flex items-center gap-1">
                <PinIcon className="w-3 h-3" />
                Pinned
              </p>
              {pinned.map((m) => (
                <ChatMessage
                  key={`pin-${m.id}`}
                  message={m}
                  member={memberById(cave, m.authorId)}
                  mine={m.authorId === currentUserId}
                  caveId={cave.id}
                  cave={cave}
                  currentUserProfile={currentUserProfile}
                  canModerate={isKeeper}
                  onReact={(emoji) => reactToCaveMessage(cave.id, m.id, emoji)}
                  onHide={() => hideCaveMessage(cave.id, m.id)}
                  onReply={startReply}
                  replies={decorateReplies(m.id)}
                />
              ))}
            </div>
          ) : null}
          {visibleMessages.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <p className="text-sm frens-body-text mb-1">Quiet in here</p>
              <p className="text-xs frens-muted">Say hi to start the cave.</p>
            </div>
          ) : chatMessages.length === 0 && q ? (
            <div className="py-12 text-center">
              <p className="text-sm frens-muted">No messages match “{searchQuery.trim()}”</p>
            </div>
          ) : (
            (() => {
              let lastDay = null
              return chatMessages.map((m) => {
                const key = dayKey(m.createdAt)
                const showDay = key && key !== lastDay
                if (showDay) lastDay = key
                return (
                  <div key={m.id} className="space-y-2.5">
                    {showDay ? <CaveDaySep label={formatDayLabel(m.createdAt)} /> : null}
                    <ChatMessage
                      message={m}
                      member={memberById(cave, m.authorId)}
                      mine={m.authorId === currentUserId}
                      caveId={cave.id}
                      cave={cave}
                      currentUserProfile={currentUserProfile}
                      canModerate={isKeeper}
                      onReact={(emoji) => reactToCaveMessage(cave.id, m.id, emoji)}
                      onHide={() => hideCaveMessage(cave.id, m.id)}
                      onReply={startReply}
                      replies={decorateReplies(m.id)}
                      highlight={Boolean(q && searchHitIds?.has(String(m.id)))}
                    />
                  </div>
                )
              })
            })()
          )}
          <div ref={scrollRef} aria-hidden className="h-px shrink-0" />
          </div>
        </div>

        {/* Composer — post-style row, docked above bottom nav */}
        <div className="shrink-0 z-20 frens-surface px-3 pt-1.5 pb-2">
          {replyTo ? (
            <div className="mb-1.5 flex items-start gap-2 rounded-xl px-1 py-1.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="frens-muted">
                  Replying to <span className="font-medium text-black dark:text-white">{replyTo.authorName}</span>
                </p>
                {replyTo.text ? (
                  <p className="truncate frens-muted opacity-80 mt-0.5">{replyTo.text}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="frens-muted shrink-0 px-1"
                aria-label="Cancel reply"
              >
                ✕
              </button>
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,image/gif,.gif"
            className="hidden"
            onChange={handleImage}
          />
          <ChatComposer
            profile={currentUserProfile}
            value={draft}
            onChange={setDraft}
            onSubmit={handleSend}
            placeholder={replyTo ? `Reply to ${replyTo.authorName}…` : 'Say something…'}
            sendLabel="Send"
            busy={imageBusy}
            attachBusy={imageBusy}
            error={imageError}
            inputRef={textareaRef}
            onPhoto={() => fileInputRef.current?.click()}
            onEmoji={addEmoji}
            onGif={sendGif}
          />
        </div>
      </div>

      {caveView === 'playlists' ? (
        <div
          data-frens-panel-scroll
          className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-none frens-scroll"
        >
          <div className="frens-content-max w-full px-3 pt-2 pb-8">
            <CavePlaylists cave={cave} currentUserId={currentUserId} />
          </div>
        </div>
      ) : null}

      {showAdd && (
        <AddMembersModal
          cave={cave}
          currentUserId={currentUserId}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showInvite && <InviteModal cave={cave} onClose={() => setShowInvite(false)} />}
      {showEditor && isKeeper && (
        <CaveEditor
          cave={cave}
          currentUserId={currentUserId}
          onUpdateCave={onUpdateCave}
          onClose={() => setShowEditor(false)}
          onDeleted={() => {
            setShowEditor(false)
            onDeleted?.(cave.id)
            onBack?.()
          }}
        />
      )}
    </div>
  )
}
