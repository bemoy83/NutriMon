export function BattleOutcomeModal({
  isWin,
  turnCount,
  remainingHpPct,
  rewardClaimed,
  xpAwarded,
  onReturn,
}: {
  isWin: boolean
  turnCount: number | null
  remainingHpPct: number | null
  rewardClaimed: boolean
  xpAwarded: number
  onReturn: () => void
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-6 ${isWin ? 'bg-[rgba(5,150,105,0.2)]' : 'bg-black/50'}`}
    >
      <div className="animate-modal-pop w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center shadow-xl">
        <p
          className={`text-4xl font-extrabold ${isWin ? 'text-[var(--app-success)]' : 'text-[var(--app-danger)]'}`}
        >
          {isWin ? 'Victory!' : 'Defeat...'}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
            <p className="text-xs text-[var(--app-text-muted)]">Rounds</p>
            <p className="mt-1 font-semibold text-[var(--app-text-primary)]">{turnCount ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
            <p className="text-xs text-[var(--app-text-muted)]">HP Left</p>
            <p className="mt-1 font-semibold text-[var(--app-text-primary)]">{remainingHpPct ?? 0}%</p>
          </div>
          <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-3">
            <p className="text-xs text-[var(--app-text-muted)]">XP</p>
            <p className="mt-1 font-semibold text-[var(--app-text-primary)]">
              {rewardClaimed ? `+${xpAwarded}` : '—'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReturn}
          className="mt-5 w-full rounded-xl bg-[var(--app-brand)] py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--app-brand-hover)]"
        >
          Return to Companion
        </button>
      </div>
    </div>
  )
}
