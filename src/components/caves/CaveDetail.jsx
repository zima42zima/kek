import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import { prepareImageAttachment, finalizeImageUrl, finalizeGifUrl } from '../../lib/imageAttach'
import { hasRichEmbeds } from '../../lib/urls'
import { insertAtCaret } from '../../lib/insertText'
import PillComposer from '../PillComposer'
import EmojiReactions from '../EmojiReactions'
import { PinIcon, LinkIcon, UserPlusIcon } from '../icons/UiIcons'
import CaveAccessLabel from '../CaveAccessLabel'
import PinnedLabel from '../PinnedLabel'
import { CaveGlyph } from './CaveIcon'
import AddMembersModal from './AddMembersModal'
import { removeCaveMemberRemote, CavesNotInstalledError } from '../../lib/caves'
import { useCaves } from '../../context/CavesContext'
import CaveRoleBadge from './CaveRoleBadge'
import RichText from '../RichText'
import { SharedImage, textBubbleClass } from '../SharedMedia'
import {
  CAVE_FUN_TITLES,
  MOD_ROLES,
  activeFunTitle,
  activeModRole,
  isCaveKeeper,
  isCaveOwner,
  memberById,
} from '../../lib/caveRoles'
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

function CaveEditor({ cave, currentUserId, onUpdateCave, onClose }) {
  const { assignCaveTitle, assignCaveModRole } = useCaves()
  const [memberError, setMemberError] = useState('')
  const [roleError, setRoleError] = useState('')
  const [roleBusy, setRoleBusy] = useState('')
  const isOwner = isCaveOwner(cave, currentUserId)
  const isKeeper = isCaveKeeper(cave, currentUserId)

  async function setFunTitle(memberId, titleId) {
    setRoleError('')
    setRoleBusy(memberId)
    const title = CAVE_FUN_TITLES.find((t) => t.id === titleId)
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
          <section className={isOwner ? 'mb-6' : ''}>
            <h3 className="frens-label mb-1">Roles</h3>
            <p className="text-xs frens-muted mb-3">
              Fun titles, temporary co-keepers, and playlist DJs. Pin and hide spam from chat.
            </p>
            {roleError ? (
              <p className="text-xs text-red-500 dark:text-red-400 mb-2">{roleError}</p>
            ) : null}
            <ul className="space-y-3">
              {cave.members.map((m) => {
                const isSelf = m.id === currentUserId
                const isMemberOwner = m.id === cave.ownerId
                const title = activeFunTitle(m)
                const mod = activeModRole(m)
                const busy = roleBusy === m.id || roleBusy === `${m.id}-mod`
                return (
                  <li key={m.id} className="border frens-border rounded-xl px-3 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <ProfileAvatar profile={m} className="w-8 h-8 shrink-0" logoClassName="w-5 h-auto" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {m.name} {isSelf && <span className="frens-muted text-xs font-normal">(you)</span>}
                          {isMemberOwner && <span className="frens-muted text-xs font-normal"> · founder</span>}
                        </p>
                        <CaveRoleBadge member={m} />
                      </div>
                    </div>
                    {!isMemberOwner ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-[10px] frens-muted uppercase tracking-wide">Fun title</span>
                          <FrensSelect
                            value={title.id}
                            disabled={busy}
                            onChange={(id) => setFunTitle(m.id, id)}
                            ariaLabel="Fun title"
                            options={CAVE_FUN_TITLES.map((t) => ({ value: t.id, label: t.label }))}
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

        {isOwner ? (
          <section>
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
                    <CaveRoleBadge member={m} compact />
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
      </div>
    </div>
  )
}

function CaveModMenu({ message, mine, onPin, onHide }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="frens-action w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none frens-muted hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Message options"
        aria-expanded={open}
      >
        ···
      </button>
      {open ? (
        <div
          className={`absolute bottom-full mb-1 ${mine ? 'right-0' : 'left-0'} frens-surface border frens-border rounded-lg shadow-lg py-1 min-w-[8rem] z-20`}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onPin?.() }}
            className="block w-full text-left text-xs px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 inline-flex items-center gap-1.5"
          >
            <PinIcon className="w-3 h-3" />
            {message.pinned ? 'Unpin' : 'Pin'}
          </button>
          {!message.hidden ? (
            <button
              type="button"
              onClick={() => { setOpen(false); onHide?.() }}
              className="block w-full text-left text-xs px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              Hide spam
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ChatMessage({
  message,
  member,
  mine,
  caveId,
  canModerate,
  onReact,
  onPin,
  onHide,
}) {
  const canReact = caveId && message.id != null && !String(message.id).startsWith('tmp-')
  const canMod = canModerate && canReact && !message.hidden

  return (
    <div className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''} ${message.hidden ? 'opacity-50' : ''}`}>
      <ProfileAvatar profile={message} className="w-8 h-8 shrink-0" logoClassName="w-5 h-auto" />
      <div className={`min-w-0 max-w-[78%] ${mine ? 'items-end text-right' : ''} flex flex-col`}>
        <div className={`flex items-center gap-1.5 mb-0.5 ${mine ? 'flex-row-reverse' : ''}`}>
          <span className="text-[11px] frens-muted">
            {message.authorName} · {message.ts}
          </span>
          {member ? <CaveRoleBadge member={member} compact /> : null}
          {message.pinned ? <PinIcon className="w-3 h-3" title="Pinned" /> : null}
          {message.hidden ? <span className="text-[10px] frens-muted">(hidden)</span> : null}
        </div>
        <div className={`flex items-end gap-1.5 max-w-full ${mine ? 'flex-row-reverse' : ''}`}>
          <div className="min-w-0">
            {message.sticker ? (
              <span className="text-4xl leading-none">{message.sticker}</span>
            ) : (
              <>
                {message.image ? (
                  <SharedImage src={message.image} className={message.text ? 'mb-1' : ''} />
                ) : null}
                {message.text ? (
                  hasRichEmbeds(message.text) ? (
                    <RichText text={message.text} />
                  ) : (
                    <div className={textBubbleClass(mine)}>
                      <RichText text={message.text} />
                    </div>
                  )
                ) : null}
              </>
            )}
          </div>
          <EmojiReactions
            reactions={message.reactions}
            mine={mine}
            canReact={canReact}
            onReact={onReact}
            controlsOnly
            extra={canMod ? (
              <CaveModMenu message={message} mine={mine} onPin={onPin} onHide={onHide} />
            ) : null}
          />
        </div>
        <EmojiReactions
          reactions={message.reactions}
          mine={mine}
          canReact={canReact}
          onReact={onReact}
          chipsOnly
        />
      </div>
    </div>
  )
}

export default function CaveDetail({ cave, currentUserId, currentUserProfile, onUpdateCave, onSendMessage, onBack }) {
  const { reactToCaveMessage, pinCaveMessage, hideCaveMessage } = useCaves()
  const [draft, setDraft] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [caveView, setCaveView] = useState(() => readStoredCaveView(cave.id))
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState('')
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const chromeRef = useRef(null)
  const rootRef = useRef(null)

  const isKeeper = isCaveKeeper(cave, currentUserId)
  const visibleMessages = (cave.messages || []).filter((m) => !m.hidden || isKeeper)
  const pinned = visibleMessages.filter((m) => m.pinned)
  const chatMessages = visibleMessages.filter((m) => !m.pinned)

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
    if (onSendMessage) {
      onSendMessage(fields, auth)
      return
    }
    onUpdateCave((c) => ({
      ...c,
      messages: [
        ...c.messages,
        { id: Date.now(), ts: 'just now', ...auth, ...fields },
      ],
    }))
  }

  function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    pushMessage({ text })
    setDraft('')
  }

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
  }

  function switchCaveView(view) {
    setCaveView(view)
    storeCaveView(cave.id, view)
  }

  return (
    // Full-bleed: Home already drops content padding when a cave is open.
    // Do not use negative margin here — it overflows the scrollport and
    // makes sticky playlist chrome jump / clip.
    <div ref={rootRef} className="flex flex-col min-h-[calc(100dvh-8rem)] w-full">
      {/* Compact cave chrome */}
      <div ref={chromeRef} className="sticky top-0 z-20 frens-surface shrink-0">
        <div className="px-3 pt-2 pb-1 flex items-center gap-2">
          <button type="button" onClick={onBack} className="frens-muted text-lg px-1 shrink-0" aria-label="Back to caves">
            ‹
          </button>
          <span className="w-8 h-8 rounded-lg frens-avatar-ring flex items-center justify-center shrink-0">
            <CaveGlyph className="w-4 h-4" />
          </span>
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
      </div>

      <div
        className={caveView === 'chat' ? '' : 'hidden'}
        aria-hidden={caveView !== 'chat'}
      >
      {/* Chat */}
      <div className="flex flex-col justify-end min-h-[10rem] p-3 space-y-3">
        {pinned.length > 0 ? (
          <div className="rounded-xl p-2 space-y-2 bg-black/[0.02] dark:bg-white/[0.02]">
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
                canModerate={isKeeper}
                onReact={(emoji) => reactToCaveMessage(cave.id, m.id, emoji)}
                onPin={() => pinCaveMessage(cave.id, m.id)}
                onHide={() => hideCaveMessage(cave.id, m.id)}
              />
            ))}
          </div>
        ) : null}
        {visibleMessages.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <p className="text-sm frens-body-text mb-1">Quiet in here</p>
            <p className="text-xs frens-muted">Say hi to start the cave.</p>
          </div>
        ) : (
          chatMessages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              member={memberById(cave, m.authorId)}
              mine={m.authorId === currentUserId}
              caveId={cave.id}
              canModerate={isKeeper}
              onReact={(emoji) => reactToCaveMessage(cave.id, m.id, emoji)}
              onPin={() => pinCaveMessage(cave.id, m.id)}
              onHide={() => hideCaveMessage(cave.id, m.id)}
            />
          ))
        )}
        <div ref={scrollRef} aria-hidden className="h-px shrink-0" />
      </div>

      {/* Input bar */}
      <div className="sticky bottom-0 z-20 frens-surface shrink-0 px-3 pt-2 pb-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,image/gif,.gif"
          className="hidden"
          onChange={handleImage}
        />
        <PillComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSend}
          placeholder="message your cave..."
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
        <CavePlaylists cave={cave} currentUserId={currentUserId} />
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
        />
      )}
    </div>
  )
}
