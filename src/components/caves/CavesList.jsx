import CaveIcon, { CaveGlyph } from './CaveIcon'

export default function CavesList({ caves, currentUserId, onOpenCave, onCreateClick }) {
  const isEmpty = caves.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="frens-title-xl flex items-center gap-2">
          <CaveIcon className="w-5 h-5" /> Caves
        </h2>
        {!isEmpty && (
          <button
            type="button"
            onClick={onCreateClick}
            className="frens-btn-outline px-3 py-1.5 text-xs"
          >
            + New cave
          </button>
        )}
      </div>

      {isEmpty ? (
        <button
          type="button"
          onClick={onCreateClick}
          className="w-full border-2 border-dashed frens-border rounded-2xl p-10 flex flex-col items-center gap-3 transition group"
        >
          <span className="w-16 h-16 rounded-full frens-avatar-ring flex items-center justify-center text-3xl group-hover:scale-105 transition">
            +
          </span>
          <span className="text-base frens-title">Create your first cave</span>
          <span className="text-xs frens-muted">
            a private room for you and your frens
          </span>
        </button>
      ) : (
        <ul className="space-y-3">
          {caves.map((cave) => {
            const isOwner = cave.ownerId === currentUserId
            return (
              <li key={cave.id}>
                <button
                  type="button"
                  onClick={() => onOpenCave(cave.id)}
                  className="w-full text-left border frens-border rounded-xl p-4 flex items-center gap-3 hover:frens-surface transition"
                >
                  <span className="w-12 h-12 shrink-0 rounded-xl frens-avatar-ring flex items-center justify-center text-xl">
                    <CaveGlyph className="w-6 h-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="frens-title-sm truncate">{cave.name}</span>
                      {isOwner && (
                        <span className="text-[10px] frens-muted border frens-border rounded-full px-2 py-0.5">
                          owner
                        </span>
                      )}
                    </span>
                    <span className="block text-xs frens-muted">
                      {cave.members.length} {cave.members.length === 1 ? 'fren' : 'frens'}
                      {cave.messages.length > 0 && (
                        <> · {cave.messages.length} messages</>
                      )}
                    </span>
                  </span>
                  <span className="frens-muted text-lg shrink-0">›</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
