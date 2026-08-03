/** Per-cave role catalog — examples by default, fully editable by keepers. Max 12. */

export const MAX_CAVE_ROLES = 12
export const DEFAULT_TITLE_ID = 'dweller'

/**
 * Six starter roles — Misao-flavored: presence over status, soft irony, 42-adjacent.
 * Caves can rename, re-emoji, or replace any of these.
 */
export const DEFAULT_CAVE_ROLES = [
  {
    id: 'dweller',
    label: 'Dweller',
    emoji: '🪨',
    markUrl: null,
    blurb: 'Everyone arrives as this. No rank, only presence.',
    weeks: null,
    canDj: false,
  },
  {
    id: 'witness_42',
    label: 'Witness of 42',
    emoji: '🌌',
    markUrl: null,
    blurb: 'Got the answer. Stayed for the silence after.',
    weeks: 4,
    canDj: false,
  },
  {
    id: 'soft_static',
    label: 'Soft Static',
    emoji: '📻',
    markUrl: null,
    blurb: 'Fills the quiet without filling the room.',
    weeks: 2,
    canDj: true,
  },
  {
    id: 'bit_archivist',
    label: 'Bit Archivist',
    emoji: '📼',
    markUrl: null,
    blurb: 'Treats the unserious like scripture.',
    weeks: 3,
    canDj: false,
  },
  {
    id: 'reckless_empath',
    label: 'Reckless Empath',
    emoji: '🫀',
    markUrl: null,
    blurb: 'Feels first. Posts second. Deletes never.',
    weeks: 2,
    canDj: false,
  },
  {
    id: 'plot_hole',
    label: 'Plot Hole',
    emoji: '🕳️',
    markUrl: null,
    blurb: 'Makes the story weirder — and somehow truer.',
    weeks: 2,
    canDj: false,
  },
]

/** Maps retired global title ids → default catalog ids. */
const LEGACY_TITLE_IDS = {
  frog_whisperer: 'soft_static',
  wisdom_frog: 'witness_42',
  kek_keeper: 'bit_archivist',
  vibe_curator: 'soft_static',
  meme_archivist: 'bit_archivist',
  link_sommelier: 'plot_hole',
  hype_person: 'reckless_empath',
  gentle_roaster: 'plot_hole',
  chaos_coordinator: 'plot_hole',
  storyteller: 'bit_archivist',
  seasonal_dj: 'soft_static',
  deep_cut_sage: 'witness_42',
  hug_giver: 'reckless_empath',
  unga_bunga: 'plot_hole',
  cave_dweller: 'dweller',
}

/** @deprecated use DEFAULT_CAVE_ROLES — kept for any leftover imports */
export const CAVE_FUN_TITLES = DEFAULT_CAVE_ROLES

export const MOD_ROLES = [
  { id: 'keeper', label: 'Cave Keeper', emoji: '🕯️', weeks: null, blurb: 'Pin, hide spam, edit roles, assign titles.' },
  { id: 'co_keeper', label: 'Co-Keeper', emoji: '🪷', weeks: 1, blurb: 'Assistant mod — temporary.' },
]

const modById = new Map(MOD_ROLES.map((t) => [t.id, t]))

function resolveTitleId(id) {
  return LEGACY_TITLE_IDS[id] || id || DEFAULT_TITLE_ID
}

function isExpired(iso) {
  if (!iso) return false
  return new Date(iso).getTime() <= Date.now()
}

