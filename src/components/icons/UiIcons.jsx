// Shared monochrome UI icons for MISAO. All use `currentColor`, so they inherit
// the surrounding text color (black in light mode, white in dark) and stay
// minimal + clean. Use these for buttons, toolbars, popups, etc. going forward.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
}

export function PaperclipIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

export function SendIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

export function CameraIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

export function SmileyIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  )
}

export function GifIcon({ className = 'w-5 h-4' }) {
  return (
    <svg
      viewBox="0 0 28 20"
      aria-hidden
      className={`inline-block align-middle ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1.5" y="2.5" width="25" height="15" rx="3" />
      <text
        x="14"
        y="14"
        textAnchor="middle"
        fontSize="8"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
        fontFamily="inherit"
      >
        GIF
      </text>
    </svg>
  )
}

export function MessageIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  )
}

export function PlusIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

/** Envelope with a small plus — new owl letter. */
export function EnvelopePlusIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
      <line x1="19" y1="2" x2="19" y2="6" />
      <line x1="17" y1="4" x2="21" y2="4" />
    </svg>
  )
}

export function PhoneIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

export function VideoCallIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

export function PinIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M12 17v5" />
      <path d="M5 7h14l-1 7H6L5 7z" />
      <path d="M9 2h6l1 5H8L9 2z" />
    </svg>
  )
}

export function MoreIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <circle cx="12" cy="5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function MapIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}

export function GlobeIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

export function SearchIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function LocationIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M12 21s-6-4.35-9.33-8.09C1.03 10.26 1.86 6.8 4.86 6.13c1.86-.42 3.63.52 4.64 2.02.36.54 1.64.54 2 0 1.01-1.5 2.78-2.44 4.64-2.02 3 .67 3.83 4.13 2.19 6.78C18.7 16.65 12 21 12 21z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function UsersIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

/** Person with plus — invite a fren. */
export function UserPlusIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  )
}

/** Pencil — edit profile. */
export function PencilIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

/** Gear — settings. */
export function SettingsIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

export function BookIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

export function HeadphonesIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  )
}

export function VideoIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

export function ImageIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

/** Aa — meme / caption text toggle */
export function TextIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M4 18 10 6h1l6 12" />
      <path d="M6.5 14h6" />
      <path d="M16 18v-5.5a2.5 2.5 0 0 1 5 0V18" />
      <path d="M16 15h5" />
    </svg>
  )
}

export function MicIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

export function PlayIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

export function PauseIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <line x1="10" y1="6" x2="10" y2="18" />
      <line x1="14" y1="6" x2="14" y2="18" />
    </svg>
  )
}

export function MusicNoteIcon({ className = 'w-4 h-4' }) {
  // Matches assets/icons/playlist.svg (RESOURCE FRENSAPP/playlist.svg)
  return (
    <svg
      viewBox="0 0 402 470"
      fill="currentColor"
      stroke="none"
      className={`inline-block shrink-0 align-middle ${className}`}
      aria-hidden
    >
      <path d="M80.3594 68.8919V386.333C71.6357 381.332 61.7458 378.725 51.6906 378.775C23.1087 378.775 0 399.017 0 423.95C0 448.883 23.1087 469.125 51.6906 469.125C80.2725 469.125 102.773 449.231 103.208 424.645V144.299L378.688 85.2244V329.43C369.526 324.141 359.122 321.383 348.542 321.438C319.266 321.438 295.462 341.679 295.462 366.613C295.462 391.546 319.266 411.788 348.542 411.788C377.819 411.788 401.189 391.98 401.623 367.394V0L80.3594 68.8919Z" />
    </svg>
  )
}

export function MusicAddIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <line x1="3" y1="6" x2="3" y2="10" />
      <line x1="1" y1="8" x2="5" y2="8" />
    </svg>
  )
}

export function LockIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function ShieldIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

/** Subtle report / flag mark. */
export function FlagIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

export function LinkIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

export function ShareIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export function MuteIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

/** Pass a post along to your frens — quiet curation, not a boost. */
export function ShowToFrensIcon({ className = 'w-4 h-4', active = false }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`inline-block shrink-0 align-middle transition ${className} ${active ? 'opacity-100' : 'opacity-70'}`}
      aria-hidden
    >
      <path
        fill={active ? '#0C0CFF' : 'currentColor'}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M32.2 11.6a26.4 26.4 0 1 1 0 52.8a26.4 26.4 0 1 1 0-52.8zm29.3 29.9a26.3 26.3 0 1 1 0 52.6a26.3 26.3 0 1 1 0-52.6z"
      />
    </svg>
  )
}

/** Icon-only post footer buttons — shared hit target (~20% under previous 28px). */
export const POST_ACTION_BTN =
  'relative z-10 flex items-center justify-center w-[22px] h-[22px] rounded-full frens-action hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition touch-manipulation shrink-0'

/** Shared glyph size for every post action icon (~20% under previous 16px → 13px). */
export const POST_ACTION_ICON = 'w-[13px] h-[13px]'

/** @deprecated use POST_ACTION_ICON — kept so older imports stay same size. */
export const POST_ACTION_REACTION_ICON = POST_ACTION_ICON

/** Count badge on post action buttons. */
export const POST_ACTION_BADGE =
  'absolute -top-0.5 -right-0.5 min-w-[12px] h-[12px] px-0.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-[8px] leading-none flex items-center justify-center tabular-nums'

/** Expanded reaction picker (fire/thunder menu). */
export const POST_ACTION_PICKER_BTN =
  'w-[26px] h-[26px] rounded-lg flex items-center justify-center transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'

export const POST_ACTION_PICKER_ICON = 'w-4 h-4 object-contain dark:invert'

/** Post action row — even gaps; share still uses ml-auto on its tip. */
export const POST_ACTION_ROW =
  'relative z-10 flex items-center gap-4 w-full mt-3'

/** Reusable selected-state classes for option pickers (no brand color). */
export const OPTION_ACTIVE =
  'border-black dark:border-white bg-black/[0.08] dark:bg-white/[0.12] ring-1 ring-black/15 dark:ring-white/20'
export const OPTION_IDLE =
  'frens-border bg-transparent [@media(hover:hover)]:hover:bg-black/[0.03] dark:[@media(hover:hover)]:hover:bg-white/[0.03]'

export function GridIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function ListIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={`inline-block align-middle ${className}`}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}
