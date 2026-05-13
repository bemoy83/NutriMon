import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { BATTLE_SKILL_CATALOG } from '@/components/battle/battleActionConfig'

function levelForXp(xp: number) {
  return Math.floor(Math.cbrt(Math.max(0, xp))) + 1
}

function xpBounds(level: number) {
  const start = Math.pow(level - 1, 3)
  const end   = Math.pow(level, 3)
  return { start, width: end - start }
}

export function BattleOutcomeModal({
  isWin,
  turnCount,
  remainingHpPct,
  rewardClaimed,
  xpAwarded,
  totalXp,
  onReturn,
}: {
  isWin: boolean
  turnCount: number | null
  remainingHpPct: number | null
  rewardClaimed: boolean
  xpAwarded: number
  totalXp: number
  onReturn: () => void
}) {
  const levelUpFired = useRef(false)

  const preBattleXp = rewardClaimed ? totalXp - xpAwarded : totalXp
  const preLevel    = levelForXp(preBattleXp)
  const postLevel   = levelForXp(totalXp)
  const leveledUp   = rewardClaimed && postLevel > preLevel

  const { start: levelStart, width: xpToNextLevel } = xpBounds(postLevel)
  const xpIntoLevel = totalXp - levelStart
  const xpBarPct    = Math.min(100, (xpIntoLevel / xpToNextLevel) * 100)

  // Skills unlocked by crossing into postLevel (any level between preLevel+1 and postLevel)
  const newlyUnlockedSkills = rewardClaimed
    ? BATTLE_SKILL_CATALOG.filter(
        s => s.unlockLevel > preLevel && s.unlockLevel <= postLevel
      )
    : []

  useEffect(() => {
    if (!isWin) return

    confetti({
      particleCount: 90,
      spread: 80,
      origin: { x: 0.5, y: 0.35 },
      colors: ['#FFD700', '#FFC300', '#FF6B6B', '#A78BFA', '#60A5FA', '#34D399'],
      scalar: 1.1,
      ticks: 200,
    })

    const t1 = setTimeout(() => {
      confetti({ particleCount: 40, angle: 60,  spread: 55, origin: { x: 0, y: 0.5 }, colors: ['#FFD700', '#A78BFA', '#34D399'] })
      confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.5 }, colors: ['#FFD700', '#60A5FA', '#FF6B6B'] })
    }, 220)

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

  // Second confetti burst for level-up, fired once after a short delay
  useEffect(() => {
    if (!leveledUp || levelUpFired.current) return
    levelUpFired.current = true
    const t = setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { x: 0.5, y: 0.6 },
        colors: ['#A78BFA', '#818CF8', '#C4B5FD', '#FFD700', '#FFF'],
        scalar: 1.3,
        ticks: 260,
      })
    }, 900)
    return () => clearTimeout(t)
  }, [leveledUp])

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
            { label: 'Rounds',  value: turnCount ?? '—' },
            { label: 'HP Left', value: remainingHpPct != null ? `${remainingHpPct}%` : '—' },
            { label: 'XP',      value: rewardClaimed ? `+${xpAwarded}` : '—' },
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

        {/* XP progress + level-up section */}
        {rewardClaimed && (
          <div className="mt-4 space-y-3">
            {/* Level-up banner */}
            {leveledUp && (
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.12) 100%)',
                  border: '1px solid rgba(139,92,246,0.35)',
                  boxShadow: '0 0 20px rgba(139,92,246,0.15)',
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(196,181,253,0.7)' }}
                >
                  Level up
                </p>
                <p
                  className="mt-0.5 text-xl font-extrabold tracking-tight"
                  style={{ color: '#C4B5FD', textShadow: '0 0 16px rgba(167,139,250,0.5)' }}
                >
                  {preLevel} → {postLevel}
                </p>
              </div>
            )}

            {/* Newly unlocked skills */}
            {newlyUnlockedSkills.map(skill => (
              <div
                key={skill.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                style={{
                  background: 'rgba(245,158,11,0.07)',
                  border: '1px solid rgba(245,158,11,0.22)',
                }}
              >
                <span className="text-xl">{skill.icon}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">
                    Skill unlocked
                  </p>
                  <p className="text-sm font-bold text-white">{skill.label}</p>
                  <p className="text-xs text-white/45">{skill.description}</p>
                </div>
              </div>
            ))}

            {/* XP bar */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50">Level {postLevel}</span>
                <span className="text-xs tabular-nums text-white/35">
                  {xpIntoLevel} / {xpToNextLevel} XP
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${xpBarPct}%`,
                    background: leveledUp
                      ? 'linear-gradient(90deg, #A78BFA, #818CF8)'
                      : 'linear-gradient(90deg, #34D399, #059669)',
                    boxShadow: leveledUp
                      ? '0 0 8px rgba(167,139,250,0.5)'
                      : '0 0 8px rgba(52,211,153,0.4)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

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
