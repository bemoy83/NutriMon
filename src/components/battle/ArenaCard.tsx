import { ArenaProgressBar } from './ArenaProgressBar'
import type { ArenaListArena } from '@/types/domain'

/** Hardcoded terrain colour per arena_key — used as the left accent strip.
 *  Replace with a sampled colour once proper terrain assets exist for arena_2/3. */
const ARENA_ACCENT: Record<string, string> = {
  arena_1: '#4ade80',
  arena_2: '#f97316',
  arena_3: '#a78bfa',
}

function getAccent(arenaKey: string): string {
  return ARENA_ACCENT[arenaKey] ?? '#6b7280'
}

interface ArenaCardProps {
  arena: ArenaListArena
  onClick?: () => void
}

export function ArenaCard({ arena, onClick }: ArenaCardProps) {
  const accent = getAccent(arena.arenaKey)
  const isLocked = !arena.isUnlocked
  const levelRange =
    arena.opponentCount > 0
      ? `${arena.opponentCount} opponent${arena.opponentCount !== 1 ? 's' : ''}`
      : 'No opponents yet'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      className={`app-card w-full overflow-hidden text-left transition-opacity ${
        isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:opacity-80'
      }`}
    >
      <div className="flex items-stretch">
        {/* Terrain colour strip */}
        <div
          className="relative w-12 flex-shrink-0 flex items-center justify-center"
          style={{ background: accent }}
        >
          {isLocked ? (
            <svg
              className="w-5 h-5 text-white/80"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          ) : arena.hasActiveRun ? (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--app-warning)] animate-pulse" />
          ) : null}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-[var(--app-text-primary)] truncate">{arena.name}</p>
            {isLocked ? null : (
              <svg
                className="w-4 h-4 text-[var(--app-text-muted)] flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>

          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{levelRange}</p>

          <div className="mt-3">
            {isLocked ? (
              <p className="text-xs text-[var(--app-text-muted)]">
                {arena.unlockBossName
                  ? `Defeat ${arena.unlockBossName} to unlock`
                  : 'Locked'}
              </p>
            ) : (
              <ArenaProgressBar defeated={arena.defeatedCount} total={arena.opponentCount} />
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
