import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export interface ShockwaveEffect {
  id: number
  wide: boolean
}

export interface OverdriveStreak {
  id: number
  yPct: number
}

export function ShockwaveEffects({
  shockwaves,
  streaks,
}: {
  shockwaves: ShockwaveEffect[]
  streaks: OverdriveStreak[]
}) {
  return (
    <>
      {shockwaves.map((s) => (
        <div
          key={s.id}
          data-testid="battle-ground-shockwave"
          style={{
            position: 'absolute',
            bottom: '6%',
            left: '50%',
            width: s.wide ? '90%' : '68%',
            height: s.wide ? '22%' : '18%',
            border: s.wide ? '4px solid rgba(139,92,246,0.95)' : '3px solid rgba(139,92,246,0.9)',
            borderRadius: '50%',
            boxShadow: s.wide
              ? '0 0 14px rgba(139,92,246,0.8), 0 0 28px rgba(109,40,217,0.5)'
              : '0 0 10px rgba(139,92,246,0.7), 0 0 20px rgba(109,40,217,0.4)',
            transform: 'translate(-50%, -50%) scale(0.1)',
            pointerEvents: 'none',
            animation: `ground-shockwave ${BATTLE_ANIM.GROUND_SHOCKWAVE_MS}ms ease-out forwards`,
          }}
        />
      ))}

      {streaks.map((s) => (
        <div
          key={s.id}
          data-testid="battle-overdrive-streak"
          style={{
            position: 'absolute',
            top: `${s.yPct}%`,
            left: '50%',
            width: '65%',
            height: 3,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent 0%, rgba(217,70,239,0.85) 22%, rgba(255,255,255,0.72) 50%, rgba(217,70,239,0.85) 78%, transparent 100%)',
            filter: 'blur(0.5px)',
            pointerEvents: 'none',
            animation: 'overdrive-streak 280ms ease-out forwards',
          }}
        />
      ))}
    </>
  )
}
