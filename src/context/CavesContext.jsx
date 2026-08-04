import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { useNotifications } from './NotificationsContext'
import {
  listMyCavesRemote,
  listCaveMemberships,
  mergeCaveSnapshot,
  createCaveRemote,
  syncCaveRemote,
  sendCaveMessageRemote,
  setCaveCoverRemote,
  deleteCaveRemote,
  setCaveRolesRemote,
  setCaveProfileHidden,
  addCaveMember,
  assignCaveTitleRemote,
  assignCaveModRoleRemote,
  toggleCaveMessagePinRemote,
  hideCaveMessageRemote,
  deleteCaveMessageRemote,
  toggleCaveMessageReaction,
  applyReactionToggle,
  CavesNotInstalledError,
} from '../lib/caves'
import { DEFAULT_CAVE_ROLES, normalizeCaveRoles } from '../lib/caveRoles'

const CavesContext = createContext(undefined)

const SYNC_MS = 5000

function snapshotFromMembership(row, userId, profile) {
  const data = row.cave_data
  if (!data?.id) return null
  const members = [...(data.members || [])]
  if (userId && !members.some((m) => m.id === userId)) {
    members.push({
      id: userId,
      name: profile?.frenName || 'you',
      avatarType: profile?.avatarType || 'frog',
      avatarUrl: profile?.avatarUrl || null,
      role: 'member',
    })
  }
  return mergeCaveSnapshot(null, { ...data, members })
}

function storageKey(userId) {
  return `frens-caves-${userId || 'anon'}`
}

function loadLocal(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    const arr = raw ? JSON.parse(raw) : null
    return Array.isArray(arr) ? arr : null
  } catch {
    return null
  }
}

