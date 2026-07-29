import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  listNotifications,
  markAllRead as markAllReadRemote,
  NotificationsNotInstalledError,
} from '../lib/notifications'

const NotificationsContext = createContext(undefined)

const POLL_MS = 15000

function localKey(userId) {
  return `frens-notifs-local-${userId || 'anon'}`
}

function loadLocal(userId) {
  try {
    const raw = localStorage.getItem(localKey(userId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function byNewest(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [remote, setRemote] = useState([])
  const [local, setLocal] = useState([])
  const remoteAvailable = useRef(true)

  // Load local notifications for this user.
  useEffect(() => {
    setLocal(loadLocal(userId))
  }, [userId])

  // Persist local notifications.
  useEffect(() => {
    try {
      localStorage.setItem(localKey(userId), JSON.stringify(local.slice(0, 100)))
    } catch { /* ignore quota */ }
  }, [local, userId])

  const refresh = useCallback(async () => {
    if (!userId || !remoteAvailable.current) return
    try {
      const rows = await listNotifications()
      setRemote(rows)
      window.dispatchEvent(new CustomEvent('frens:notifications-refreshed', { detail: { rows } }))
    } catch (err) {
      if (err instanceof NotificationsNotInstalledError) {
        remoteAvailable.current = false
      } else {
        console.error('Could not load notifications:', err.message)
      }
    }
  }, [userId])

  // Poll for remote notifications while signed in.
  useEffect(() => {
    if (!userId) {
      setRemote([])
      return
    }
    remoteAvailable.current = true
    refresh()
    const t = setInterval(refresh, POLL_MS)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, refresh])

  // Add an app-generated (client-side) notification, e.g. cave activity.
  const pushLocal = useCallback((n) => {
    setLocal((prev) => {
      const item = {
        id: `local:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        source: 'local',
        read: false,
        createdAt: new Date().toISOString(),
        ...n,
      }
      // Avoid duplicates when the same event fires twice (StrictMode / re-renders).
      if (n.dedupeKey && prev.some((p) => p.dedupeKey === n.dedupeKey)) return prev
      return [item, ...prev].slice(0, 100)
    })
  }, [])

  const markAllRead = useCallback(async () => {
    setLocal((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })))
    setRemote((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })))
    if (remoteAvailable.current && userId) {
      try {
        await markAllReadRemote()
      } catch {
        // best-effort; UI already reflects read state
      }
    }
  }, [userId])

  const items = [...remote, ...local].sort(byNewest)
  const unread = items.reduce((n, i) => n + (i.read ? 0 : 1), 0)

  const value = { items, unread, refresh, markAllRead, pushLocal }

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (ctx === undefined) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}
