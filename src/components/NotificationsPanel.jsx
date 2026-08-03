import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { ProfileAvatar } from './FrogLogo'
import { useNotifications } from '../context/NotificationsContext'
import { useCaves } from '../context/CavesContext'
import { relativeTime } from '../lib/notifications'
import { linkifyText } from '../lib/linkText'
import { requestOpenPsPanel } from '../lib/psNav'
import { requestOpenFounderConsole } from '../lib/founderNav'
import FoldsLettersIcon from './owl/FoldsLettersIcon'
import { isNotificationClickable, requestPostFocus, requestEchoFocus } from '../lib/notificationNav'
import {
  NOTIFICATION_SECTIONS,
  defaultNotificationSection,
  getNotificationSection,
  sectionMeta,
  unreadBySection,
} from '../lib/notificationSections'
import FrenHandle from './FrenHandle'

function PreviewText({ text }) {
  if (!text) return null
  return <span className="frens-muted"> — {linkifyText(text)}</span>
}

function NotifText({ n }) {
  const name = <FrenHandle inline>{n.actorName}</FrenHandle>
  switch (n.type) {
    case 'follow':
      return <span>{name} started following you</span>
    case 'aura':
      return (
        <span>
          {name} gave aura to your post
          {n.postPreview ? <PreviewText text={n.postPreview} /> : null}
        </span>
      )
    case 'comment':
      return (
        <span>
          {name} commented on your post
          {n.postPreview ? <PreviewText text={n.postPreview} /> : null}
        </span>
      )
    case 'comment_reaction':
      return (
        <span>
          {name} reacted to your comment
          {n.postPreview ? <PreviewText text={n.postPreview} /> : null}
        </span>
      )
    case 'post_reaction':
      return (
        <span>
          {name} reacted to your post
          {n.postPreview ? <PreviewText text={n.postPreview} /> : null}
        </span>
      )
    case 'mention':
      return (
        <span>
          {name} mentioned you
          {n.postPreview ? <PreviewText text={n.postPreview} /> : null}
        </span>
      )
    case 'cave':
      return <span>{name} {n.text ? linkifyText(n.text) : 'posted in your cave'}</span>
    case 'cave_add':
      return (
        <span>
          {name} added you to <span className="frens-stat">{n.caveName || 'a cave'}</span>
        </span>
      )
    case 'cave_deleted':
      return (
        <span>
          {name} deleted the cave{' '}
          <span className="frens-stat">{n.caveName || 'you were in'}</span>
        </span>
      )
    case 'echo_aura':
      return <span>{name} gave aura to your aftersound</span>
    case 'echo':
      return <span>{name} left an aftersound near you — tap to listen</span>
    case 'echo_follow':
      return (
        <span>
          {name} left an aftersound in {n.cityLabel || 'your area'} — a bat is flying nearby
        </span>
      )
    case 'echo_published':
      return (
        <span>
          {name} dropped a meme spot{n.cityLabel ? ` in ${n.cityLabel}` : ''} — tap to find it
        </span>
      )
    case 'echo_friends':
      return (
        <span>
          {name} left a friends-only aftersound{n.cityLabel ? ` near ${n.cityLabel}` : ''} — tap to open
        </span>
      )
    case 'dm':
      return (
        <span>
          {name} messaged you
          {n.dmPreview ? <PreviewText text={n.dmPreview} /> : null}
        </span>
      )
    case 'rabbit_reply':
      return (
        <span>
          {name} replied in <span className="frens-stat">{n.rabbitPreview || 'a thread'}</span>
        </span>
      )
    case 'rabbit_follow':
      return (
        <span>
          {name} replied in a thread you follow — <span className="frens-stat">{n.rabbitPreview || 'rabbit hole'}</span>
        </span>
      )
    case 'owl_letter':
      return n.owlLetterAnonymous ? (
        <span>A letter arrived — open P.S.</span>
      ) : (
        <span>{name} sent you a letter</span>
      )
    case 'fold_received':
      return <span>{name} sent you a fold</span>
    case 'platform_report':
      return (
        <span>
          New report — <span className="frens-stat">{n.rabbitPreview || 'review in Founder console'}</span>
        </span>
      )
    default:
      return <span>{name} {n.text ? linkifyText(n.text) : null}</span>
  }
}

function NotifAvatar({ n }) {
  if (n.type === 'owl_letter' && n.owlLetterAnonymous) {
    return (
      <div
        className="w-9 h-9 rounded-full border border-frens flex items-center justify-center shrink-0 bg-white dark:bg-black"
        aria-hidden
      >
        <FoldsLettersIcon className="w-4 h-4" />
      </div>
    )
  }

  const actor = {
    frenName: n.actorName || 'a fren',
    avatarType: n.actorAvatarType,
    avatarUrl: n.actorAvatarUrl,
  }
  return <ProfileAvatar profile={actor} className="w-9 h-9" logoClassName="w-5 h-auto" />
}

function NotificationRow({ n, onClick }) {
  const clickable = isNotificationClickable(n)
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(n)}
        disabled={!clickable}
        className={`w-full flex items-start gap-3 px-1 py-3 text-left border-b frens-border last:border-b-0 ${
          clickable ? 'hover:bg-black/5 dark:hover:bg-white/5' : 'cursor-default'
        }`}
      >
        <div className="relative shrink-0">
          <NotifAvatar n={n} />
          {!n.read && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-black dark:bg-white" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm frens-body-text leading-snug break-words">
            <NotifText n={n} />
          </p>
          <p className="text-[11px] frens-muted mt-0.5">{relativeTime(n.createdAt)}</p>
        </div>
      </button>
    </li>
  )
}

