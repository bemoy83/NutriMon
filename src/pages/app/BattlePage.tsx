import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingState from '@/components/ui/LoadingState'
import { useBattleRun, useSubmitBattleAction } from '@/features/creature/useBattleRun'
import type { BattleLogEntry } from '@/types/domain'

const ENTRY_DELAY_MS = 1200

function HpBar({ current, max, color }: { current: number; max: number; color: 'brand' | 'danger' }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-border)]">
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

export default function BattlePage() {
  const { battleRunId } = useParams<{ battleRunId: string }>()
  const navigate = useNavigate()
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const { data: session, isLoading, error } = useBattleRun(battleRunId)
  const { mutate: submitAction, isPending } = useSubmitBattleAction()

  const [displayedLogOverride, setDisplayedLogOverride] = useState<{
    sessionId: string
    entries: BattleLogEntry[]
  } | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const displayedLog =
    session && displayedLogOverride?.sessionId === session.id
      ? isAnimating || displayedLogOverride.entries.length > session.battleLog.length
        ? displayedLogOverride.entries
        : session.battleLog
      : session?.battleLog ?? []

  const revealEntries = useCallback(
    (sessionId: string, fullLog: BattleLogEntry[], base: BattleLogEntry[]) => {
      animTimers.current.forEach(clearTimeout)
      animTimers.current = []

      const newEntries = fullLog.slice(base.length)
      setDisplayedLogOverride({ sessionId, entries: base })

      if (newEntries.length === 0) return

      setIsAnimating(true)

      newEntries.forEach((_, i) => {
        const t = setTimeout(() => {
          setDisplayedLogOverride({
            sessionId,
            entries: [...base, ...newEntries.slice(0, i + 1)],
          })
          if (i === newEntries.length - 1) {
            setIsAnimating(false)
          }
        }, i * ENTRY_DELAY_MS)
        animTimers.current.push(t)
      })
    },
    [],
  )

  useEffect(() => {
    return () => animTimers.current.forEach(clearTimeout)
  }, [])

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

  // Derive current HP by replaying targetHpAfter from displayed log
  let opponentHp = session.opponentMaxHp
  let playerHp = session.playerMaxHp
  for (const entry of displayedLog) {
    if (entry.target === 'opponent' && entry.targetHpAfter !== null) opponentHp = entry.targetHpAfter
    if (entry.target === 'player' && entry.targetHpAfter !== null) playerHp = entry.targetHpAfter
  }

  const isActive = session.status === 'active'
  const isCompleted = session.status === 'completed'
  const isWin = session.outcome === 'win'
  const allEntriesShown = displayedLog.length === session.battleLog.length
  const lastEntry = displayedLog[displayedLog.length - 1] ?? null

  function handleAttack() {
    if (!session || !isActive || isPending || isAnimating) return
    const prevLog = [...displayedLog]
    submitAction(
      { battleRunId: session.id, action: 'attack' },
      {
        onSuccess: (updated) => {
          revealEntries(updated.id, updated.battleLog, prevLog)
        },
      },
    )
  }

  const actions = [
    { label: 'Attack', enabled: isActive && !isPending && !isAnimating, onClick: handleAttack },
    { label: 'Defend', enabled: false, onClick: undefined },
    { label: 'Skill', enabled: false, onClick: undefined },
    { label: 'Items', enabled: false, onClick: undefined },
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)]">
      {/* ── Arena ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Opponent HP panel — top-left */}
        <div className="absolute top-4 left-4 w-44 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="truncate text-sm font-bold text-[var(--app-text-primary)]">
              {session.opponent.name}
            </p>
            <p className="ml-2 shrink-0 text-xs text-[var(--app-text-muted)]">
              Lv{session.snapshot.level}
            </p>
          </div>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
            HP
          </p>
          <HpBar current={opponentHp} max={session.opponentMaxHp} color="danger" />
        </div>

        {/* Opponent sprite placeholder — top-right */}
        <div className="absolute top-4 right-6 flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)]">
          <span className="text-xs text-[var(--app-text-muted)]">Opponent</span>
        </div>

        {/* Player sprite placeholder — bottom-left */}
        <div className="absolute bottom-4 left-6 flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)]">
          <span className="text-xs text-[var(--app-text-muted)]">You</span>
        </div>

        {/* Player HP panel — bottom-right */}
        <div className="absolute right-4 bottom-4 w-44 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="truncate text-sm font-bold text-[var(--app-text-primary)]">
              {session.companion.name}
            </p>
            <p className="ml-2 shrink-0 text-xs text-[var(--app-text-muted)]">
              Lv{session.companion.level}
            </p>
          </div>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
            HP
          </p>
          <HpBar current={playerHp} max={session.playerMaxHp} color="brand" />
          <p className="mt-1 text-right text-xs tabular-nums text-[var(--app-text-secondary)]">
            {playerHp} / {session.playerMaxHp}
          </p>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div className="h-px shrink-0 bg-[var(--app-border)]" />

      {/* ── Bottom UI ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 bg-[var(--app-surface)]" style={{ height: '11rem' }}>
        {/* Text box — left */}
        <div className="flex flex-1 items-center border-r border-[var(--app-border)] px-5 py-4">
          <p className="text-sm leading-relaxed text-[var(--app-text-primary)]">
            {lastEntry
              ? lastEntry.message
              : isActive
                ? `Round ${session.currentRound} — what will ${session.companion.name} do?`
                : null}
          </p>
        </div>

        {/* Action menu — right */}
        <div className="flex w-44 shrink-0 flex-col justify-center gap-1 px-4 py-3">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={!action.enabled}
              onClick={action.onClick}
              className={`rounded-lg px-3 py-1.5 text-left text-sm font-semibold transition-colors ${action.enabled
                  ? 'bg-[var(--app-brand)] text-white hover:bg-[var(--app-brand-hover)]'
                  : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] opacity-50'
                }`}
            >
              {action.label === 'Attack' && (isPending || isAnimating) ? 'Attacking…' : action.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Victory / Defeat modal ────────────────────────────────── */}
      {isCompleted && allEntriesShown ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center shadow-xl">
            <p
              className={`text-4xl font-extrabold ${isWin ? 'text-[var(--app-success)]' : 'text-[var(--app-danger)]'}`}
            >
              {isWin ? 'Victory!' : 'Defeat...'}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
                <p className="text-xs text-[var(--app-text-muted)]">Rounds</p>
                <p className="mt-1 font-semibold text-[var(--app-text-primary)]">
                  {session.turnCount ?? '—'}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
                <p className="text-xs text-[var(--app-text-muted)]">HP Left</p>
                <p className="mt-1 font-semibold text-[var(--app-text-primary)]">
                  {session.remainingHpPct ?? 0}%
                </p>
              </div>
              <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
                <p className="text-xs text-[var(--app-text-muted)]">XP</p>
                <p className="mt-1 font-semibold text-[var(--app-text-primary)]">
                  {session.rewardClaimed ? `+${session.xpAwarded}` : '—'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/app/creature')}
              className="mt-5 w-full rounded-xl bg-[var(--app-brand)] py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--app-brand-hover)]"
            >
              Return to Companion
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
