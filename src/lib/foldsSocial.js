/**
 * FOLDS social layer — publish on profile, subscribe, peer send.
 * Send/inbox: Supabase when SQL is installed; localStorage only for same-browser fallback.
 */
import { supabase } from '../supabaseClient'
import { uploadMedia, StorageNotInstalledError } from './storage'
import { foldFormatById, countFilled, foldHasContent } from './foldFormats'

const publishedKey = (userId) => `misao-folds-published-${userId || 'anon'}`
const subsKey = (userId) => `misao-folds-subs-${userId || 'anon'}`
const inboxKey = (userId) => `misao-folds-inbox-${userId || 'anon'}`
const PUB_INDEX_KEY = 'misao-folds-pub-index-v1'

export class FoldsNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new FoldsNotInstalledError(error.message)
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    console.error('Folds storage full or blocked:', err?.message)
    return false
  }
}

/** Slim card for lists (no huge payloads). */
export function foldSummary(fold, ownerMeta = {}) {
  return {
    id: fold.id,
    formatId: fold.formatId,
    formatLabel: foldFormatById(fold.formatId)?.label || fold.formatId,
    title: fold.title || 'Untitled fold',
    filled: countFilled(fold),
    publishedAt: fold.publishedAt || fold.updatedAt || null,
    ownerId: fold.ownerId || ownerMeta.ownerId || null,
    ownerName: fold.ownerName || ownerMeta.ownerName || null,
  }
}

export function listPublishedFolds(userId) {
  if (!userId) return []
  const rows = readJson(publishedKey(userId), [])
  return Array.isArray(rows) ? rows : []
}

export function getPublishedFold(userId, foldId) {
  return listPublishedFolds(userId).find((f) => f.id === foldId) || null
}

function updatePubIndex(userId, ownerName, folds) {
  const index = readJson(PUB_INDEX_KEY, {})
  if (!folds?.length) {
    delete index[userId]
  } else {
    index[userId] = {
      count: folds.length,
      latestTitle: folds[0]?.title || 'Fold',
      ownerName: ownerName || index[userId]?.ownerName || 'a fren',
      updatedAt: new Date().toISOString(),
    }
  }
  writeJson(PUB_INDEX_KEY, index)
}

/**
 * Publish a fold draft to the creator's profile preview.
 * @returns {{ ok: boolean, message: string, fold?: object }}
 */
