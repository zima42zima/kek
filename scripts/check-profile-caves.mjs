/**
 * Check list_profile_caves RPC (anon — returns empty without real user ids).
 * Run: node scripts/check-profile-caves.mjs
 *
 * To debug a specific fren in Supabase SQL Editor (as postgres / service):
 *
 *   select id, silly_name, fren_handle from profiles
 *   where lower(coalesce(silly_name, '')) like '%zima%'
 *      or lower(coalesce(fren_handle, '')) like '%zima%';
 *
 *   select c.id, c.name, c.access, c.owner_id, cm.hidden_on_profile
 *   from public.caves c
 *   left join public.cave_members cm on cm.cave_id = c.id and cm.user_id = c.owner_id
 *   where c.owner_id = '<zima-uuid-here>';
 *
 *   select * from public.list_profile_caves('<zima-uuid-here>');
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env', 'utf8')
const url = env.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
const key = env.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim()

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key)
const project = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
console.log(`Project: ${project}`)

const rpc = await supabase.rpc('list_profile_caves', {
  p_user: '00000000-0000-0000-0000-000000000000',
})

if (rpc.error) {
  console.error('list_profile_caves MISSING or broken:', rpc.error.code, rpc.error.message)
  console.log('\nRun supabase-patch-profile-caves-public.sql in Supabase SQL Editor.')
  process.exit(1)
}

console.log('list_profile_caves RPC: ok (empty for dummy uuid is expected)')
console.log('\nIf a fren\'s caves show locally but not to others, check caves.access = public')
console.log('and hidden_on_profile = false for the owner in SQL Editor (see queries in this script).')
