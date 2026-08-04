import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ProfileAvatar, ThoughtMark } from '../components/FrogLogo'
import Modal from '../components/Modal'
import RichText from '../components/RichText'
import FrenHandle from '../components/FrenHandle'
import PinnedLabel from '../components/PinnedLabel'
import PillComposer from '../components/PillComposer'
import { appendGifUrlToText, prepareCommentText } from '../lib/imageAttach'
import { insertAtCaret } from '../lib/insertText'
import rabbitholeIcon from '../assets/icons/rabbithole.svg'
import { maskImageStyle } from '../lib/maskIcon'
import {
  RABBIT_RULES,
  RABBIT_SORTS,
  displayAuthor,
} from '../lib/rabbitHoleConstants'
import {
  listTopics,
  getTopic,
  listReplies,
  createTopic,
  createReply,
  deleteTopic,
  deleteReply,
  toggleFollow,
  hideTopic,
  pinTopic,
  reportTopic,
  reportReply,
  amIMod,
  RabbitHoleNotInstalledError,
} from '../lib/rabbitHole'

/** Photo when set; otherwise the same solid mark used in front of feed text posts (not monad). */
function RhAvatar({ profile, className = 'w-8 h-8' }) {
  if (
    (profile?.avatarType === 'photo' && (profile?.avatarUrl || profile?.avatarPreview))
  ) {
    return <ProfileAvatar profile={profile} className={className} logoClassName="w-5 h-auto" />
  }
  return (
    <span
      className={`${className} shrink-0 inline-flex items-center justify-center`}
      aria-hidden
    >
      <ThoughtMark className="w-[8px] h-[8px]" />
    </span>
  )
}

