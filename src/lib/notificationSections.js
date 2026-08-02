/**
 * Notification inbox sections — keeps direct vs space-based activity separate.
 *
 * Personal: attention on you and your content (feed, DMs, letters).
 * Community: shared spaces you opted into (caves, rabbit hole).
 * Places: location-based echo map activity.
 */

export const NOTIFICATION_SECTIONS = [
  {
    id: 'personal',
    label: 'Personal',
    hint: 'Follows, messages, aura, comments, and letters',
    types: new Set([
      'follow',
      'aura',
      'comment',
      'comment_reaction',
      'post_reaction',
      'mention',
      'dm',
      'owl_letter',
    ]),
  },
  {
    id: 'community',
    label: 'Community',
    hint: 'Caves and rabbit hole threads',
    types: new Set(['cave', 'cave_add', 'rabbit_reply', 'rabbit_follow']),
  },
  {
    id: 'places',
    label: 'Echo',
    hint: 'Nearby echoes, published spots, and friends-only drops',
    types: new Set(['echo', 'echo_follow', 'echo_published', 'echo_friends', 'echo_aura']),
  },
]

const TYPE_TO_SECTION = new Map()
for (const section of NOTIFICATION_SECTIONS) {
  for (const type of section.types) {
    TYPE_TO_SECTION.set(type, section.id)
  }
}

export function getNotificationSection(type) {
  return TYPE_TO_SECTION.get(type) || 'personal'
}

export function groupNotificationsBySection(items = []) {
  const groups = Object.fromEntries(NOTIFICATION_SECTIONS.map((s) => [s.id, []]))
  for (const item of items) {
    const sectionId = getNotificationSection(item.type)
    groups[sectionId].push(item)
  }
  return groups
}

export function unreadBySection(items = []) {
  const counts = Object.fromEntries(NOTIFICATION_SECTIONS.map((s) => [s.id, 0]))
  for (const item of items) {
    if (item.read) continue
    counts[getNotificationSection(item.type)] += 1
  }
  return counts
}

export function defaultNotificationSection(items = []) {
  const counts = unreadBySection(items)
  const withUnread = NOTIFICATION_SECTIONS.find((s) => counts[s.id] > 0)
  return withUnread?.id || 'personal'
}

export function sectionMeta(sectionId) {
  return NOTIFICATION_SECTIONS.find((s) => s.id === sectionId) || NOTIFICATION_SECTIONS[0]
}
