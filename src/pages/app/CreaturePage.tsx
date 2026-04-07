import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import CreatureSprite from '@/components/ui/CreatureSprite'
import { useLatestCreatureStats } from '@/features/creature/useLatestCreatureStats'
import { startBattleRun } from '@/features/creature/api'
import { useBattleHub } from '@/features/creature/useBattleHub'
import { useProfileSummary } from '@/features/profile/useProfileSummary'
import { getTodayInTimezone } from '@/lib/date'
import { creatureStatBarFill } from '@/lib/creatureStatAccents'
import { getPlayerSpriteDescriptor, getOpponentSpriteDescriptor } from '@/lib/sprites'
import type { BattleLikelyOutcome, BattleOpponent, CreatureCondition, ReadinessBand } from '@/types/domain'

function formatDefeatedVictorySummary(opponent: BattleOpponent): string | null {
  if (opponent.rewardedWinTurnCount == null) return null
  const hp = opponent.rewardedWinRemainingHpPct ?? 0
  const xp = opponent.rewardedWinXpAwarded ?? 0
  return `${opponent.rewardedWinTurnCount} turns | HP ${hp}% | XP ${xp}`
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-sm text-[var(--app-text-secondary)]">{label}</span>
        <span className="text-sm font-semibold text-[var(--app-text-primary)]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-border)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%`, background: color }}
        />
      </div>
    </div>
  )
}

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

