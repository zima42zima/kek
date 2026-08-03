import { supabase } from '../supabaseClient'
import { normalizeCosmosProfileUrl, cosmosProfileLabel } from '../lib/galleryResolve'
import { LinkIcon } from './icons/UiIcons'

export function CosmosProfileLink({ url }) {
  if (!url) return null
  const label = cosmosProfileLabel(url)
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm frens-muted hover:underline mt-2"
    >
      <LinkIcon className="w-4 h-4 shrink-0" />
      <span>{label || 'cosmos.so'}</span>
      <span className="frens-muted text-xs">on Cosmos</span>
    </a>
  )
}

export async function saveCosmosProfileUrl(userId, input) {
  const cosmosUrl = input?.trim() ? normalizeCosmosProfileUrl(input) : null
  const { error } = await supabase
    .from('profiles')
    .update({ cosmos_url: cosmosUrl })
    .eq('id', userId)
  if (error) {
    if (error.code === '42703' || /cosmos_url/i.test(error.message || '')) {
      throw new Error('Run supabase-patch-profile-gallery.sql in Supabase SQL Editor.')
    }
    throw error
  }
  return cosmosUrl
}
