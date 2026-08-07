import {
  GridIcon,
  ListIcon,
  OPTION_ACTIVE,
  OPTION_IDLE,
} from '../icons/UiIcons'

function viewBtnClass(active) {
  return `w-8 h-8 rounded-lg border inline-flex items-center justify-center transition ${
    active ? OPTION_ACTIVE : OPTION_IDLE
  }`
}

/** Compact board/list + sort row (kind filters live on My Echoes dropdown). */
export default function EchoMineToolbar({
  view,
  onViewChange,
  sortBy,
  onSortChange,
  hint = '',
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] frens-muted min-w-0 truncate">
        {hint}
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
  )
}
