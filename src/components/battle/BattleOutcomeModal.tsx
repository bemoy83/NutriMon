import { useEffect } from 'react'
import confetti from 'canvas-confetti'

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
  useEffect(() => {
    if (!isWin) return

    // Initial burst
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { x: 0.5, y: 0.35 },
      colors: ['#FFD700', '#FFC300', '#FF6B6B', '#A78BFA', '#60A5FA', '#34D399'],
      scalar: 1.1,
      ticks: 200,
    })

    // Flanking bursts after a short delay
    const t1 = setTimeout(() => {
      confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.5 }, colors: ['#FFD700', '#A78BFA', '#34D399'] })
      confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.5 }, colors: ['#FFD700', '#60A5FA', '#FF6B6B'] })
    }, 220)

    // Gentle trickle for a couple seconds
    let trickleCount = 0
    const trickle = setInterval(() => {
      confetti({
        particleCount: 12,
        spread: 60,
        origin: { x: Math.random(), y: 0 },
        colors: ['#FFD700', '#FFC300', '#A78BFA', '#60A5FA'],
        gravity: 0.7,
        scalar: 0.85,
        ticks: 180,
      })
      trickleCount++
      if (trickleCount >= 6) clearInterval(trickle)
    }, 350)

    return () => {
      clearTimeout(t1)
      clearInterval(trickle)
    }
  }, [isWin])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{
        background: isWin
          ? 'linear-gradient(to bottom, rgba(16,78,50,0.35) 0%, rgba(0,0,0,0.82) 55%)'
          : 'linear-gradient(to bottom, rgba(90,10,10,0.35) 0%, rgba(0,0,0,0.82) 55%)',
      }}
    >
      <div
        className="animate-modal-pop w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(10,12,20,0.88)] px-5 py-6 text-center backdrop-blur-xl"
        style={{
          boxShadow: '0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* Icon + title */}
        <div className="mb-1 text-4xl">{isWin ? '🏆' : '💀'}</div>
        <p
          className="text-3xl font-extrabold tracking-tight"
          style={{
            color: isWin ? '#34D399' : 'var(--app-danger)',
            textShadow: isWin
              ? '0 0 24px rgba(52,211,153,0.55)'
              : '0 0 18px rgba(239,68,68,0.45)',
          }}
        >
          {isWin ? 'Victory!' : 'Defeat'}
        </p>
        {isWin && (
          <p className="mt-1 text-xs font-medium tracking-wide text-white/40 uppercase">
            Battle won
          </p>
        )}

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Rounds', value: turnCount ?? '—' },
            { label: 'HP Left', value: remainingHpPct != null ? `${remainingHpPct}%` : '—' },
            { label: 'XP', value: rewardClaimed ? `+${xpAwarded}` : '—' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl px-2 py-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
              <p className="mt-1 text-base font-bold text-white/90">{value}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onReturn}
          className="mt-5 w-full rounded-xl bg-[var(--app-brand)] py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--app-brand-hover)]"
        >
          Return to Hub
        </button>
      </div>
    </div>
  )
}
