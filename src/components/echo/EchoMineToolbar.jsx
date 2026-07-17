import {
  GridIcon,
  HeadphonesIcon,
  ImageIcon,
  ListIcon,
  OPTION_ACTIVE,
  OPTION_IDLE,
  VideoIcon,
} from '../icons/UiIcons'

export const MINE_KIND_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Meme', Icon: ImageIcon },
  { id: 'video', label: 'Video', Icon: VideoIcon },
  { id: 'audio', label: 'Audio', Icon: HeadphonesIcon },
]

function chipClass(active) {
  return `text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1 transition ${
    active ? OPTION_ACTIVE : OPTION_IDLE
  }`
}

function viewBtnClass(active) {
  return `w-8 h-8 rounded-lg border inline-flex items-center justify-center transition ${
    active ? OPTION_ACTIVE : OPTION_IDLE
  }`
}

export default function EchoMineToolbar({
  kindFilter,
  onKindFilterChange,
  view,
  onViewChange,
  sortBy,
  onSortChange,
  counts = {},
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {MINE_KIND_FILTERS.map(({ id, label, Icon }) => {
          const active = kindFilter === id
          const count = counts[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => onKindFilterChange(id)}
              className={chipClass(active)}
              aria-pressed={active}
            >
              {Icon ? <Icon className="w-3 h-3 shrink-0" /> : null}
              <span>{label}</span>
              {count != null && count > 0 ? (
                <span className="opacity-60 tabular-nums">{count}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] frens-muted min-w-0 truncate">
          Previews only you see · tap to show on map
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-0.5" role="group" aria-label="View layout">
            <button
              type="button"
              onClick={() => onViewChange('board')}
              className={viewBtnClass(view === 'board')}
              aria-label="Board view"
              aria-pressed={view === 'board'}
            >
              <GridIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewChange('list')}
              className={viewBtnClass(view === 'list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="frens-input py-1 px-2 text-xs w-auto"
            aria-label="Sort echoes"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="kind">By type</option>
          </select>
        </div>
      </div>
    </div>
  )
}
