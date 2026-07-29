/** Fun cave titles — temporary, silly, human. Not corporate. */

export const DEFAULT_TITLE_ID = 'dweller'

/** Maps retired title ids still stored on members → current title. */
const LEGACY_TITLE_IDS = {
  frog_whisperer: 'vibe_curator',
  wisdom_frog: 'deep_cut_sage',
}

export const CAVE_FUN_TITLES = [
  { id: 'dweller', label: 'Cave Dweller', emoji: '🪨', weeks: null, blurb: 'Everyone starts here.' },
  { id: 'kek_keeper', label: 'Kek Keeper', emoji: '😂', weeks: 2, blurb: 'Protects the bit. Keeps the silly alive.' },
  { id: 'vibe_curator', label: 'Vibe Curator', emoji: '🌊', weeks: 2, blurb: 'Calms spirals and sets the mood.' },
  { id: 'meme_archivist', label: 'Meme Archivist', emoji: '🗂️', weeks: 4, blurb: "Saves the cave's greatest hits." },
  { id: 'link_sommelier', label: 'Link Sommelier', emoji: '🔗', weeks: 2, blurb: 'Finds the best URLs and rabbit holes.' },
  { id: 'hype_person', label: 'Hype Person', emoji: '📣', weeks: 2, blurb: 'Celebrates wins and good posts.' },
  { id: 'gentle_roaster', label: 'Gentle Roaster', emoji: '🔥', weeks: 2, blurb: 'Roasts with love, never mean.' },
  { id: 'chaos_coordinator', label: 'Chaos Coordinator', emoji: '🎉', weeks: 2, blurb: 'Starts the fun group chaos.' },
  { id: 'storyteller', label: 'Storyteller', emoji: '📖', weeks: 3, blurb: 'Shares lore, tales, and tangents.' },
  { id: 'seasonal_dj', label: 'Seasonal DJ', emoji: '🎧', weeks: 1, blurb: 'Curates cave playlists for the room.' },
  { id: 'deep_cut_sage', label: 'Deep Cut Sage', emoji: '💭', weeks: 2, blurb: 'Drops wisdom and deep recommendations.' },
  { id: 'hug_giver', label: 'Emergency Hug Giver', emoji: '🤗', weeks: 2, blurb: 'On call for bad days.' },
  { id: 'unga_bunga', label: 'Unga Bunga Champion', emoji: '🏆', weeks: 4, blurb: 'Peak silly human of the month.' },
]

export const MOD_ROLES = [
  { id: 'keeper', label: 'Cave Keeper', emoji: '🕯️', weeks: null, blurb: 'Pin, hide spam, assign titles.' },
  { id: 'co_keeper', label: 'Co-Keeper', emoji: '🪷', weeks: 1, blurb: 'Assistant mod — temporary.' },
]

const titleById = new Map(CAVE_FUN_TITLES.map((t) => [t.id, t]))
const modById = new Map(MOD_ROLES.map((t) => [t.id, t]))

function resolveTitleId(id) {
  return LEGACY_TITLE_IDS[id] || id
}

export function getFunTitle(id) {
  const resolved = resolveTitleId(id)
  return titleById.get(resolved) || titleById.get(DEFAULT_TITLE_ID)
}

export function getModRole(id) {
  return modById.get(id) || null
}

function isExpired(iso) {
  if (!iso) return false
  return new Date(iso).getTime() <= Date.now()
}

export function activeFunTitle(member) {
  const id = resolveTitleId(member?.funTitle || DEFAULT_TITLE_ID)
  if (id === DEFAULT_TITLE_ID) return getFunTitle(DEFAULT_TITLE_ID)
  if (isExpired(member?.titleExpiresAt)) return getFunTitle(DEFAULT_TITLE_ID)
  return getFunTitle(id)
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
  if (m.funTitle !== 'seasonal_dj' && resolveTitleId(m.funTitle) !== 'seasonal_dj') return false
  if (m.titleExpiresAt && new Date(m.titleExpiresAt).getTime() <= Date.now()) return false
  return true
}

/** Cave founder or active Seasonal DJ can manage cave playlists. */
export function canModerateCavePlaylists(cave, userId) {
  return isCaveDj(cave, userId)
}

export function memberById(cave, userId) {
  return cave?.members?.find((m) => m.id === userId) || null
}
