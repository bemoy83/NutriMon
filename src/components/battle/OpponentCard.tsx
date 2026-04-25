import { getOpponentSpriteDescriptor } from '@/lib/sprites'
import type { BattleOpponent } from '@/types/domain'

function formatDefeatedVictorySummary(opponent: BattleOpponent): string | null {
  if (opponent.rewardedWinTurnCount == null) return null
  const hp = opponent.rewardedWinRemainingHpPct ?? 0
  const xp = opponent.rewardedWinXpAwarded ?? 0
  return `${opponent.rewardedWinTurnCount} turns | HP ${hp}% | XP ${xp}`
}

export interface OpponentCardProps {
  opponent: BattleOpponent
  isActive: boolean
  isStarting: boolean
  isDisabled: boolean
  onChallenge: (opponent: BattleOpponent) => void
}

export function OpponentCard({
  opponent,
  isActive,
  isStarting,
  isDisabled,
  onChallenge,
}: OpponentCardProps) {
  const isLockedByProgression = !opponent.isChallengeable
  const victorySummary = opponent.isDefeated ? formatDefeatedVictorySummary(opponent) : null
  const oppSprite = getOpponentSpriteDescriptor(opponent.name)

  const buttonLabel = isActive
    ? 'Resume'
    : isLockedByProgression
      ? 'Locked'
      : isStarting
        ? 'Starting…'
        : 'Challenge'

  const spriteFilter =
    opponent.isDefeated || isActive
      ? 'none'
      : isLockedByProgression
        ? 'brightness(0) opacity(0.25)'
        : 'brightness(0) opacity(0.35)'

  return (
    <div
      className="px-4 py-3.5 transition-colors"
      style={
        isActive
          ? {
              boxShadow: 'inset 3px 0 0 var(--app-warning)',
              background: 'var(--app-warning-soft)',
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        {oppSprite ? (
          <img
            src={oppSprite.url}
            alt=""
            aria-hidden="true"
            className="sprite-pixel-art mt-0.5 flex-shrink-0"
            style={{ width: 40, height: 40, filter: spriteFilter }}
          />
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--app-text-primary)]">{opponent.name}</p>
            {opponent.isArenaBoss ? (
              <span className="rounded-full bg-[var(--app-warning-soft)] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-warning)]">
                Boss
              </span>
            ) : null}
            {opponent.isDefeated ? (
              <span className="rounded-full bg-[var(--app-success-soft)] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-success-soft-text)]">
                Defeated ✓
              </span>
            ) : null}
            {isLockedByProgression ? (
              <span className="rounded-full bg-[var(--app-muted-soft)] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-muted-soft-text)]">
                Locked
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
            {opponent.archetype} | Level {opponent.recommendedLevel}
          </p>
          {victorySummary ? (
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{victorySummary}</p>
          ) : null}
          {opponent.lockReason ? (
            <p className="mt-2 text-xs text-[var(--app-text-muted)]">{opponent.lockReason}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onChallenge(opponent)}
          disabled={isDisabled}
          className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            isActive
              ? 'border border-[var(--app-warning)] text-[var(--app-warning)] hover:bg-[rgb(245_158_11/0.08)]'
              : 'border border-[var(--app-brand)] text-[var(--app-brand)] hover:bg-[rgb(124_58_237/0.08)]'
          }`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
