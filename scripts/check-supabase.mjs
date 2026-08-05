import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env', 'utf8')
const url = env.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
const key = env.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim()
const project = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

console.log(`Project: ${project || url}`)

const supabase = createClient(url, key)

const table = await supabase.from('profiles').select('id').limit(1)
console.log('profiles table:', table.error?.message || 'ok')

const rpc = await supabase.rpc('get_my_profile')
console.log('get_my_profile RPC:', rpc.error?.message || 'ok', rpc.error?.code || '')

const moodboards = await supabase.rpc('list_user_moodboards', {
  p_user: '00000000-0000-0000-0000-000000000000',
})
console.log('list_user_moodboards RPC:', moodboards.error?.message || 'ok', moodboards.error?.code || '')

const gallery = await supabase.rpc('list_profile_gallery', {
  p_user: '00000000-0000-0000-0000-000000000000',
})
console.log('list_profile_gallery RPC:', gallery.error?.message || 'ok', gallery.error?.code || '')

const cavePlaylists = await supabase.rpc('list_cave_playlists', { p_cave: 'test-cave' })
console.log('list_cave_playlists RPC:', cavePlaylists.error?.message || 'ok', cavePlaylists.error?.code || '')

const onboarding = await supabase.rpc('signup_gate_open')
console.log('signup_gate_open RPC:', onboarding.error?.message || 'ok', onboarding.error?.code || '')

const nameCheck = await supabase.rpc('check_fren_handle_available', { p_handle: 'test_fren_handle' })
console.log('check_fren_handle_available RPC:', nameCheck.error?.message || 'ok', nameCheck.error?.code || '')

const claimHandle = await supabase.rpc('claim_fren_handle', { p_handle: 'test', p_display_name: 'test' })
console.log('claim_fren_handle RPC:', claimHandle.error?.message || 'ok', claimHandle.error?.code || '')

const nameCheckLegacy = await supabase.rpc('check_fren_name_available', { p_name: 'test_fren_name' })
console.log('check_fren_name_available RPC:', nameCheckLegacy.error?.message || 'ok', nameCheckLegacy.error?.code || '')

const feedPosts = await supabase.rpc('list_feed_posts')
console.log('list_feed_posts RPC:', feedPosts.error?.message || 'ok', feedPosts.error?.code || '')

const showQuota = await supabase.rpc('get_show_to_frens_quota')
console.log('get_show_to_frens_quota RPC:', showQuota.error?.message || 'ok', showQuota.error?.code || '')

const moderation = await supabase.rpc('get_my_account_status')
console.log('get_my_account_status RPC:', moderation.error?.message || 'ok', moderation.error?.code || '')

const searchProfiles = await supabase.rpc('search_profiles', { p_query: 'test', p_limit: 1 })
console.log('search_profiles RPC:', searchProfiles.error?.message || 'ok', searchProfiles.error?.code || '')

const listReports = await supabase.rpc('list_platform_reports', { p_status: 'open' })
console.log('list_platform_reports RPC:', listReports.error?.message || 'ok', listReports.error?.code || '')

const dms = await supabase.rpc('list_my_dm_threads')
console.log('list_my_dm_threads RPC:', dms.error?.message || 'ok', dms.error?.code || '')

const caveCover = await supabase.rpc('set_cave_cover', { p_cave_id: 'test', p_cover_url: null })
console.log('set_cave_cover RPC:', caveCover.error?.message || 'ok', caveCover.error?.code || '')

const session = await supabase.auth.getSession()
console.log('browser session (cli):', session.data.session ? 'yes' : 'no')

if (rpc.error?.code === 'PGRST202' || table.error?.message?.includes('permission denied')) {
  console.log('\nFix: run supabase-fix-profile-permissions.sql in Supabase SQL Editor')
  console.log(`Make sure you are in project "${project}" matching your .env URL`)
  process.exit(1)
}

if (moodboards.error?.code === 'PGRST202') {
  console.log('\nGallery OK, but moodboards patch missing.')
  console.log('Fix: run supabase-patch-moodboards.sql in Supabase SQL Editor')
  console.log(`Make sure you are in project "${project}" matching your .env URL`)
  process.exit(1)
}

if (cavePlaylists.error?.code === 'PGRST202') {
  console.log('\nCave playlists patch missing.')
  console.log('Fix: run supabase-patch-cave-playlists.sql in Supabase SQL Editor')
  console.log('(Run after supabase-patch-playlists.sql and supabase-patch-cave-roles.sql)')
  console.log(`Make sure you are in project "${project}" matching your .env URL`)
  process.exit(1)
}

if (onboarding.error?.code === 'PGRST202') {
  console.log('\nOnboarding patch missing.')
  console.log('Fix: run supabase-patch-onboarding.sql in Supabase SQL Editor')
  console.log(`Make sure you are in project "${project}" matching your .env URL`)
  process.exit(1)
}

if (feedPosts.error?.code === 'PGRST202') {
  console.log('\nShow to frens patch missing.')
  console.log('Fix: run supabase-patch-show-to-frens.sql in Supabase SQL Editor')
  console.log(`Make sure you are in project "${project}" matching your .env URL`)
  process.exit(1)
}

if (showQuota.error?.code === 'PGRST202') {
  console.log('\nShow to frens quota patch missing.')
  console.log('Fix: run supabase-patch-show-to-frens-quota.sql in Supabase SQL Editor')
  console.log(`Make sure you are in project "${project}" matching your .env URL`)
  process.exit(1)
}

if (moderation.error?.code === 'PGRST202') {
  console.log('\nPlatform moderation patch missing.')
  console.log('Fix: run supabase-patch-platform-moderation.sql in Supabase SQL Editor')
  process.exit(1)
}

if (searchProfiles.error?.code === 'PGRST202') {
  console.log('\nPeople search patch missing.')
  console.log('Fix: run supabase-patch-search-profiles.sql in Supabase SQL Editor')
  process.exit(1)
}

if (dms.error?.code === 'PGRST202') {
  console.log('\nDMs patch missing.')
  console.log('Fix: run supabase-patch-dms.sql in Supabase SQL Editor')
  process.exit(1)
}

if (caveCover.error?.code === 'PGRST202') {
  console.log('\nCave cover patch missing.')
  console.log('Fix: run supabase-patch-cave-covers-fix.sql in Supabase SQL Editor')
  console.log(`Make sure you are in project "${project}" matching your .env URL`)
  process.exit(1)
}

console.log('\nDatabase setup looks OK from this machine.')
console.log('Beta 100: also run supabase-patch-beta-100-security.sql on production.')
console.log('Full checklist: BETA-100.md')