export function newRoleId() {
  return `role_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function normalizeRole(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim() || newRoleId()
  const label = String(raw.label || '').trim().slice(0, 40) || 'Untitled role'
  const emoji = String(raw.emoji || '✦').trim().slice(0, 8) || '✦'
  const markUrl = raw.markUrl || raw.mark_url || null
  const blurb = String(raw.blurb || '').trim().slice(0, 160)
  const weeks = raw.weeks == null || raw.weeks === '' ? null : Number(raw.weeks)
  return {
    id,
    label,
    emoji,
    markUrl: typeof markUrl === 'string' && markUrl ? markUrl : null,
    blurb,
    weeks: Number.isFinite(weeks) && weeks > 0 ? weeks : null,
    canDj: Boolean(raw.canDj ?? raw.can_dj),
  }
}

/** Normalize a cave's role catalog (max 12). Empty/missing → defaults. */
export function normalizeCaveRoles(roles) {
  let list = Array.isArray(roles) ? roles.map(normalizeRole).filter(Boolean) : []
  if (list.length === 0) {
    list = DEFAULT_CAVE_ROLES.map((r) => ({ ...r }))
  }
  // Ensure default dweller exists
  if (!list.some((r) => r.id === DEFAULT_TITLE_ID)) {
    list = [{ ...DEFAULT_CAVE_ROLES[0] }, ...list].slice(0, MAX_CAVE_ROLES)
  }
  return list.slice(0, MAX_CAVE_ROLES)
}

export function getCaveRoles(cave) {
  return normalizeCaveRoles(cave?.roles)
}

export function getCaveRole(cave, roleId) {
  const id = resolveTitleId(roleId)
  const roles = getCaveRoles(cave)
  return roles.find((r) => r.id === id) || roles.find((r) => r.id === DEFAULT_TITLE_ID) || DEFAULT_CAVE_ROLES[0]
}

/** @deprecated prefer getCaveRole(cave, id) */
export function getFunTitle(id) {
  const resolved = resolveTitleId(id)
  return DEFAULT_CAVE_ROLES.find((t) => t.id === resolved) || DEFAULT_CAVE_ROLES[0]
}

export function getModRole(id) {
  return modById.get(id) || null
}

export function activeFunTitle(member, cave = null) {
  const id = resolveTitleId(member?.funTitle || DEFAULT_TITLE_ID)
  if (id === DEFAULT_TITLE_ID) {
    return cave ? getCaveRole(cave, DEFAULT_TITLE_ID) : getFunTitle(DEFAULT_TITLE_ID)
  }
  if (isExpired(member?.titleExpiresAt)) {
    return cave ? getCaveRole(cave, DEFAULT_TITLE_ID) : getFunTitle(DEFAULT_TITLE_ID)
  }
  return cave ? getCaveRole(cave, id) : getFunTitle(id)
}

export function activeModRole(member) {
  const id = member?.modRole
  if (!id) return null
  if (id === 'co_keeper' && isExpired(member?.modExpiresAt)) return null
  return getModRole(id)
}

export function isCaveKeeper(cave, userId) {
  if (!cave || !userId) return false
  if (cave.ownerId === userId) return true
  const m = cave.members?.find((x) => x.id === userId)
  if (!m) return false
  const mod = activeModRole(m)
  return mod?.id === 'keeper' || mod?.id === 'co_keeper'
}

export function isCaveOwner(cave, userId) {
  return cave?.ownerId === userId
}

export function isCaveDj(cave, userId) {
  if (!cave || !userId) return false
  if (cave.ownerId === userId) return true
  const m = memberById(cave, userId)
  if (!m) return false
  const role = activeFunTitle(m, cave)
  if (role?.canDj) {
    if (m.titleExpiresAt && isExpired(m.titleExpiresAt) && role.id !== DEFAULT_TITLE_ID) return false
    return true
  }
  // Legacy seasonal_dj title id
  const id = resolveTitleId(m.funTitle)
  if (id === 'seasonal_dj' || id === 'soft_static') {
    if (m.titleExpiresAt && isExpired(m.titleExpiresAt)) return false
    return id === 'seasonal_dj' || role?.canDj
  }
  return false
}

export function canModerateCavePlaylists(cave, userId) {
  return isCaveDj(cave, userId)
}

export function memberById(cave, userId) {
  return cave?.members?.find((m) => m.id === userId) || null
}

export function roleMark(role) {
  if (!role) return { emoji: '✦', markUrl: null }
  return { emoji: role.emoji || '✦', markUrl: role.markUrl || null }
}
