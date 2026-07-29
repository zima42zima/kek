/** Free-form emoji reactions — used on DMs, cave chat, comments (not home feed posts). */

export function normalizeEmojiReactions(raw) {
  if (!raw) return []
  let arr = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map((r) => ({
      emoji: String(r.emoji ?? r.id ?? '').trim(),
      count: Number(r.count ?? 0),
      mine: Boolean(r.mine),
    }))
    .filter((r) => r.emoji && r.count > 0)
}

/** Toggle one emoji on/off (cave chat, DMs — multiple emojis per user). */
export function applyEmojiReactionToggle(reactions, emoji) {
  const em = (emoji || '').trim()
  if (!em) return reactions || []
  const list = [...(reactions || [])]
  const idx = list.findIndex((r) => r.emoji === em)
  if (idx >= 0) {
    const row = list[idx]
    if (row.mine) {
      const count = row.count - 1
      if (count <= 0) list.splice(idx, 1)
      else list[idx] = { ...row, count, mine: false }
    } else {
      list[idx] = { ...row, count: row.count + 1, mine: true }
    }
  } else {
    list.push({ emoji: em, count: 1, mine: true })
  }
  return list
}