export function CavesProvider({ children }) {
  const { user, profile } = useAuth()
  const { pushLocal } = useNotifications()
  const meId = user?.id ?? 'me'
  const [caves, setCaves] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [remote, setRemote] = useState(true)
  const seenCountsRef = useRef({})
  const [pendingOpenId, setPendingOpenId] = useState(null)
  const [memberCaveIds, setMemberCaveIds] = useState(() => new Set())
  const profileRef = useRef(profile)
  profileRef.current = profile
  const membershipsRef = useRef([])
  const cavesRef = useRef(caves)
  cavesRef.current = caves

  const mergeRemoteCaves = useCallback((remoteCaves, accessibleIds) => {
    if (!remoteCaves?.length && !accessibleIds?.size) return
    setCaves((prev) => {
      const byId = new Map()
      prev
        .filter((c) => !accessibleIds || c.ownerId === meId || accessibleIds.has(c.id))
        .forEach((c) => byId.set(c.id, c))
      remoteCaves.forEach((r) => {
        if (!r?.id) return
        byId.set(r.id, mergeCaveSnapshot(byId.get(r.id), r))
      })
      return [...byId.values()]
    })
  }, [meId])

  const applyMembershipRows = useCallback((memberships) => {
    membershipsRef.current = memberships
    setMemberCaveIds(new Set(memberships.map((m) => m.cave_id)))
    if (!memberships.length) return []
    const uid = user?.id
    const p = profileRef.current
    return memberships
      .map((row) => snapshotFromMembership(row, uid, p))
      .filter(Boolean)
  }, [user?.id])

  const syncRemoteCaves = useCallback(async () => {
    if (!user?.id || !remote) return
    try {
      const [remoteRows, memberships] = await Promise.all([
        listMyCavesRemote().catch((err) => {
          if (err instanceof CavesNotInstalledError) throw err
          console.error('Could not list caves:', err.message)
          return []
        }),
        listCaveMemberships().catch((err) => {
          if (err instanceof CavesNotInstalledError) throw err
          return []
        }),
      ])

      const membershipSnapshots = applyMembershipRows(memberships)
      let rows = remoteRows

      if (rows.length === 0 && cavesRef.current.length > 0) {
        const owned = cavesRef.current.filter((c) => c.ownerId === meId)
        await Promise.all(owned.map((c) => syncCaveRemote(c).catch(() => {})))
        rows = await listMyCavesRemote()
      }

      const accessibleIds = new Set([
        ...memberships.map((m) => m.cave_id),
        ...rows.map((r) => r.id),
      ])

      const merged = []
      const byId = new Map()
      ;[...membershipSnapshots, ...rows].forEach((r) => {
        if (!r?.id) return
        byId.set(r.id, mergeCaveSnapshot(byId.get(r.id), r))
      })
      merged.push(...byId.values())

      if (merged.length || accessibleIds.size) {
        mergeRemoteCaves(merged, accessibleIds)
      } else if (accessibleIds.size === 0 && memberships.length === 0 && rows.length === 0) {
        setCaves((prev) => prev.filter((c) => c.ownerId === meId))
      }
    } catch (err) {
      if (err instanceof CavesNotInstalledError) {
        setRemote(false)
        try {
          const memberships = await listCaveMemberships()
          const snapshots = applyMembershipRows(memberships)
          const ids = new Set(memberships.map((m) => m.cave_id))
          if (snapshots.length) mergeRemoteCaves(snapshots, ids)
        } catch { /* membership fallback unavailable */ }
      } else {
        console.error('Could not sync caves:', err.message)
      }
    }
  }, [user?.id, meId, remote, mergeRemoteCaves, applyMembershipRows])

  // Load local cache first, then pull server caves + messages.
  useEffect(() => {
    const local = loadLocal(meId)
    setCaves(local ?? [])
    setLoaded(true)
    setRemote(true)
  }, [meId])

  useEffect(() => {
    if (!loaded || !user?.id) return
    syncRemoteCaves()
    const t = setInterval(syncRemoteCaves, SYNC_MS)
    const onFocus = () => syncRemoteCaves()
    const onNotifs = () => syncRemoteCaves()
    window.addEventListener('focus', onFocus)
    window.addEventListener('frens:notifications-refreshed', onNotifs)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('frens:notifications-refreshed', onNotifs)
    }
  }, [loaded, user?.id, syncRemoteCaves])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(storageKey(meId), JSON.stringify(caves))
    } catch { /* quota */ }
  }, [caves, loaded, meId])

  // Keep own member + message avatars in sync when profile photo changes.
  useEffect(() => {
    if (!meId || !profile) return
    const avatarType = profile.avatarType || 'frog'
    const avatarUrl = profile.avatarUrl || null
    setCaves((prev) => {
      let changed = false
      const next = prev.map((cave) => {
        let caveChanged = false
        const members = (cave.members || []).map((m) => {
          if (String(m.id) !== String(meId)) return m
          if (m.avatarType === avatarType && m.avatarUrl === avatarUrl) return m
          caveChanged = true
          return { ...m, avatarType, avatarUrl }
        })
        const messages = (cave.messages || []).map((m) => {
          if (String(m.authorId) !== String(meId)) return m
          if (m.avatarType === avatarType && m.avatarUrl === avatarUrl) return m
          caveChanged = true
          return { ...m, avatarType, avatarUrl }
        })
        if (!caveChanged) return cave
        changed = true
        return { ...cave, members, messages }
      })
      return changed ? next : prev
    })
  }, [meId, profile?.avatarType, profile?.avatarUrl])

  useEffect(() => {
    seenCountsRef.current = {}
  }, [meId])

  useEffect(() => {
    if (!loaded) return
    const seen = seenCountsRef.current
    caves.forEach((c) => {
      const msgs = c.messages || []
      const prevCount = seen[c.id]
      if (prevCount === undefined) {
        seen[c.id] = msgs.length
        return
      }
      if (msgs.length > prevCount) {
        msgs.slice(prevCount).forEach((m) => {
          if (m.authorId && m.authorId !== meId) {
            pushLocal({
              type: 'cave',
              caveId: c.id,
              actorName: m.authorName || 'a fren',
              actorAvatarType: m.avatarType || 'frog',
              actorAvatarUrl: m.avatarUrl || null,
              text: `posted in ${c.name}`,
              dedupeKey: `cave-msg:${c.id}:${m.id}`,
            })
          }
        })
      }
      seen[c.id] = msgs.length
    })
  }, [caves, loaded, meId, pushLocal])

  function createCave(name, { coverUrl = null } = {}) {
    const id = `cave-${Date.now()}`
    const p = profileRef.current
    const newCave = {
      id,
      name,
      emoji: '🕳️',
      ownerId: meId,
      banned: [],
      emojiPacks: [],
      hiddenOnProfile: false,
      access: 'invite',
      coverUrl: coverUrl || null,
      roles: DEFAULT_CAVE_ROLES.map((r) => ({ ...r })),
      members: [{
        id: meId,
        name: p?.frenName || 'you',
        avatarType: p?.avatarType || 'frog',
        avatarUrl: p?.avatarUrl || null,
        role: 'owner',
      }],
      messages: [],
    }
    setCaves((prev) => [newCave, ...prev])
    if (remote) {
      createCaveRemote(id, name)
        .then(async () => {
          await syncCaveRemote(newCave)
          if (coverUrl) {
            try {
              await setCaveCoverRemote(id, coverUrl)
            } catch { /* cover column/RPC optional until SQL patch */ }
          }
        })
        .catch((err) => {
          if (err instanceof CavesNotInstalledError) setRemote(false)
          else console.error('Could not create cave on server:', err.message)
        })
    }
    return id
  }

  async function setCaveCover(caveId, coverUrl) {
    updateCave(caveId, (c) => ({ ...c, coverUrl: coverUrl || null }))
    if (!remote) return { ok: true }
    try {
      await setCaveCoverRemote(caveId, coverUrl || null)
      return { ok: true }
    } catch (err) {
      if (err instanceof CavesNotInstalledError) {
        // Keep local cover even if RPC missing
        return { ok: true, localOnly: true }
      }
      console.error('Could not set cave cover:', err.message)
      return { ok: false, message: err.message || 'Could not save cover.' }
    }
  }

  async function deleteCave(caveId) {
    const cave = cavesRef.current.find((c) => c.id === caveId)
    if (!cave) return { ok: false, message: 'Cave not found.' }
    if (cave.ownerId !== meId) {
      return { ok: false, message: 'Only the owner can delete this cave.' }
    }

    // Optimistic remove from local state
    setCaves((prev) => prev.filter((c) => c.id !== caveId))

    if (!remote) return { ok: true }
    try {
      await deleteCaveRemote(caveId)
      window.dispatchEvent(new CustomEvent('frens:notifications-refreshed'))
      return { ok: true }
    } catch (err) {
      // Restore if server delete failed
      setCaves((prev) => {
        if (prev.some((c) => c.id === caveId)) return prev
        return [cave, ...prev]
      })
      if (err instanceof CavesNotInstalledError) {
        // Local-only delete succeeded; members won't get remote notifs
        setCaves((prev) => prev.filter((c) => c.id !== caveId))
        return {
          ok: true,
          localOnly: true,
          message: 'Cave removed here. Run supabase-patch-delete-cave.sql so members get notified.',
        }
      }
      console.error('Could not delete cave:', err.message)
      return { ok: false, message: err.message || 'Could not delete cave.' }
    }
  }

  function updateCave(caveId, updater) {
    let updated = null
    setCaves((prev) =>
      prev.map((c) => {
        if (c.id !== caveId) return c
        updated = updater(c)
        return updated
      }),
    )
    if (remote && updated) {
      syncCaveRemote(updated).catch((err) => {
        if (err instanceof CavesNotInstalledError) setRemote(false)
        else console.error('Could not sync cave:', err.message)
      })
    }
  }

  function setCaveHidden(caveId, hiddenOnProfile) {
    updateCave(caveId, (c) => {
      if (!hiddenOnProfile && c.access !== 'public') return c
      return { ...c, hiddenOnProfile }
    })
    if (remote) {
      setCaveProfileHidden(caveId, hiddenOnProfile).catch(() => { /* best-effort */ })
    }
  }

  function setCaveAccess(caveId, access) {
    updateCave(caveId, (c) => {
      const next = { ...c, access }
      if (access === 'invite') next.hiddenOnProfile = true
      return next
    })
    if (remote && access === 'invite') {
      setCaveProfileHidden(caveId, true).catch(() => { /* best-effort */ })
    }
  }

  async function inviteToCave(caveId, person) {
    const targetId = person.userId
    if (!targetId || targetId === meId) {
      return { ok: false, message: 'Cannot add yourself.' }
    }

    let nextCave = null
    setCaves((prev) =>
      prev.map((c) => {
        if (c.id !== caveId) return c
        if (c.members.some((m) => m.id === targetId)) return c
        nextCave = {
          ...c,
          banned: (c.banned || []).filter((id) => id !== targetId),
          members: [
            ...c.members,
            {
              id: targetId,
              name: person.frenName || 'a fren',
              avatarType: person.avatarType || 'frog',
              avatarUrl: person.avatarUrl || null,
              role: 'member',
            },
          ],
        }
        return nextCave
      }),
    )

    if (!nextCave) {
      return { ok: false, message: `${person.frenName || 'This fren'} is already in the cave.` }
    }

    try {
      await syncCaveRemote(nextCave)
      await addCaveMember(targetId, nextCave)
      setRemote(true)
      await syncRemoteCaves()
      window.dispatchEvent(new CustomEvent('frens:notifications-refreshed'))
      return { ok: true, message: `${person.frenName} was added and notified.` }
    } catch (err) {
      setCaves((prev) =>
        prev.map((c) =>
          c.id !== caveId
            ? c
            : { ...c, members: c.members.filter((m) => m.id !== targetId) },
        ),
      )
      const message = err instanceof CavesNotInstalledError
        ? 'Adding members needs the latest database update — run supabase-patch-cave-members.sql in Supabase.'
        : (err.message || 'Could not add member.')
      console.error('inviteToCave failed:', message)
      return { ok: false, message }
    }
  }

  async function reactToCaveMessage(caveId, messageId, emoji) {
    const em = (emoji || '').trim()
    if (!em || messageId == null) return
    if (String(messageId).startsWith('tmp-')) return
    const mid = String(messageId)

    let prevReactions = []
    setCaves((prev) =>
      prev.map((c) => {
        if (c.id !== caveId) return c
        return {
          ...c,
          messages: (c.messages || []).map((m) => {
            if (String(m.id) !== mid) return m
            prevReactions = Array.isArray(m.reactions) ? m.reactions : []
            return { ...m, reactions: applyReactionToggle(prevReactions, em) }
          }),
        }
      }),
    )

    if (!remote) return
    try {
      const reactions = await toggleCaveMessageReaction(messageId, caveId, em)
      setCaves((prev) =>
        prev.map((c) =>
          c.id !== caveId
            ? c
            : {
                ...c,
                messages: (c.messages || []).map((m) =>
                  String(m.id) === mid
                    ? { ...m, reactions: Array.isArray(reactions) ? reactions : [] }
                    : m,
                ),
              },
        ),
      )
    } catch (err) {
      setCaves((prev) =>
        prev.map((c) =>
          c.id !== caveId
            ? c
            : {
                ...c,
                messages: (c.messages || []).map((m) =>
                  String(m.id) === mid ? { ...m, reactions: prevReactions } : m,
                ),
              },
        ),
      )
      if (!(err instanceof CavesNotInstalledError)) {
        console.error('Could not react to cave message:', err.message)
      }
    }
  }

  function patchMember(caveId, targetId, patch) {
    setCaves((prev) =>
      prev.map((c) =>
        c.id !== caveId
          ? c
          : {
              ...c,
              members: (c.members || []).map((m) =>
                m.id === targetId ? { ...m, ...patch } : m,
              ),
            },
      ),
    )
  }

  async function assignCaveTitle(caveId, targetId, titleId, weeks = 2) {
    const expiresAt = titleId === 'dweller' || !weeks
      ? null
      : new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString()
    patchMember(caveId, targetId, { funTitle: titleId, titleExpiresAt: expiresAt })
    if (!remote) return { ok: true }
    try {
      await assignCaveTitleRemote(caveId, targetId, titleId, weeks)
      await syncRemoteCaves()
      return { ok: true }
    } catch (err) {
      await syncRemoteCaves()
      const message = err instanceof CavesNotInstalledError
        ? 'Roles need supabase-patch-cave-roles.sql in Supabase.'
        : (err.message || 'Could not assign title.')
      return { ok: false, message }
    }
  }

  async function setCaveRoles(caveId, rolesInput) {
    const roles = normalizeCaveRoles(rolesInput)
    updateCave(caveId, (c) => ({ ...c, roles }))
    if (!remote) return { ok: true }
    try {
      await setCaveRolesRemote(caveId, roles)
      // Also push full cave so sync_cave keeps roles if set_cave_roles missing older columns
      const cave = cavesRef.current.find((c) => c.id === caveId)
      if (cave) await syncCaveRemote({ ...cave, roles }).catch(() => {})
      return { ok: true }
    } catch (err) {
      if (err instanceof CavesNotInstalledError) {
        return { ok: true, localOnly: true }
      }
      console.error('Could not save cave roles:', err.message)
      return { ok: false, message: err.message || 'Could not save roles.' }
    }
  }

  async function assignCaveModRole(caveId, targetId, modRole, weeks = 1) {
    const modExpiresAt = !modRole || modRole === 'keeper'
      ? null
      : new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString()
    patchMember(caveId, targetId, { modRole: modRole || null, modExpiresAt })
    if (!remote) return { ok: true }
    try {
      await assignCaveModRoleRemote(caveId, targetId, modRole, weeks)
      await syncRemoteCaves()
      return { ok: true }
    } catch (err) {
      await syncRemoteCaves()
      const message = err instanceof CavesNotInstalledError
        ? 'Mod roles need supabase-patch-cave-roles.sql in Supabase.'
        : (err.message || 'Could not assign mod role.')
      return { ok: false, message }
    }
  }

  async function pinCaveMessage(caveId, messageId) {
    if (messageId == null || String(messageId).startsWith('tmp-')) return
    let nextPinned = false
    setCaves((prev) =>
      prev.map((c) => {
        if (c.id !== caveId) return c
        return {
          ...c,
          messages: (c.messages || []).map((m) => {
            if (m.id !== messageId) return m
            nextPinned = !m.pinned
            return { ...m, pinned: nextPinned }
          }),
        }
      }),
    )
    if (!remote) return
    try {
      nextPinned = await toggleCaveMessagePinRemote(caveId, messageId)
      setCaves((prev) =>
        prev.map((c) =>
          c.id !== caveId
            ? c
            : {
                ...c,
                messages: (c.messages || []).map((m) =>
                  m.id === messageId ? { ...m, pinned: nextPinned } : m,
                ),
              },
        ),
      )
    } catch (err) {
      await syncRemoteCaves()
      if (!(err instanceof CavesNotInstalledError)) {
        console.error('Could not pin message:', err.message)
      }
    }
  }

  async function hideCaveMessage(caveId, messageId) {
    if (messageId == null || String(messageId).startsWith('tmp-')) return
    setCaves((prev) =>
      prev.map((c) =>
        c.id !== caveId
          ? c
          : {
              ...c,
              messages: (c.messages || []).map((m) =>
                m.id === messageId ? { ...m, hidden: true } : m,
              ),
            },
      ),
    )
    if (!remote) return
    try {
      await hideCaveMessageRemote(caveId, messageId)
      await syncRemoteCaves()
    } catch (err) {
      await syncRemoteCaves()
      if (!(err instanceof CavesNotInstalledError)) {
        console.error('Could not hide message:', err.message)
      }
    }
  }

  async function deleteCaveMessage(caveId, messageId) {
    if (messageId == null) return
    const id = String(messageId)
    let snapshot = null
    setCaves((prev) =>
      prev.map((c) => {
        if (c.id !== caveId) return c
        snapshot = c.messages || []
        return {
          ...c,
          messages: (c.messages || []).filter((m) => String(m.id) !== id),
        }
      }),
    )
    if (id.startsWith('tmp-') || !remote) return
    try {
      await deleteCaveMessageRemote(caveId, messageId)
      await syncRemoteCaves()
    } catch (err) {
      if (snapshot) {
        setCaves((prev) =>
          prev.map((c) => (c.id === caveId ? { ...c, messages: snapshot } : c)),
        )
      }
      if (!(err instanceof CavesNotInstalledError)) {
        console.error('Could not delete message:', err.message)
      }
    }
  }

  async function sendCaveMessage(caveId, fields, author) {
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const parentId = fields.parentId ?? fields.replyToId ?? null
    const replyPreview = fields.replyPreview
      || (parentId && fields.replyToName
        ? { authorName: fields.replyToName, text: fields.replyToText || '' }
        : null)
    const optimistic = {
      id: tmpId,
      ts: 'just now',
      authorId: author.authorId,
      authorName: author.authorName,
      avatarType: author.avatarType,
      avatarUrl: author.avatarUrl,
      reactions: [],
      parentId,
      replyPreview,
      text: fields.text,
      image: fields.image,
      sticker: fields.sticker,
    }
    setCaves((prev) =>
      prev.map((c) =>
        c.id === caveId ? { ...c, messages: [...(c.messages || []), optimistic] } : c,
      ),
    )
    if (!remote) return
    try {
      const mid = await sendCaveMessageRemote(caveId, {
        text: fields.text,
        image: fields.image,
        sticker: fields.sticker,
        authorName: author.authorName,
        avatarType: author.avatarType,
        avatarUrl: author.avatarUrl,
        parentId,
      })
      // Promote optimistic row to real id so sync merge won't leave a duplicate.
      if (mid != null) {
        setCaves((prev) =>
          prev.map((c) => {
            if (c.id !== caveId) return c
            return {
              ...c,
              messages: (c.messages || []).map((m) =>
                m.id === tmpId ? { ...m, id: mid } : m,
              ),
            }
          }),
        )
      } else {
        setCaves((prev) =>
          prev.map((c) => {
            if (c.id !== caveId) return c
            return {
              ...c,
              messages: (c.messages || []).filter((m) => m.id !== tmpId),
            }
          }),
        )
      }
      await syncRemoteCaves()
    } catch (err) {
      // Roll back optimistic bubble on failure
      setCaves((prev) =>
        prev.map((c) => {
          if (c.id !== caveId) return c
          return {
            ...c,
            messages: (c.messages || []).filter((m) => m.id !== tmpId),
          }
        }),
      )
      if (err instanceof CavesNotInstalledError) setRemote(false)
      else console.error('Could not send cave message:', err.message)
    }
  }

  function requestOpenCave(caveId) {
    setPendingOpenId(caveId)
  }

  async function joinCaveFromInvite(caveId) {
    await syncRemoteCaves()
    const row = membershipsRef.current.find((m) => m.cave_id === caveId)
    if (row?.cave_data) {
      const merged = snapshotFromMembership(row, user?.id, profileRef.current)
      if (merged) {
        setCaves((prev) => {
          const existing = prev.find((c) => c.id === caveId)
          if (existing) return prev.map((c) => (c.id === caveId ? mergeCaveSnapshot(c, merged) : c))
          return [merged, ...prev]
        })
      }
    }
    requestOpenCave(caveId)
  }

  function clearPendingOpen() {
    setPendingOpenId(null)
  }

  const myCaves = caves.filter(
    (c) =>
      c.ownerId === meId
      || c.members?.some((m) => m.id === meId)
      || memberCaveIds.has(c.id),
  )

  const value = {
    caves,
    myCaves,
    meId,
    remote,
    createCave,
    updateCave,
    setCaveCover,
    setCaveRoles,
    deleteCave,
    setCaveHidden,
    setCaveAccess,
    inviteToCave,
    reactToCaveMessage,
    assignCaveTitle,
    assignCaveModRole,
    pinCaveMessage,
    hideCaveMessage,
    deleteCaveMessage,
    sendCaveMessage,
    pendingOpenId,
    requestOpenCave,
    joinCaveFromInvite,
    syncMemberships: syncRemoteCaves,
    syncRemoteCaves,
    clearPendingOpen,
  }

  return <CavesContext.Provider value={value}>{children}</CavesContext.Provider>
}

export function useCaves() {
  const ctx = useContext(CavesContext)
  if (ctx === undefined) throw new Error('useCaves must be used inside CavesProvider')
  return ctx
}
