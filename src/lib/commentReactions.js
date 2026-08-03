import { normalizeEmojiReactions } from './emojiReactions'

/** Legacy text reactions — unused in UI; DB may still have old emoji keys. */
export const FREN_COMMENT_REACTION_DEFS = [
  { emoji: '😂', label: 'lol' },
  { emoji: '💚', label: 'heart' },
  { emoji: '🫂', label: 'hug' },
  { emoji: '✨', label: 'spark' },
  { emoji: '🗿', label: 'stone' },
]

export const FREN_COMMENT_REACTIONS = FREN_COMMENT_REACTION_DEFS.map((r) => r.emoji)

export function commentReactionLabel(emoji) {
  return FREN_COMMENT_REACTION_DEFS.find((r) => r.emoji === emoji)?.label || emoji
}

/** Comment reactions from DB — any emoji string. */
export function mapReactions(json) {
  return normalizeEmojiReactions(json)
}

/** One reaction per user per comment — toggle off, switch, or add. */
export function applyCommentReactionToggle(reactions, emoji) {
  const list = [...(reactions || [])]
  const existingMine = list.find((r) => r.mine)

  if (existingMine?.emoji === emoji) {
    const idx = list.findIndex((r) => r.emoji === emoji)
    const count = list[idx].count - 1
    if (count <= 0) list.splice(idx, 1)
    else list[idx] = { ...list[idx], count, mine: false }
    return list
  }

  if (existingMine) {
    const oldIdx = list.findIndex((r) => r.emoji === existingMine.emoji)
    if (oldIdx >= 0) {
      const count = list[oldIdx].count - 1
      if (count <= 0) list.splice(oldIdx, 1)
      else list[oldIdx] = { ...list[oldIdx], count, mine: false }
    }
  }

  const idx = list.findIndex((r) => r.emoji === emoji)
  if (idx >= 0) {
    list[idx] = { ...list[idx], count: list[idx].count + 1, mine: true }
  } else {
    list.push({ emoji, count: 1, mine: true })
  }

  return list
}
