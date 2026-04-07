import type { CreatureBattleSnapshot, BattleRecommendation, BattleLikelyOutcome } from '@/types/domain'

function getReadinessDescription(readiness: string) {
  switch (readiness) {
    case 'peak':
      return 'Peak means your locked prep is in the strongest range for today.'
    case 'ready':
      return 'Ready means the companion is well prepared for a solid battle today.'
    case 'building':
      return 'Building means readiness is moving in the right direction, with room to strengthen it further.'
    default:
      return 'Recovering means today starts from a weaker prep snapshot and may need a safer matchup.'
  }
}

function getOutcomeTone(outcome: BattleLikelyOutcome) {
  switch (outcome) {
    case 'favored':
      return 'text-[var(--app-success)]'
    case 'risky':
      return 'text-[var(--app-danger)]'
    default:
      return 'text-[var(--app-warning)]'
  }
}

interface ReadinessPanelProps {
  snapshot: CreatureBattleSnapshot
  recommendedOpponent: BattleRecommendation | null
  battleDate: string
}

export function ReadinessPanel({ snapshot, recommendedOpponent, battleDate }: ReadinessPanelProps) {
  return (
    <div className="app-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
            Battle Readiness
          </p>
          <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
            Locked battle prep for {battleDate}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
              Readiness
            </p>
            <p className="mt-2 text-lg font-semibold capitalize text-[var(--app-text-primary)]">
              {snapshot.readinessBand}
            </p>
          </div>
          <div className="rounded-full bg-[var(--app-brand-soft)] px-3 py-1 text-sm font-semibold text-[var(--app-brand)]">
            {snapshot.readinessScore}/100
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--app-text-secondary)]">
          {getReadinessDescription(snapshot.readinessBand)}
        </p>
        <p className="mt-2 text-sm text-[var(--app-text-secondary)]">
          Readiness reflects how your companion&apos;s current form translates into battle prep.
        </p>
      </div>

      {recommendedOpponent ? (
        <div className="mt-5 border-t border-[var(--app-border-muted)] pt-4">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
            Recommended Opponent
          </p>
          <p className="mt-2 text-base font-semibold text-[var(--app-text-primary)]">
            {recommendedOpponent.name}
          </p>
          <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
            {recommendedOpponent.archetype} | Level {recommendedOpponent.recommendedLevel}
          </p>
          <p
            className={`mt-2 text-sm font-medium capitalize ${getOutcomeTone(recommendedOpponent.likelyOutcome)}`}
          >
            {recommendedOpponent.likelyOutcome}
          </p>
        </div>
      ) : null}
    </div>
  )
}