export function publishFold(userId, draft, { ownerName } = {}) {
  if (!userId) return { ok: false, message: 'Sign in to publish.' }
  if (!foldHasContent(draft)) return { ok: false, message: 'Add art before publishing.' }

  const published = {
    ...draft,
    ownerId: userId,
    ownerName: ownerName || draft.ownerName || 'a fren',
    published: true,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const list = listPublishedFolds(userId).filter((f) => f.id !== published.id)
  const next = [published, ...list].slice(0, 24)
  if (!writeJson(publishedKey(userId), next)) {
    return { ok: false, message: 'Storage full — try fewer or smaller images.' }
  }
  updatePubIndex(userId, ownerName, next)
  return { ok: true, message: 'Published on your profile.', fold: published }
}

export function unpublishFold(userId, foldId) {
  if (!userId || !foldId) return { ok: false, message: 'Nothing to unpublish.' }
  const next = listPublishedFolds(userId).filter((f) => f.id !== foldId)
  writeJson(publishedKey(userId), next)
  updatePubIndex(userId, next[0]?.ownerName, next)
  return { ok: true, message: 'Removed from profile.' }
}

export function isFoldPublished(userId, foldId) {
  return listPublishedFolds(userId).some((f) => f.id === foldId)
}

/** Subscribe to a creator's folds (profile updates / new issues). */
export function listFoldSubscriptions(viewerId) {
  if (!viewerId) return []
  const rows = readJson(subsKey(viewerId), [])
  return Array.isArray(rows) ? rows : []
}

export function isSubscribedToFolds(viewerId, creatorId) {
  if (!viewerId || !creatorId || viewerId === creatorId) return false
  return listFoldSubscriptions(viewerId).some((s) => s.creatorId === creatorId)
}

export function subscribeToFolds(viewerId, creator, { creatorName } = {}) {
  const creatorId = typeof creator === 'string' ? creator : creator?.userId || creator?.id
  if (!viewerId || !creatorId) return { ok: false, message: 'Could not subscribe.' }
  if (viewerId === creatorId) return { ok: false, message: 'That is your own fold shelf.' }

  const list = listFoldSubscriptions(viewerId).filter((s) => s.creatorId !== creatorId)
  list.unshift({
    creatorId,
    creatorName: creatorName || creator?.frenName || creator?.name || 'a fren',
    subscribedAt: new Date().toISOString(),
  })
  writeJson(subsKey(viewerId), list.slice(0, 100))
  return { ok: true, message: `Subscribed to ${creatorName || 'their'} folds.` }
}

export function unsubscribeFromFolds(viewerId, creatorId) {
  if (!viewerId || !creatorId) return { ok: false, message: 'Could not unsubscribe.' }
  const list = listFoldSubscriptions(viewerId).filter((s) => s.creatorId !== creatorId)
  writeJson(subsKey(viewerId), list)
  return { ok: true, message: 'Unsubscribed.' }
}

export function hasPublishedFolds(userId) {
  return listPublishedFolds(userId).length > 0
}

// ── Remote send / inbox ────────────────────────────────────────────────────

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

/** Prefer Storage URLs so payloads stay small enough for JSONB. */
async function prepareSlotForRemote(slot) {
  if (!slot) return null
  if (slot.kind === 'pdf') {
    // PDFs stay as data URL if small; otherwise leave as-is (recipient still gets it if under limit)
    return slot
  }
  if (slot.kind !== 'image' || !slot.dataUrl?.startsWith('data:')) {
    return slot
  }
  try {
    const blob = await dataUrlToBlob(slot.dataUrl)
    const url = await uploadMedia(blob, { prefix: 'folds' })
    return { kind: 'image', name: slot.name || 'image', dataUrl: url }
  } catch (err) {
    if (!(err instanceof StorageNotInstalledError)) {
      console.warn('Fold media upload failed, sending inline:', err?.message)
    }
    return slot
  }
}

async function prepareFoldPayload(fold) {
  const base = {
    id: fold.id,
    formatId: fold.formatId,
    title: fold.title || 'Untitled fold',
    fit: fold.fit || 'contain',
    margins: Boolean(fold.margins),
    ownerId: fold.ownerId || null,
    ownerName: fold.ownerName || null,
  }

  if (fold.formatId === 'zine') {
    const panels = {}
    for (const [key, slot] of Object.entries(fold.panels || {})) {
      panels[key] = await prepareSlotForRemote(slot)
    }
    return { ...base, panels }
  }

  const pages = []
  for (const slot of fold.pages || []) {
    pages.push(await prepareSlotForRemote(slot))
  }
  return { ...base, pages }
}

function mapRemoteInboxRow(row) {
  const payload = row.payload || {}
  return {
    id: row.id,
    fold: {
      id: payload.id || row.fold_id || row.id,
      formatId: payload.formatId || row.format_id || 'print',
      title: payload.title || row.title || 'Untitled fold',
      fit: payload.fit || 'contain',
      margins: Boolean(payload.margins),
      panels: payload.panels || undefined,
      pages: payload.pages || undefined,
      ownerId: payload.ownerId || row.from_user,
      ownerName: payload.ownerName || row.from_name || 'a fren',
    },
    fromUserId: row.from_user,
    fromName: row.from_name || 'a fren',
    note: row.note || '',
    sentAt: row.created_at,
    read: Boolean(row.read),
    remote: true,
  }
}

/**
 * Peer send via Supabase (real cross-device). Falls back to localStorage only if RPC missing
 * (same browser only — not useful across phones).
 */
export async function sendFoldToUser(fromUser, toUserId, fold, { note } = {}) {
  const fromId = fromUser?.id || fromUser?.userId
  if (!fromId || !toUserId || !fold) return { ok: false, message: 'Could not send.' }
  if (fromId === toUserId) return { ok: false, message: 'Send folds to another fren.' }
  if (!foldHasContent(fold)) return { ok: false, message: 'Empty fold.' }

  const foldWithOwner = {
    ...fold,
    ownerId: fold.ownerId || fromId,
    ownerName: fold.ownerName || fromUser?.frenName || 'a fren',
  }

  try {
    const payload = await prepareFoldPayload(foldWithOwner)
    const { data, error } = await supabase.rpc('send_fold', {
      p_to: toUserId,
      p_title: foldWithOwner.title || 'Untitled fold',
      p_format_id: foldWithOwner.formatId || 'print',
      p_payload: payload,
      p_note: note?.trim() || null,
      p_fold_id: foldWithOwner.id || null,
    })
    if (error) {
      throwIfNotInstalled(error)
      throw error
    }
    try {
      window.dispatchEvent(new CustomEvent('frens:notifications-refreshed'))
    } catch { /* ignore */ }
    return { ok: true, message: 'Fold sent.', deliveryId: data }
  } catch (err) {
    if (err instanceof FoldsNotInstalledError) {
      // Same-device fallback only
      const entry = {
        id: `recv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fold: foldWithOwner,
        fromUserId: fromId,
        fromName: fromUser?.frenName || 'a fren',
        note: note?.trim() || '',
        sentAt: new Date().toISOString(),
        read: false,
        remote: false,
      }
      const inbox = readJson(inboxKey(toUserId), [])
      if (!writeJson(inboxKey(toUserId), [entry, ...inbox].slice(0, 40))) {
        return {
          ok: false,
          message: 'Could not send — run supabase-patch-folds.sql in Supabase (and storage if images fail).',
        }
      }
      return {
        ok: true,
        message: 'Fold saved locally only — run supabase-patch-folds.sql so frens on other devices receive it.',
        localOnly: true,
      }
    }
    return { ok: false, message: err?.message || 'Could not send fold.' }
  }
}

/** Load inbox: remote first, merge local-only entries. */
export async function listFoldInbox(userId) {
  if (!userId) return []
  const local = readJson(inboxKey(userId), [])
  const localList = Array.isArray(local) ? local : []

  try {
    const { data, error } = await supabase.rpc('list_fold_inbox')
    if (error) {
      throwIfNotInstalled(error)
      throw error
    }
    const remote = (data ?? []).map(mapRemoteInboxRow)
    // Prefer remote; keep local-only entries not present remotely
    const remoteIds = new Set(remote.map((e) => e.id))
    const localOnly = localList.filter((e) => !e.remote && !remoteIds.has(e.id))
    return [...remote, ...localOnly]
  } catch (err) {
    if (!(err instanceof FoldsNotInstalledError)) {
      console.warn('list_fold_inbox failed:', err?.message)
    }
    return localList
  }
}

export async function markFoldInboxRead(userId, entryId) {
  if (!userId || !entryId) return

  // Local
  const rows = readJson(inboxKey(userId), [])
  if (Array.isArray(rows) && rows.some((e) => e.id === entryId)) {
    writeJson(
      inboxKey(userId),
      rows.map((e) => (e.id === entryId ? { ...e, read: true } : e)),
    )
  }

  // Remote (uuid-ish)
  if (String(entryId).includes('-') && !String(entryId).startsWith('recv-')) {
    try {
      const { error } = await supabase.rpc('mark_fold_delivery_read', { p_id: entryId })
      if (error) throwIfNotInstalled(error)
    } catch (err) {
      if (!(err instanceof FoldsNotInstalledError)) {
        console.warn('mark_fold_delivery_read failed:', err?.message)
      }
    }
  }
}

export async function foldInboxUnread(userId) {
  const list = await listFoldInbox(userId)
  return list.filter((e) => !e.read).length
}
