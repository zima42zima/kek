import fireIcon from '../assets/icons/reactions/fire.png'
import thunderIcon from '../assets/icons/reactions/thunder.png'
import hearthIcon from '../assets/icons/reactions/hearth.svg'
import lolIcon from '../assets/icons/reactions/lol.svg'

export const POST_REACTION_DEFS = [
  { id: 'fire', icon: fireIcon },
  { id: 'thunder', icon: thunderIcon },
  { id: 'hearth', icon: hearthIcon },
  { id: 'lol', icon: lolIcon },
]

const ALLOWED_REACTION_IDS = new Set(POST_REACTION_DEFS.map((d) => d.id))

export function postReactionDef(id) {
  return POST_REACTION_DEFS.find((d) => d.id === id)
}

/** DB comments use `emoji`; posts use `id` — normalize to `{ id, count, mine }`. */
export function normalizeReactions(reactions) {
  let list = reactions
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  return list
    .map((r) => ({
      id: String(r.id ?? r.emoji ?? ''),
      count: Number(r.count ?? 0),
      mine: Boolean(r.mine),
    }))
    .filter((r) => ALLOWED_REACTION_IDS.has(r.id))
}

export function reactionCount(reactions, id) {
  return reactions?.find((r) => r.id === id)?.count ?? 0
}

export function reactionMine(reactions, id) {
  return Boolean(reactions?.find((r) => r.id === id)?.mine)
}

/** One reaction per user per post — toggle off, switch, or add. */
export function applyPostReactionToggle(reactions, id) {
  const list = [...(reactions || [])]
  const existingMine = list.find((r) => r.mine)

  if (existingMine?.id === id) {
    const idx = list.findIndex((r) => r.id === id)
    const count = list[idx].count - 1
    if (count <= 0) list.splice(idx, 1)
    else list[idx] = { ...list[idx], count, mine: false }
    return list
  }

  if (existingMine) {
    const oldIdx = list.findIndex((r) => r.id === existingMine.id)
    if (oldIdx >= 0) {
      const count = list[oldIdx].count - 1
      if (count <= 0) list.splice(oldIdx, 1)
      else list[oldIdx] = { ...list[oldIdx], count, mine: false }
    }
  }

  const idx = list.findIndex((r) => r.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], count: list[idx].count + 1, mine: true }
  } else {
    list.push({ id, count: 1, mine: true })
  }

  return list
}
