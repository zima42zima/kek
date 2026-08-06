import { createClient } from '@supabase/supabase-js'
import { upsertProfileFields, claimFrenHandle, persistProfileAvatar } from './lib/profile'
import { retireMedia } from './lib/storage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env vars. Create a .env file (not .env.example) with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart npm run dev.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const PENDING_PROFILE_KEY = 'frens-pending-profile'
export const PENDING_INVITE_KEY = 'frens-pending-invite'
export const PENDING_BOOTSTRAP_KEY = 'frens-pending-bootstrap'

export async function saveFounderProfile(userId, profile, { isFounder = false } = {}) {
  let avatarType = profile?.avatarType === 'photo' && profile?.avatarPreview ? 'photo' : 'frog'
  let avatarUrl = null
  if (avatarType === 'photo' && profile?.avatarPreview) {
    const persisted = await persistProfileAvatar(profile.avatarPreview)
    avatarType = persisted.avatarType
    avatarUrl = persisted.avatarUrl
  }

  if (profile?.frenHandle) {
    await claimFrenHandle(userId, profile.frenHandle, profile.frenName || profile.frenHandle)
  }

  await upsertProfileFields(userId, {
    silly_name: profile?.frenName || profile?.frenHandle || 'nameless fren',
    one_human_thing: profile?.oneHumanThing || null,
    bio: profile?.bio || null,
    avatar_type: avatarType,
    avatar_url: avatarUrl,
    share_location: profile?.shareLocation ?? false,
    is_founder: Boolean(isFounder),
  })
}

export async function setPhotoAvatar(userId, sanitizedDataUrl) {
  const { data } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .maybeSingle()
  const previousUrl = data?.avatar_url || null
  const { avatarType, avatarUrl } = await persistProfileAvatar(sanitizedDataUrl)
  await upsertProfileFields(userId, { avatar_type: avatarType, avatar_url: avatarUrl })
  await retireMedia(previousUrl, avatarUrl)
}

export async function setFrogAvatar(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .maybeSingle()
  const previousUrl = data?.avatar_url || null
  await upsertProfileFields(userId, { avatar_type: 'frog', avatar_url: null })
  await retireMedia(previousUrl, null)
}
