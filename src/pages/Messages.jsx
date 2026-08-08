import { useEffect, useState } from 'react'
import { ProfileAvatar } from '../components/FrogLogo'
import { useAuth } from '../context/AuthContext'
import { useDms } from '../context/DmsContext'
import { searchProfiles } from '../lib/social'
import { relativeTime } from '../lib/notifications'
import DmThread from '../components/dms/DmThread'
import FrenHandle from '../components/FrenHandle'
import ConfirmDialog from '../components/ConfirmDialog'

function ThreadRow({ thread, onOpen, onDelete }) {
  const profile = {
    frenName: thread.otherName,
    avatarType: thread.otherAvatarType,
    avatarUrl: thread.otherAvatarUrl,
  }
  return (
    <li className="border frens-border rounded-xl p-3 flex items-start gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition">
      <button
        type="button"
        onClick={() => onOpen(thread.id)}
        className="min-w-0 flex-1 text-left flex items-center gap-3"
      >
        <div className="relative shrink-0">
          <ProfileAvatar profile={profile} className="w-11 h-11" logoClassName="w-6 h-auto" />
          {thread.unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-black text-white dark:bg-white dark:text-black text-[10px] frens-badge-count flex items-center justify-center">
              {thread.unread > 9 ? '9+' : thread.unread}
            </span>
          )}
        </div>
        <span className="min-w-0 flex-1">
          <FrenHandle>{thread.otherName}</FrenHandle>
          <span className={`block text-xs truncate mt-0.5 font-light ${thread.unread ? 'frens-body-text' : 'frens-muted'}`}>
            {thread.preview}
          </span>
        </span>
      </button>
      <div className="shrink-0 flex flex-col items-end gap-0.5 pt-0.5">
        {thread.lastAt ? (
          <span className="text-[10px] frens-muted tracking-wide">{relativeTime(thread.lastAt)}</span>
        ) : (
          <span className="text-[10px] frens-muted tracking-wide opacity-0" aria-hidden>·</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.(thread)
          }}
          className="text-[10px] frens-muted tracking-wide hover:underline"
        >
          delete
        </button>
      </div>
    </li>
  )
}

export default function Messages({ conversationId: urlConversationId = null, onConversationChange }) {
  const { user } = useAuth()
  const {
    threads,
    messagesByConvo,
    pendingOpenId,
    clearPendingOpen,
    openConversationWithUser,
    sendDmMessage,
    loadMessages,
    hideDmThread,
    remote,
  } = useDms()

  const [selectedId, setSelectedId] = useState(urlConversationId)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    setSelectedId(urlConversationId || null)
  }, [urlConversationId])

  function selectConversation(id) {
    setSelectedId(id)
    onConversationChange?.(id || null)
  }

  useEffect(() => {
    if (pendingOpenId) {
      selectConversation(pendingOpenId)
      clearPendingOpen()
    }
  }, [pendingOpenId, clearPendingOpen])

  useEffect(() => {
    if (selectedId) loadMessages(selectedId)
  }, [selectedId, loadMessages])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(() => {
      searchProfiles(q)
        .then((rows) => setResults(rows.filter((r) => r.userId !== user?.id)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query, user?.id])

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null
  const messages = selectedId ? (messagesByConvo[selectedId] || []) : []

  async function startWith(person) {
    const id = await openConversationWithUser(person.userId, person)
    if (id) {
      selectConversation(id)
      setQuery('')
      setResults([])
    }
  }

  if (selectedThread) {
    return (
      <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">
        <DmThread
          thread={selectedThread}
          messages={messages}
          currentUserId={user?.id}
          onSend={(fields) => sendDmMessage(selectedId, fields)}
          onBack={() => selectConversation(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="frens-title-xl mb-1">Messages</h2>
        <p className="text-xs frens-muted">Private chats with other frens</p>
      </div>

      {!remote && (
        <p className="text-xs text-amber-600 dark:text-amber-400 border frens-border rounded-lg px-3 py-2">
          Run <code className="text-[11px]">supabase-patch-dms.sql</code> in Supabase to enable messages.
        </p>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 find a fren to message…"
        className="frens-input py-2"
      />

      {query.trim() && (
        <div>
          {searching ? (
            <p className="text-sm frens-muted py-2">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm frens-muted py-2">No accounts match.</p>
          ) : (
            <ul className="space-y-1 mb-2">
              {results.map((p) => (
                <li key={p.userId}>
                  <button
                    type="button"
                    onClick={() => startWith(p)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <ProfileAvatar profile={p} className="w-9 h-9" logoClassName="w-5 h-auto" />
                    <FrenHandle>{p.frenName}</FrenHandle>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {threads.length === 0 ? (
        <div className="border frens-border rounded-xl p-8 text-center">
          <p className="text-sm frens-body-text mb-1">No conversations yet</p>
          <p className="text-xs frens-muted">Search for a fren above to start a DM.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <ThreadRow
              key={t.id}
              thread={t}
              onOpen={selectConversation}
              onDelete={setPendingDelete}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete conversation?"
        message={
          pendingDelete
            ? `Remove your chat with ${pendingDelete.otherName} from Messages. They keep their copy.`
            : ''
        }
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const thread = pendingDelete
          setPendingDelete(null)
          if (!thread?.id) return
          try {
            await hideDmThread(thread.id)
            if (selectedId === thread.id) selectConversation(null)
          } catch {
            /* keep list; error logged in context */
          }
        }}
      />
    </div>
  )
}
