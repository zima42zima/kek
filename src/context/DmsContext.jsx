import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  listDmThreads,
  listDmMessages,
  getOrCreateDm,
  sendDmMessageRemote,
  markDmRead,
  toggleDmMessageReaction,
  deleteDmMessageRemote,
  DmsNotInstalledError,
} from '../lib/dms'
import { applyEmojiReactionToggle } from '../lib/emojiReactions'

const DmsContext = createContext(undefined)
const SYNC_MS = 5000

export function DmsProvider({ children }) {
  const { user, profile } = useAuth()
  const meId = user?.id ?? null
  const [threads, setThreads] = useState([])
  const [messagesByConvo, setMessagesByConvo] = useState({})
  const [remote, setRemote] = useState(true)
  const [pendingOpenId, setPendingOpenId] = useState(null)
  const profileRef = useRef(profile)
  profileRef.current = profile

  const totalUnread = threads.reduce((n, t) => n + (t.unread || 0), 0)

  const refreshThreads = useCallback(async () => {
    if (!meId || !remote) return
    try {
      const rows = await listDmThreads()
      setThreads(rows)
    } catch (err) {
      if (err instanceof DmsNotInstalledError) setRemote(false)
      else console.error('Could not load DMs:', err.message)
    }
  }, [meId, remote])

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId || !remote) return
    try {
      const rows = await listDmMessages(conversationId)
      setMessagesByConvo((prev) => ({ ...prev, [conversationId]: rows }))
      await markDmRead(conversationId)
      setThreads((prev) =>
        prev.map((t) => (t.id === conversationId ? { ...t, unread: 0 } : t)),
      )
    } catch (err) {
      if (err instanceof DmsNotInstalledError) setRemote(false)
      else console.error('Could not load DM messages:', err.message)
    }
  }, [remote])

  useEffect(() => {
    if (!meId) {
      setThreads([])
      setMessagesByConvo({})
      return
    }
    setRemote(true)
    refreshThreads()
    const t = setInterval(refreshThreads, SYNC_MS)
    const onFocus = () => refreshThreads()
    const onNotifs = () => refreshThreads()
    window.addEventListener('focus', onFocus)
    window.addEventListener('frens:notifications-refreshed', onNotifs)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('frens:notifications-refreshed', onNotifs)
    }
  }, [meId, refreshThreads])

  async function openConversation(conversationId) {
    setPendingOpenId(conversationId)
    await loadMessages(conversationId)
  }

  async function openConversationWithUser(targetId, profileHint) {
    if (!targetId || targetId === meId) return null
    try {
      const conversationId = await getOrCreateDm(targetId)
      if (profileHint) {
        setThreads((prev) => {
          if (prev.some((t) => t.id === conversationId)) return prev
          return [{
            id: conversationId,
            otherUserId: targetId,
            otherName: profileHint.frenName || 'a fren',
            otherAvatarType: profileHint.avatarType || 'frog',
            otherAvatarUrl: profileHint.avatarUrl || null,
            preview: 'No messages yet',
            lastAt: new Date().toISOString(),
            unread: 0,
          }, ...prev]
        })
      }
      await openConversation(conversationId)
      await refreshThreads()
      return conversationId
    } catch (err) {
      if (err instanceof DmsNotInstalledError) setRemote(false)
      else console.error('Could not open DM:', err.message)
      return null
    }
  }

  function clearPendingOpen() {
    setPendingOpenId(null)
  }

  async function sendDmMessage(conversationId, fields) {
    const p = profileRef.current
    const optimistic = {
      id: `tmp-${Date.now()}`,
      senderId: meId,
      authorName: p?.frenName || 'you',
      avatarType: p?.avatarType || 'frog',
      avatarUrl: p?.avatarUrl || null,
      text: fields.text || '',
      image: fields.image || null,
      video: fields.video || null,
      sticker: fields.sticker || null,
      ts: 'just now',
    }
    setMessagesByConvo((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), optimistic],
    }))
    if (!remote) return
    try {
      await sendDmMessageRemote(conversationId, {
        text: fields.text,
        image: fields.image,
        video: fields.video,
        sticker: fields.sticker,
        authorName: optimistic.authorName,
        avatarType: optimistic.avatarType,
        avatarUrl: optimistic.avatarUrl,
      })
      await loadMessages(conversationId)
      await refreshThreads()
      window.dispatchEvent(new CustomEvent('frens:notifications-refreshed'))
    } catch (err) {
      if (err instanceof DmsNotInstalledError) setRemote(false)
      else console.error('Could not send DM:', err.message)
      setMessagesByConvo((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((m) => m.id !== optimistic.id),
      }))
    }
  }

  async function deleteDmMessage(conversationId, messageId) {
    if (messageId == null || !conversationId) return
    const id = String(messageId)
    let snapshot = null
    setMessagesByConvo((prev) => {
      snapshot = prev[conversationId] || []
      return {
        ...prev,
        [conversationId]: snapshot.filter((m) => String(m.id) !== id),
      }
    })
    if (id.startsWith('tmp-') || !remote) return
    try {
      await deleteDmMessageRemote(conversationId, messageId)
      await loadMessages(conversationId)
      await refreshThreads()
    } catch (err) {
      if (snapshot) {
        setMessagesByConvo((prev) => ({
          ...prev,
          [conversationId]: snapshot,
        }))
      }
      if (!(err instanceof DmsNotInstalledError)) {
        console.error('Could not delete DM:', err.message)
      }
    }
  }

  async function reactToDmMessage(conversationId, messageId, emoji) {
    const em = (emoji || '').trim()
    if (!em || messageId == null || !conversationId) return
    if (String(messageId).startsWith('tmp-')) return

    let prevReactions = []
    setMessagesByConvo((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map((m) => {
        if (m.id !== messageId) return m
        prevReactions = m.reactions || []
        return { ...m, reactions: applyEmojiReactionToggle(m.reactions, em) }
      }),
    }))

    if (!remote) return

    try {
      const reactions = await toggleDmMessageReaction(messageId, conversationId, em)
      setMessagesByConvo((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m,
        ),
      }))
    } catch (err) {
      setMessagesByConvo((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions: prevReactions } : m,
        ),
      }))
      if (!(err instanceof DmsNotInstalledError)) {
        console.error('Could not react to DM:', err.message)
      }
    }
  }

  const value = {
    threads,
    messagesByConvo,
    totalUnread,
    remote,
    pendingOpenId,
    refreshThreads,
    loadMessages,
    openConversation,
    openConversationWithUser,
    sendDmMessage,
    deleteDmMessage,
    reactToDmMessage,
    clearPendingOpen,
  }

  return <DmsContext.Provider value={value}>{children}</DmsContext.Provider>
}

export function useDms() {
  const ctx = useContext(DmsContext)
  if (ctx === undefined) throw new Error('useDms must be used inside DmsProvider')
  return ctx
}
