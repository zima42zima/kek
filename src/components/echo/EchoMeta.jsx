import AudienceIcon from '../AudienceIcon'
import EchoIcon from './EchoIcon'
import { ECHO_PUBLIC_VISIBILITIES } from '../../lib/echoConstants'
import { formatRangeM } from '../../lib/echoRange'
import {
  BookIcon,
  HeadphonesIcon,
  ImageIcon,
  LocationIcon,
  UsersIcon,
  VideoIcon,
} from '../icons/UiIcons'

export function echoKindText(kind, { short = false } = {}) {
  if (kind === 'video') return short ? 'short video' : 'video'
  if (kind === 'image') return short ? 'meme' : 'meme spot'
  return short ? 'audio' : 'voice'
}

export function echoVisibilityText(visibility) {
  if (visibility === 'private') return 'memory'
  if (visibility === 'friends') return 'friends'
  return 'world'
}

export function echoVisibilitySummary(visibility) {
  if (visibility === 'private') return 'private archive'
  if (visibility === 'friends') return 'friends only'
  return 'public map + your archive'
}

export function EchoTypeIcon({ kind, className = 'w-4 h-4' }) {
  if (kind === 'video') return <VideoIcon className={className} />
  if (kind === 'image') return <ImageIcon className={className} />
  return <HeadphonesIcon className={className} />
}

export function EchoVisibilityIcon({ visibility, className = 'w-4 h-4' }) {
  if (visibility === 'private') return <BookIcon className={className} />
  if (visibility === 'friends') return <UsersIcon className={className} />
  return <AudienceIcon id="everyone" className={className} />
}

const META_ICON = 'w-3 h-3 shrink-0'

function MetaDot() {
  return (
    <span aria-hidden className="opacity-50 leading-none select-none shrink-0">
      ·
    </span>
  )
}

export function EchoKindLabel({ kind, short = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 leading-none ${className}`}>
      <EchoTypeIcon kind={kind} className={META_ICON} />
      <span>{echoKindText(kind, { short })}</span>
    </span>
  )
}

export function EchoVisibilityLabel({ visibility, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 leading-none ${className}`}>
      <span className="inline-flex items-center justify-center w-3 h-3 shrink-0">
        <EchoVisibilityIcon visibility={visibility} className={META_ICON} />
      </span>
      <span>{echoVisibilityText(visibility)}</span>
    </span>
  )
}

export function EchoSpatialLabel({ tier, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 leading-none ${className}`}>
      <LocationIcon className={META_ICON} />
      <span>{tier || 'spatial'}</span>
    </span>
  )
}

export function EchoMetaLine({
  kind,
  visibility,
  spatial,
  sense,
  discoverRadiusM = null,
  className = '',
}) {
  const showDiscover =
    discoverRadiusM != null && ECHO_PUBLIC_VISIBILITIES.has(visibility)

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-none ${className}`}
    >
      <EchoKindLabel kind={kind} short />
      <MetaDot />
      <EchoVisibilityLabel visibility={visibility} />
      {spatial ? (
        <>
          <MetaDot />
          <EchoSpatialLabel tier={spatial} />
        </>
      ) : null}
      {sense ? (
        <>
          <MetaDot />
          <span>{sense}</span>
        </>
      ) : null}
      {showDiscover ? (
        <>
          <MetaDot />
          <span className="whitespace-nowrap">{formatRangeM(discoverRadiusM)} discover</span>
        </>
      ) : null}
    </span>
  )
}

export function EchoBrandIcon({ className = 'w-5 h-4' }) {
  return <EchoIcon className={className} />
}