function getReadinessDescription(readiness: ReadinessBand) {
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

interface OpponentCardProps {
  opponent: BattleOpponent
  isActive: boolean
  isStarting: boolean
  isDisabled: boolean
  onChallenge: (opponent: BattleOpponent) => void
}

function OpponentCard({ opponent, isActive, isStarting, isDisabled, onChallenge }: OpponentCardProps) {
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

  const spriteFilter = (opponent.isDefeated || isActive)
    ? 'none'
    : isLockedByProgression
      ? 'brightness(0) opacity(0.25)'
      : 'brightness(0) opacity(0.35)'

  return (
    <div
      className="px-4 py-3.5 transition-colors"
      style={isActive ? {
        boxShadow: 'inset 3px 0 0 var(--app-warning)',
        background: 'var(--app-warning-soft)',
      } : undefined}
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
          className="rounded-xl px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ background: isActive ? 'var(--app-warning)' : 'var(--app-brand)' }}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}

export default function CreaturePage() {
  const navigate = useNavigate()
  const profileQuery = useProfileSummary()
  const timezone = profileQuery.data?.timezone ?? 'UTC'
  const battleDate = getTodayInTimezone(timezone)
  const statsQuery = useLatestCreatureStats()
  const battleHubQuery = useBattleHub(battleDate, timezone)
  const [startingOpponentId, setStartingOpponentId] = useState<string | null>(null)
  const [battleActionError, setBattleActionError] = useState<string | null>(null)

  const stats = battleHubQuery.data?.snapshot ?? statsQuery.data?.stats ?? null
  const companion = battleHubQuery.data?.companion ?? {
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

  const activeBattleRun = battleHubQuery.data?.activeBattleRun ?? null

  async function handleChallenge(opponent: BattleOpponent) {
    // Resume active battle for this opponent
    if (activeBattleRun?.opponentId === opponent.id) {
      navigate(`/app/creature/battle/${activeBattleRun.id}`)
      return
    }

    if (!battleHubQuery.data?.snapshot) return
    setStartingOpponentId(opponent.id)
    setBattleActionError(null)

    try {
      const session = await startBattleRun(battleHubQuery.data.snapshot.id, opponent.id)
      navigate(`/app/creature/battle/${session.id}`)
    } catch (error) {
      setBattleActionError(error instanceof Error ? error.message : 'Unable to start battle')
    } finally {
      setStartingOpponentId(null)
    }
  }

  if (profileQuery.isLoading || statsQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="app-page min-h-full px-4 py-6 pb-24">
      <h1 className="mb-6 text-xl font-bold text-[var(--app-text-primary)]">Your Companion</h1>

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
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Companion Progress</p>
              <h2 className="truncate text-2xl font-bold text-[var(--app-text-primary)]">{companion.name}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-3 py-1 font-medium capitalize text-[var(--app-text-secondary)]">
                  Stage: {companion.stage}
                </span>
                <span className="rounded-full bg-white px-3 py-1 font-medium text-[var(--app-text-secondary)]">
                  Level {companion.level}
                </span>
                <span className={`rounded-full bg-white px-3 py-1 font-medium capitalize ${getConditionTone(companion.currentCondition)}`}>
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
                style={{ width: `${Math.min((companion.xp % 100), 100)}%` }}
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
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Current Form</p>
              <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                These values show your companion&apos;s current form, not permanent max stats.
              </p>
              <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{getFormDescription(companion.currentCondition)}</p>
            </div>
            <StatBar label="Strength Form" value={stats.strength} color={creatureStatBarFill.strength} />
            <StatBar label="Resilience Form" value={stats.resilience} color={creatureStatBarFill.resilience} />
            <StatBar label="Momentum Form" value={stats.momentum} color={creatureStatBarFill.momentum} />
            <div>
              <div className="mb-1 flex justify-between">
                <span className="text-sm text-[var(--app-text-secondary)]">Vitality</span>
                <span className="text-sm font-semibold text-[var(--app-text-primary)]">{stats.vitality}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-border)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((stats.vitality / 200) * 100, 100)}%`, background: 'var(--app-success)' }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState title="Finalize your first day to hatch your companion." className="py-2" />
          </div>
        )}
      </div>

      <div className="app-card mt-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Battle Readiness</p>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">Locked battle prep for {battleDate}</p>
          </div>
        </div>

        {battleHubQuery.isLoading ? (
          <LoadingState label="Loading battle prep…" />
        ) : battleHubQuery.error ? (
          <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
            <p className="text-sm text-[var(--app-text-primary)]">Battle data is unavailable right now.</p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              Logging and finalization still work normally. Try this page again after your next refresh.
            </p>
          </div>
        ) : battleHubQuery.data?.snapshot ? (
          <>
            <div className="mt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Readiness</p>
                  <p className="mt-2 text-lg font-semibold capitalize text-[var(--app-text-primary)]">
                    {battleHubQuery.data.snapshot.readinessBand}
                  </p>
                </div>
                <div className="rounded-full bg-[var(--app-brand-soft)] px-3 py-1 text-sm font-semibold text-[var(--app-brand)]">
                  {battleHubQuery.data.snapshot.readinessScore}/100
                </div>
              </div>
              <p className="mt-3 text-sm text-[var(--app-text-secondary)]">
                {getReadinessDescription(battleHubQuery.data.snapshot.readinessBand)}
              </p>
              <p className="mt-2 text-sm text-[var(--app-text-secondary)]">
                Readiness reflects how your companion&apos;s current form translates into battle prep.
              </p>
            </div>
            {battleHubQuery.data.recommendedOpponent ? (
              <div className="mt-5 border-t border-[var(--app-border-muted)] pt-4">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Recommended Opponent</p>
                <p className="mt-2 text-base font-semibold text-[var(--app-text-primary)]">
                  {battleHubQuery.data.recommendedOpponent.name}
                </p>
                <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                  {battleHubQuery.data.recommendedOpponent.archetype} | Level {battleHubQuery.data.recommendedOpponent.recommendedLevel}
                </p>
                <p className={`mt-2 text-sm font-medium capitalize ${getOutcomeTone(battleHubQuery.data.recommendedOpponent.likelyOutcome)}`}>
                  {battleHubQuery.data.recommendedOpponent.likelyOutcome}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-[var(--app-text-primary)]">No battle snapshot is locked yet.</p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              Finalize the previous day to prepare today&apos;s battle.
            </p>
          </div>
        )}
      </div>

      <div className="app-card mt-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--app-border-muted)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Arena 1 Opponents</p>
          {battleActionError ? (
            <p className="mt-1 text-sm text-[var(--app-danger)]">{battleActionError}</p>
          ) : null}
        </div>
        <div>
          {(battleHubQuery.data?.arenaOpponents ?? []).map((opponent, index) => {
            const isActiveOpponent = activeBattleRun?.opponentId === opponent.id
            const hasOtherActive = !!activeBattleRun && !isActiveOpponent
            const isStarting = startingOpponentId === opponent.id
            const isDisabled = !battleHubQuery.data?.snapshot || isStarting || hasOtherActive || !opponent.isChallengeable

            return (
              <Fragment key={opponent.id}>
                {index > 0 && (
                  <div aria-hidden className="mx-4 h-px bg-[var(--app-border-muted)]" />
                )}
                <OpponentCard
                  opponent={opponent}
                  isActive={isActiveOpponent}
                  isStarting={isStarting}
                  isDisabled={isDisabled}
                  onChallenge={handleChallenge}
                />
              </Fragment>
            )
          })}
          {(battleHubQuery.data?.arenaOpponents.length ?? 0) === 0 ? (
            <EmptyState title="No Arena 1 opponents available right now." className="py-4" />
          ) : null}
        </div>
      </div>
    </div>
  )
}
