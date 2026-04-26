import { Link } from 'react-router-dom'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import { PageTitle } from '@/components/ui/AppHeadings'
import { StatBar } from '@/components/ui/StatBar'
import CreatureSprite from '@/components/ui/CreatureSprite'
import { ReadinessPanel } from '@/components/battle/ReadinessPanel'
import { useLatestCreatureStats } from '@/features/creature/useLatestCreatureStats'
import { useBattleHub } from '@/features/creature/useBattleHub'
import { useProfileSummary } from '@/features/profile/useProfileSummary'
import { creatureStatBarFill } from '@/lib/creatureStatAccents'
import { getTodayInTimezone } from '@/lib/date'
import { getPlayerSpriteDescriptor } from '@/lib/sprites'
import type { CreatureCondition } from '@/types/domain'

function getConditionTone(condition: CreatureCondition) {
  switch (condition) {
    case 'thriving':
      return 'text-[var(--app-success)]'
    case 'recovering':
      return 'text-[var(--app-warning)]'
    default:
      return 'text-[var(--app-brand)]'
  }
}

function getFormDescription(condition: CreatureCondition) {
  switch (condition) {
    case 'thriving':
      return 'Your companion is in top form right now.'
    case 'recovering':
      return 'Your companion is below peak form and can build back up with steadier days.'
    default:
      return 'Your companion is in a stable form with room to improve.'
  }
}

export default function CreaturePage() {
  const profileQuery = useProfileSummary()
  const statsQuery = useLatestCreatureStats()

  const timezone = profileQuery.data?.timezone ?? null
  const battleDate = timezone ? getTodayInTimezone(timezone) : null
  const battleHubQuery = useBattleHub(battleDate, timezone)

  const stats = statsQuery.data?.stats ?? null
  const companion = statsQuery.data?.companion ?? {
    userId: '',
    name: 'Sprout',
    stage: stats?.stage ?? 'baby',
    level: 1,
    xp: 0,
    currentCondition: 'steady' as const,
    hatchedAt: '',
    evolvedToAdultAt: null,
    evolvedToChampionAt: null,
    createdAt: '',
    updatedAt: '',
  }

  if (profileQuery.isLoading || statsQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="app-page min-h-full px-4 py-6 pb-24">
      <PageTitle>Your Companion</PageTitle>

      <div className="app-card overflow-hidden">
        <div className="bg-gradient-to-br from-[var(--app-brand-soft)] via-[var(--app-surface)] to-[var(--app-surface-elevated)] px-5 py-6">
          <div className="flex items-center gap-4">
            <CreatureSprite
              className="shrink-0"
              descriptor={getPlayerSpriteDescriptor(companion.stage, companion.currentCondition)}
              displaySize={80}
              flip={false}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                Companion Progress
              </p>
              <h2 className="truncate text-2xl font-bold text-[var(--app-text-primary)]">
                {companion.name}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-3 py-1 font-medium capitalize text-[var(--app-text-secondary)]">
                  Stage: {companion.stage}
                </span>
                <span className="rounded-full bg-white px-3 py-1 font-medium text-[var(--app-text-secondary)]">
                  Level {companion.level}
                </span>
                <span
                  className={`rounded-full bg-white px-3 py-1 font-medium capitalize ${getConditionTone(companion.currentCondition)}`}
                >
                  Form: {companion.currentCondition}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-[var(--app-text-secondary)]">XP</span>
              <span className="font-semibold text-[var(--app-text-primary)]">{companion.xp}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-border)]">
              <div
                className="h-full rounded-full bg-[var(--app-brand)] transition-all duration-500"
                style={{ width: `${Math.min(companion.xp % 100, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-[var(--app-text-muted)]">
              {companion.xp % 100} / 100 to next level
            </p>
          </div>
        </div>

        {stats ? (
          <div className="space-y-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                Current Form
              </p>
              <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                These values show your companion&apos;s current form, not permanent max stats.
              </p>
              <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                {getFormDescription(companion.currentCondition)}
              </p>
            </div>
            <StatBar label="Strength Form" value={stats.strength} color={creatureStatBarFill.strength} />
            <StatBar label="Resilience Form" value={stats.resilience} color={creatureStatBarFill.resilience} />
            <StatBar label="Momentum Form" value={stats.momentum} color={creatureStatBarFill.momentum} />
            <StatBar label="Vitality" value={stats.vitality} color="var(--app-success)" max={200} />
          </div>
        ) : (
          <div className="p-5">
            <EmptyState title="Finalize your first day to hatch your companion." className="py-2" />
          </div>
        )}
      </div>

      {/* Battle Prep — shown once a snapshot is available for today */}
      {battleHubQuery.data?.snapshot ? (
        <div className="mt-4">
          <ReadinessPanel
            snapshot={battleHubQuery.data.snapshot}
            recommendedOpponent={null}
            battleDate={battleDate!}
          />
        </div>
      ) : null}

      <Link
        to="/app/battle"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-brand)] py-3 text-sm font-semibold text-[var(--app-brand)] transition-colors hover:bg-[rgb(124_58_237/0.06)]"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
          />
        </svg>
        Go to Battle Hub
      </Link>
    </div>
  )
}