function RulesBanner() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border frens-border rounded-xl overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 text-left flex items-center justify-between gap-2"
      >
        <span className="text-sm font-medium">Rules</span>
        <span className="text-xs frens-muted">{open ? 'hide' : 'show'}</span>
      </button>
      {open ? (
        <ul className="px-4 pb-3 space-y-1.5 text-xs frens-muted list-disc list-inside border-t frens-border pt-3">
          {RABBIT_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function TopicRow({ topic, viewerId, isMod, onOpen }) {
  const author = displayAuthor(topic, viewerId, isMod)
  const preview = topic.body?.trim()
    ? topic.body.trim().slice(0, 120) + (topic.body.length > 120 ? '…' : '')
    : null

  return (
    <button
      type="button"
      onClick={() => onOpen(topic.id)}
      className={`w-full text-left border frens-border rounded-xl p-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition ${
        topic.pinned ? 'ring-1 ring-[#6BC06B]/40' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <RhAvatar profile={author} className="w-9 h-9" />
        <div className="min-w-0 flex-1">
          {(topic.pinned || (topic.hidden && isMod)) ? (
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {topic.pinned ? <PinnedLabel className="frens-badge-count" /> : null}
              {topic.hidden && isMod ? <span className="text-[10px] text-red-500">hidden</span> : null}
            </div>
          ) : null}
          <h3 className="frens-title-sm leading-snug">{topic.title}</h3>
          {preview ? (
            <div className="flex items-start gap-2 mt-1 min-w-0">
              <span className="h-[1.35em] shrink-0 inline-flex items-center" aria-hidden>
                <ThoughtMark className="w-[6px] h-[6px]" />
              </span>
              <p className="text-xs frens-muted line-clamp-2 min-w-0">{preview}</p>
            </div>
          ) : null}
          <div className="flex items-center gap-3 mt-2 text-[11px] frens-muted">
            <span>{author.frenName}</span>
            <span>·</span>
            <span>{topic.timestamp}</span>
            <span>·</span>
            <span>{topic.replyCount === 1 ? '1 reply' : `${topic.replyCount} replies`}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

function NewTopicModal({ profile, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bodyRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const id = await createTopic({
        title: title.trim(),
        body: await prepareCommentText(body.trim(), { prefix: 'rabbit-hole' }),
        tag: null,
        anonymous,
        frenName: profile?.frenName || 'a fren',
        avatarType: profile?.avatarType || 'frog',
        avatarUrl: profile?.avatarUrl || null,
      })
      onCreated(id)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not start topic.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="New rabbit hole topic" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="rh-title" className="block frens-label mb-1">Title</label>
          <input
            id="rh-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="what are we talking about?"
            className="frens-input"
            maxLength={200}
          />
        </div>
        <div>
          <label htmlFor="rh-body" className="block frens-label mb-1">Context (optional)</label>
          <PillComposer
            asForm={false}
            showSubmit={false}
            value={body}
            onChange={setBody}
            placeholder="say more if you want…"
            inputRef={bodyRef}
            onMediaPick={(url) => setBody((prev) => appendGifUrlToText(prev, url))}
            onEmoji={(emoji) => setBody((prev) => insertAtCaret(bodyRef.current, prev, emoji))}
            onGif={(url) => setBody((prev) => appendGifUrlToText(prev, url))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm frens-body-text">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          Post anonymously (still moderated)
        </label>
        {error ? <p className="text-xs text-red-500 dark:text-red-400">{error}</p> : null}
        <button type="submit" disabled={!title.trim() || busy} className="frens-btn-primary w-full py-2.5 text-sm disabled:opacity-50">
          {busy ? 'Posting…' : 'Go down the hole'}
        </button>
      </form>
    </Modal>
  )
}

function TopicDetail({ topicId, userId, isMod, onBack, onDeleted }) {
  const [topic, setTopic] = useState(null)
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const { profile } = useAuth()
  const replyRef = useRef(null)

  function load() {
    setLoading(true)
    setError('')
    Promise.all([getTopic(topicId), listReplies(topicId)])
      .then(([t, rs]) => {
        if (!t) {
          setError('This topic is gone.')
          return
        }
        setTopic(t)
        setReplies(rs)
      })
      .catch((err) => setError(err.message || 'Could not load topic.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId])

  async function handleReply(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    setError('')
    try {
      await createReply(topicId, {
        body: await prepareCommentText(text, { prefix: 'rabbit-hole' }),
        anonymous,
        frenName: profile?.frenName || 'a fren',
        avatarType: profile?.avatarType || 'frog',
        avatarUrl: profile?.avatarUrl || null,
      })
      setDraft('')
      load()
    } catch (err) {
      setError(err.message || 'Could not reply.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFollow() {
    if (!topic || busy) return
    setBusy(true)
    try {
      const following = await toggleFollow(topic.id)
      setTopic((prev) => (prev ? { ...prev, iFollow: following } : prev))
      setMsg(following ? 'Following this thread ✓' : 'Unfollowed thread')
      setTimeout(() => setMsg(''), 2000)
    } catch (err) {
      setError(err.message || 'Could not update follow.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReportTopic() {
    try {
      await reportTopic(topicId)
      setMsg('Reported — thank you')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      setError(err.message || 'Could not report.')
    }
  }

  async function handleModHide() {
    if (!topic || !isMod) return
    setBusy(true)
    try {
      await hideTopic(topic.id, !topic.hidden)
      if (topic.hidden) onBack()
      else load()
    } catch (err) {
      setError(err.message || 'Mod action failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleModPin() {
    if (!topic || !isMod) return
    setBusy(true)
    try {
      await pinTopic(topic.id, !topic.pinned)
      load()
    } catch (err) {
      setError(err.message || 'Mod action failed.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm frens-muted text-center py-10">Going deeper…</p>

  if (!topic) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-red-500 dark:text-red-400">{error || 'Topic not found.'}</p>
        <button type="button" onClick={onBack} className="frens-btn-outline mt-4 px-4 py-2 text-sm">Back</button>
      </div>
    )
  }

  const author = displayAuthor(topic, userId, isMod)
  const canDeleteTopic = topic.userId && userId && topic.userId === userId

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="frens-muted text-sm hover:underline">← back to topics</button>

      <article className="border frens-border rounded-xl p-4 bg-gradient-to-br from-black/[0.02] to-transparent dark:from-white/[0.03]">
        <div className="flex items-start gap-3">
          <RhAvatar profile={author} className="w-10 h-10" />
          <div className="min-w-0 flex-1">
            {topic.pinned ? (
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <PinnedLabel className="frens-badge-count" />
              </div>
            ) : null}
            <h2 className="frens-title-lg leading-snug">{topic.title}</h2>
            <p className="text-[11px] frens-muted mt-1">{author.frenName} · {relativeLabel(topic.createdAt)}</p>
            {topic.body ? (
              <div className="flex items-start gap-2 mt-3 min-w-0">
                <span className="h-[1.5em] shrink-0 inline-flex items-center" aria-hidden>
                  <ThoughtMark className="w-[6px] h-[6px]" />
                </span>
                <RichText text={topic.body} className="frens-post-text min-w-0 flex-1" variant="timeline" />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" onClick={handleFollow} disabled={busy} className={`text-xs px-3 py-1.5 rounded-full border frens-border ${topic.iFollow ? 'bg-black/10 dark:bg-white/10' : ''}`}>
                {topic.iFollow ? 'Following' : 'Follow thread'}
              </button>
              <button type="button" onClick={handleReportTopic} className="text-xs frens-action px-2 py-1.5">Report</button>
              {canDeleteTopic ? (
                <button type="button" onClick={async () => { await deleteTopic(topic.id); onDeleted() }} disabled={busy} className="text-xs frens-action px-2 py-1.5">Delete</button>
              ) : null}
              {isMod ? (
                <>
                  <button type="button" onClick={handleModPin} disabled={busy} className="text-xs frens-action px-2 py-1.5">{topic.pinned ? 'Unpin' : 'Pin'}</button>
                  <button type="button" onClick={handleModHide} disabled={busy} className="text-xs frens-action px-2 py-1.5">{topic.hidden ? 'Unhide' : 'Hide'}</button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </article>

      <div className="space-y-3">
        <p className="text-xs frens-label px-1">
          {replies.length === 0 ? 'No replies yet — be the first' : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
        </p>
        {replies.map((reply) => {
          const replyAuthor = displayAuthor(reply, userId, isMod)
          const hasPhoto =
            replyAuthor.avatarType === 'photo' &&
            (replyAuthor.avatarUrl || replyAuthor.avatarPreview)
          return (
            <div key={reply.id} className="flex gap-3 rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.03]">
              {hasPhoto ? (
                <ProfileAvatar profile={replyAuthor} className="w-8 h-8 shrink-0" logoClassName="w-5 h-auto" />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  <FrenHandle className="text-xs">{replyAuthor.frenName}</FrenHandle>
                  <span className="text-[10px] frens-muted">{reply.timestamp}</span>
                  <button type="button" onClick={() => reportReply(reply.id).then(() => setMsg('Reported reply ✓'))} className="text-[10px] frens-action ml-auto">Report</button>
                  {reply.userId === userId ? (
                    <button type="button" onClick={() => deleteReply(reply.id).then(load)} disabled={busy} className="text-[10px] frens-action">Delete</button>
                  ) : null}
                </div>
                <div className="flex items-start gap-2 min-w-0">
                  <span className="h-[1.5em] shrink-0 inline-flex items-center" aria-hidden>
                    <ThoughtMark className="w-[6px] h-[6px]" />
                  </span>
                  <RichText text={reply.body} className="text-sm frens-body-text min-w-0 flex-1" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <PillComposer
        value={draft}
        onChange={setDraft}
        onSubmit={handleReply}
        placeholder="add your take…"
        busy={busy}
        inputRef={replyRef}
        submitDisabled={!draft.trim() || busy}
        onMediaPick={(url) => setDraft((prev) => appendGifUrlToText(prev, url))}
        onEmoji={(emoji) => setDraft((prev) => insertAtCaret(replyRef.current, prev, emoji))}
        onGif={(url) => setDraft((prev) => appendGifUrlToText(prev, url))}
        footer={(
          <>
            <label className="flex items-center gap-2 text-xs frens-muted mt-2">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              Reply anonymously
            </label>
            {error ? <p className="text-xs text-red-500 dark:text-red-400 mt-2">{error}</p> : null}
            {msg ? <p className="text-xs text-[#6BC06B] mt-2">{msg}</p> : null}
          </>
        )}
      />
    </div>
  )
}

function relativeLabel(iso) {
  if (!iso) return 'just now'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function RabbitHole({ topicId: urlTopicId = null, onTopicChange }) {
  const { user, profile } = useAuth()
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [needsSql, setNeedsSql] = useState(false)
  const [needsV2, setNeedsV2] = useState(false)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [activeTopicId, setActiveTopicId] = useState(urlTopicId)
  const [sort, setSort] = useState('active')
  const [isMod, setIsMod] = useState(false)

  useEffect(() => {
    setActiveTopicId(urlTopicId || null)
  }, [urlTopicId])

  function selectTopic(id) {
    setActiveTopicId(id)
    onTopicChange?.(id || null)
  }

  function loadTopics() {
    setLoading(true)
    setError('')
    listTopics({ sort, tag: null })
      .then(setTopics)
      .catch((err) => {
        if (err instanceof RabbitHoleNotInstalledError) {
          setNeedsSql(true)
          setTopics([])
          return
        }
        if (err?.code === 'PGRST202') {
          setNeedsV2(true)
        }
        setError(err.message || 'Could not load topics.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    amIMod().then(setIsMod).catch(() => setIsMod(false))
  }, [])

  useEffect(() => {
    if (!activeTopicId) loadTopics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, activeTopicId])

  if (activeTopicId) {
    return (
      <TopicDetail
        topicId={activeTopicId}
        userId={user?.id}
        isMod={isMod}
        onBack={() => {
          selectTopic(null)
          loadTopics()
        }}
        onDeleted={() => {
          selectTopic(null)
          loadTopics()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border frens-border p-4 bg-gradient-to-br from-black/[0.03] via-transparent to-[#6BC06B]/5 dark:from-white/[0.04] dark:to-[#6BC06B]/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              aria-hidden
              className="frens-mask-icon w-10 h-10 shrink-0"
              style={maskImageStyle(rabbitholeIcon)}
            />
            <div className="min-w-0">
              <h2 className="frens-title-lg">Rabbit Hole</h2>
              <p className="text-xs frens-muted">Threads you care about — open one, or start your own</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowNew(true)} className="frens-btn-primary px-3 py-2 text-sm shrink-0">+ Topic</button>
        </div>
      </div>

      <RulesBanner />

      <div className="flex flex-wrap gap-2">
        {RABBIT_SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSort(s.id)}
            className={`text-xs px-3 py-1.5 rounded-full border frens-border ${sort === s.id ? 'bg-black text-white dark:bg-white dark:text-black' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {needsSql ? (
        <div className="border border-amber-400/50 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-200">
          Run <code>supabase-patch-rabbit-hole.sql</code> in Supabase SQL Editor.
        </div>
      ) : null}

      {needsV2 ? (
        <div className="border border-amber-400/50 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-200">
          Run <code>supabase-patch-rabbit-hole-v2.sql</code> for tags, follows, and moderation.
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-500 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm frens-muted text-center py-8">Loading topics…</p>
      ) : topics.length === 0 ? (
        <div className="border frens-border rounded-xl p-8 text-center">
          <p className="text-sm frens-body-text mb-1">No topics yet</p>
          <p className="text-xs frens-muted mb-4">Start a topic to open a thread.</p>
          <button type="button" onClick={() => setShowNew(true)} className="frens-btn-outline px-4 py-2 text-sm">Start a topic</button>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} viewerId={user?.id} isMod={isMod} onOpen={selectTopic} />
          ))}
        </div>
      )}

      {showNew ? (
        <NewTopicModal
          profile={profile}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            loadTopics()
            selectTopic(id)
          }}
        />
      ) : null}
    </div>
  )
}