function SectionTabs({ active, onChange, counts }) {
  return (
    <div
      className="flex border frens-border divide-x divide-frens -mx-1 mb-4"
      role="tablist"
      aria-label="Notification sections"
    >
      {NOTIFICATION_SECTIONS.map((section) => {
        const count = counts[section.id] || 0
        const selected = active === section.id
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(section.id)}
            className={`flex-1 min-w-0 px-2 py-2.5 text-[10px] uppercase tracking-wider transition ${
              selected
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'frens-muted hover:text-black dark:hover:text-white'
            }`}
          >
            <span className="block truncate">{section.label}</span>
            {count > 0 ? (
              <span className={`block text-[9px] mt-0.5 ${selected ? 'opacity-80' : 'frens-hint'}`}>
                {count} new
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export default function NotificationsPanel({
  onClose,
  onNavigate,
  onOpenDm,
  onOpenProfile,
  onOpenPost,
  onOpenEcho,
}) {
  const { items, markAllRead } = useNotifications()
  const { joinCaveFromInvite, syncMemberships } = useCaves()
  const [section, setSection] = useState(() => defaultNotificationSection(items))

  const sectionCounts = useMemo(() => unreadBySection(items), [items])
  const sectionItems = useMemo(
    () => items.filter((n) => getNotificationSection(n.type) === section),
    [items, section],
  )
  const activeMeta = sectionMeta(section)

  useEffect(() => {
    syncMemberships()
  }, [syncMemberships])

  useEffect(() => () => { markAllRead() }, [markAllRead])

  async function handleClick(n) {
    if (n.type === 'follow' && n.actorId) {
      onOpenProfile?.(n.actorId)
      onClose?.()
      return
    }
    if ((n.type === 'aura' || n.type === 'comment' || n.type === 'comment_reaction' || n.type === 'post_reaction' || n.type === 'mention') && n.postId) {
      const focus = { postId: n.postId, openComments: n.type === 'comment' || n.type === 'comment_reaction' }
      requestPostFocus(focus)
      onOpenPost?.(focus)
      onNavigate?.('home')
      onClose?.()
      return
    }
    if (n.type === 'dm' && n.conversationId) {
      await onOpenDm?.(n.conversationId)
      onNavigate?.('messages', { conversationId: n.conversationId })
      onClose?.()
      return
    }
    if ((n.type === 'rabbit_reply' || n.type === 'rabbit_follow') && n.rabbitTopicId) {
      onNavigate?.('rabbit', { topicId: n.rabbitTopicId })
      onClose?.()
      return
    }
    if (n.type === 'owl_letter') {
      requestOpenPsPanel('letters')
      onNavigate?.('profile')
      onClose?.()
      return
    }
    if (n.type === 'fold_received') {
      requestOpenPsPanel('folds')
      onNavigate?.('profile')
      onClose?.()
      return
    }
    if (n.type === 'platform_report') {
      requestOpenFounderConsole()
      onNavigate?.('profile')
      onClose?.()
      return
    }
    if ((n.type === 'cave' || n.type === 'cave_add') && n.caveId) {
      if (n.type === 'cave_add') {
        await joinCaveFromInvite(n.caveId)
      }
      onNavigate?.('caves', { caveId: n.caveId })
      onClose?.()
      return
    }
    if (
      n.type === 'echo'
      || n.type === 'echo_follow'
      || n.type === 'echo_aura'
      || n.type === 'echo_published'
      || n.type === 'echo_friends'
    ) {
      if (!n.echoId) return
      requestEchoFocus(n.echoId)
      onOpenEcho?.(n.echoId)
      onNavigate?.('echoes', { echoId: n.echoId })
      onClose?.()
      return
    }
  }

  const totalUnread = items.reduce((n, i) => n + (i.read ? 0 : 1), 0)

  return (
    <Modal
      title={totalUnread > 0 ? `Notifications · ${totalUnread} new` : 'Notifications'}
      onClose={onClose}
      maxWidth="max-w-lg"
      panelClassName="rounded-none p-4 sm:p-5"
    >
      {items.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm frens-muted">No notifications yet.</p>
          <p className="text-xs frens-hint mt-1 max-w-xs mx-auto">
            Personal activity, community spaces, and echo drops each land in their own tab.
          </p>
        </div>
      ) : (
        <>
          <SectionTabs active={section} onChange={setSection} counts={sectionCounts} />

          <p className="text-[11px] frens-hint mb-3 -mt-1">{activeMeta.hint}</p>

          {sectionItems.length === 0 ? (
            <div className="py-8 text-center border frens-border">
              <p className="text-sm frens-muted">Nothing in {activeMeta.label.toLowerCase()} yet.</p>
              <p className="text-xs frens-hint mt-1 px-6">
                {section === 'personal' && 'Follows, aura, comments, and DMs show up here.'}
                {section === 'community' && 'Cave posts and rabbit hole replies land here.'}
                {section === 'places' && 'Aftersound activity — nearby drops and published spots — shows here.'}
              </p>
            </div>
          ) : (
            <ul className="-mx-1 max-h-[52vh] overflow-y-auto">
              {sectionItems.map((n) => (
                <NotificationRow key={n.id} n={n} onClick={handleClick} />
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  )
}
