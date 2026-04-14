import { getArenaTerrain } from '@/lib/sprites'
import { deriveTerrainGradient } from '@/lib/arenaTheme'
import type { ArenaListArena } from '@/types/domain'

interface ArenaCardProps {
  arena: ArenaListArena
  onClick?: () => void
}

export function ArenaCard({ arena, onClick }: ArenaCardProps) {
  const terrain = getArenaTerrain(arena.id)
  const accent = terrain.accentColor ?? '#6b7280'
  const gradient = deriveTerrainGradient(accent)
  const isLocked = !arena.isUnlocked
  const progressPct = arena.opponentCount > 0
    ? (arena.defeatedCount / arena.opponentCount) * 100
    : 0

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      style={{ '--arena-accent': accent } as React.CSSProperties}
      className={`relative w-full overflow-hidden rounded-2xl border border-white/15 ${
        isLocked
          ? 'cursor-not-allowed'
          : 'transition-transform active:scale-[0.985]'
      }`}
    >
      {/* Biome gradient fills the full card */}
      <div className="absolute inset-0" style={{ background: gradient }} />

      {/* Decorative platform PNG — floats bottom-right as atmosphere */}
      {terrain.opponentPlatformUrl && (
        <img
          src={terrain.opponentPlatformUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute bottom-0 right-0 pointer-events-none select-none sprite-pixel-art"
          style={{ width: '52%', opacity: 0.5 }}
        />
      )}

      {/* Bottom scrim so text is always legible over the gradient */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.62) 100%)' }}
      />

      {/* Complete badge — top-left corner */}
      {!isLocked && arena.defeatedCount > 0 && arena.defeatedCount === arena.opponentCount && (
        <span className="absolute top-3 left-3 z-10 rounded-full bg-[var(--app-success)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
          Complete
        </span>
      )}

      {/* Active run pulse — top-right corner */}
      {arena.hasActiveRun && !isLocked && (
        <span className="absolute top-3 right-3 z-10 h-2.5 w-2.5 rounded-full bg-[var(--app-warning)] animate-pulse" />
      )}

      {/* Card content — sits above scrim */}
      <div className="relative h-40 flex flex-col justify-end px-4 pb-4">
        <p className="text-white font-bold text-lg leading-tight drop-shadow-sm">
          {arena.name}
        </p>
        <p className="mt-1 text-white/65 text-xs">
          {arena.opponentCount} opponent{arena.opponentCount !== 1 ? 's' : ''}
          {!isLocked && ` · ${arena.defeatedCount}/${arena.opponentCount} defeated`}
        </p>

        {!isLocked && arena.opponentCount > 0 && (
          <div
            className="mt-2.5 h-1 w-full rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.22)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: 'rgba(255,255,255,0.80)' }}
            />
          </div>
        )}
      </div>

      {/* Locked overlay */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-2 px-6">
          <svg
            className="w-6 h-6 text-white/60"
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
          {arena.unlockBossName && (
            <p className="text-white/50 text-xs text-center">
              Defeat {arena.unlockBossName} to unlock
            </p>
          )}
        </div>
      )}
    </button>
  )
}
