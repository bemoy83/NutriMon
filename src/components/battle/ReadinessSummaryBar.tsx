import type { CreatureBattleSnapshot, BattleRecommendation, ReadinessBand, BattleLikelyOutcome } from '@/types/domain'

const bandBarColor: Record<ReadinessBand, string> = {
  recovering: 'var(--app-danger)',
  building: 'var(--app-warning)',
  ready: 'var(--app-brand)',
  peak: 'var(--app-success)',
}

const bandLabelClass: Record<ReadinessBand, string> = {
  recovering: 'text-[var(--app-danger)]',
  building: 'text-[var(--app-warning)]',
  ready: 'text-[var(--app-brand)]',
  peak: 'text-[var(--app-success)]',
}

const outcomeLabelClass: Record<BattleLikelyOutcome, string> = {
  favored: 'text-[var(--app-success)]',
  competitive: 'text-[var(--app-warning)]',
  risky: 'text-[var(--app-danger)]',
}

interface ReadinessSummaryBarProps {
  snapshot: CreatureBattleSnapshot
  recommendedOpponent: BattleRecommendation | null
}

export function ReadinessSummaryBar({ snapshot, recommendedOpponent }: ReadinessSummaryBarProps) {
  return (
    <div className="app-card px-4 py-3">
      {/* Band-coloured progress bar */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--app-border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${snapshot.readinessScore}%`,
            background: bandBarColor[snapshot.readinessBand],
          }}
        />
      </div>

      {/* Info row */}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        {/* Left: band + score */}
        <div className="flex items-baseline gap-2">
          <span
            className={`text-sm font-semibold capitalize ${bandLabelClass[snapshot.readinessBand]}`}
          >
            {snapshot.readinessBand}
          </span>
          <span className="tabular-nums text-xs text-[var(--app-text-subtle)]">
            {snapshot.readinessScore}/100
          </span>
        </div>

        {/* Right: recommended opponent */}
        {recommendedOpponent ? (
          <div className="flex min-w-0 items-center gap-1">
            <span className="shrink-0 text-xs text-[var(--app-text-muted)]">vs.</span>
            <span className="truncate text-xs font-medium text-[var(--app-text-primary)]">
              {recommendedOpponent.name}
            </span>
            <span
              className={`shrink-0 text-xs font-medium capitalize ${outcomeLabelClass[recommendedOpponent.likelyOutcome]}`}
            >
              · {recommendedOpponent.likelyOutcome}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
