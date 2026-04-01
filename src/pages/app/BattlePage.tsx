import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingState from '@/components/ui/LoadingState'
import { useBattleRun, useSubmitBattleAction } from '@/features/creature/useBattleRun'
import type { BattleLogEntry } from '@/types/domain'

function HpBar({ current, max, color }: { current: number; max: number; color: 'brand' | 'danger' }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--app-border)]">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${pct}%`,
          background: color === 'danger' ? 'var(--app-danger)' : 'var(--app-brand)',
        }}
      />
    </div>
  )
}

function LogEntry({ entry }: { entry: BattleLogEntry }) {
  if (entry.actor === 'system') {
    return (
      <div className="py-1 text-center text-sm font-bold text-[var(--app-text-primary)]">
        {entry.message}
      </div>
    )
  }
  const isPlayer = entry.actor === 'player'
  return (
    <div
      className={`rounded-lg px-3 py-2 text-sm ${
        isPlayer
          ? 'ml-4 bg-[var(--app-brand-soft)] text-[var(--app-brand)]'
          : 'mr-4 bg-[var(--app-surface-muted)] text-[var(--app-danger)]'
      }`}
    >
      {entry.message}
    </div>
  )
}

export default function BattlePage() {
  const { battleRunId } = useParams<{ battleRunId: string }>()
  const navigate = useNavigate()
  const logEndRef = useRef<HTMLDivElement>(null)

  const { data: session, isLoading, error } = useBattleRun(battleRunId)
  const { mutate: submitAction, isPending } = useSubmitBattleAction()

  const logLength = session?.battleLog.length ?? 0
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logLength])

  if (isLoading) return <LoadingState fullScreen />

  if (error || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--app-bg)] px-6">
        <p className="text-center text-sm text-[var(--app-text-secondary)]">
          {error instanceof Error ? error.message : 'Unable to load battle.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/creature')}
          className="rounded-xl bg-[var(--app-brand)] px-5 py-3 text-sm font-semibold text-white"
        >
          Return to Companion
        </button>
      </div>
    )
  }

  const isActive = session.status === 'active'
  const isCompleted = session.status === 'completed'
  const isWin = session.outcome === 'win'

  function handleAttack() {
    if (!session || !isActive || isPending) return
    submitAction({ battleRunId: session.id, action: 'attack' })
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--app-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/app/creature')}
          className="text-sm font-medium text-[var(--app-brand)]"
        >
          ← Back
        </button>
        <span className="text-sm font-semibold text-[var(--app-text-primary)]">Battle</span>
        <span className="w-10" />
      </div>

      {/* Combatant panels */}
      <div className="relative shrink-0 px-4 pt-4 pb-2">
        {/* Opponent — top right */}
        <div className="ml-auto w-52 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
          <p className="truncate text-xs uppercase tracking-[0.1em] text-[var(--app-text-muted)]">Opponent</p>
          <p className="mt-0.5 truncate text-base font-bold text-[var(--app-text-primary)]">
            {session.opponent.name}
          </p>
          <div className="mt-2">
            <HpBar current={session.opponentCurrentHp} max={session.opponentMaxHp} color="danger" />
            <p className="mt-1 text-right text-xs text-[var(--app-text-secondary)]">
              {session.opponentCurrentHp} / {session.opponentMaxHp} HP
            </p>
          </div>
        </div>

        {/* Player — below opponent, left-aligned */}
        <div className="mt-2 w-52 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
          <p className="truncate text-xs uppercase tracking-[0.1em] text-[var(--app-text-muted)]">Companion</p>
          <p className="mt-0.5 truncate text-base font-bold text-[var(--app-text-primary)]">
            {session.companion.name}
          </p>
          <div className="mt-2">
            <HpBar current={session.playerCurrentHp} max={session.playerMaxHp} color="brand" />
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
              {session.playerCurrentHp} / {session.playerMaxHp} HP
            </p>
          </div>
        </div>
      </div>

      {/* Battle log */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {session.battleLog.length === 0 && isActive ? (
          <p className="py-4 text-center text-sm text-[var(--app-text-muted)]">
            Round {session.currentRound} — tap Attack to begin
          </p>
        ) : null}
        <div className="space-y-2">
          {session.battleLog.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))}
        </div>

        {/* Result overlay inside log */}
        {isCompleted ? (
          <div className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center">
            <p
              className={`text-3xl font-extrabold ${isWin ? 'text-[var(--app-success)]' : 'text-[var(--app-danger)]'}`}
            >
              {isWin ? 'Victory!' : 'Defeat...'}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
                <p className="text-xs text-[var(--app-text-muted)]">Rounds</p>
                <p className="mt-1 font-semibold text-[var(--app-text-primary)]">{session.turnCount ?? '—'}</p>
              </div>
              <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
                <p className="text-xs text-[var(--app-text-muted)]">HP Left</p>
                <p className="mt-1 font-semibold text-[var(--app-text-primary)]">{session.remainingHpPct ?? 0}%</p>
              </div>
              <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
                <p className="text-xs text-[var(--app-text-muted)]">XP</p>
                <p className="mt-1 font-semibold text-[var(--app-text-primary)]">
                  {session.rewardClaimed ? `+${session.xpAwarded}` : '—'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div ref={logEndRef} />
      </div>

      {/* Action tray */}
      <div className="shrink-0 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
        {isActive ? (
          <>
            <button
              type="button"
              onClick={handleAttack}
              disabled={isPending}
              className="w-full rounded-xl bg-[var(--app-brand)] py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--app-brand-hover)] disabled:opacity-50"
            >
              {isPending ? 'Attacking…' : 'Attack'}
            </button>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['Defend', 'Skill', 'Items'] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] py-2.5 text-xs font-medium text-[var(--app-text-muted)] opacity-50"
                >
                  {label}
                  <br />
                  <span className="text-[10px]">Coming soon</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigate('/app/creature')}
              className="w-full rounded-xl bg-[var(--app-brand)] py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--app-brand-hover)]"
            >
              Return to Companion
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
