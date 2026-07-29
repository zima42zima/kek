export const RABBIT_RULES = [
  'Be human — real takes welcome, cruelty is not.',
  'No harassment, hate, or non-consensual content.',
  'Memes, debates, weird curiosities — all fair game.',
  'Founders can hide or pin topics to keep the burrow cozy.',
]

export const RABBIT_TAGS = [
  { id: 'memes', label: 'Memes' },
  { id: 'debate', label: 'Debate' },
  { id: 'weird', label: 'Weird' },
  { id: 'questions', label: 'Questions' },
  { id: 'vibes', label: 'Vibes' },
]

export const RABBIT_SORTS = [
  { id: 'active', label: 'Active' },
  { id: 'new', label: 'New' },
  { id: 'hot', label: 'Hot' },
]

export function rabbitTagLabel(id) {
  return RABBIT_TAGS.find((t) => t.id === id)?.label || id
}

export function rabbitTagEmoji() {
  return ''
}

export function displayAuthor(item, viewerId, isMod) {
  if (!item.anonymous || item.userId === viewerId || isMod) {
    return {
      frenName: item.frenName,
      avatarType: item.avatarType,
      avatarUrl: item.avatarUrl,
    }
  }
  return { frenName: 'anonymous fren', avatarType: 'frog', avatarUrl: null }
}
