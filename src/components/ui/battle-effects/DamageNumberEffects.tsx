import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export interface FloatingNumber {
  id: number
  value: number
  isCrit: boolean
}

export interface CritBadge {
  id: number
}

export function DamageNumberEffects({
  numbers,
  crits,
}: {
  numbers: FloatingNumber[]
  crits: CritBadge[]
}) {
  return (
    <>
      {numbers.map((n) => (
        <div
          key={n.id}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              animation: `${n.isCrit ? 'crit-float-up' : 'float-up'} ${BATTLE_ANIM.DAMAGE_NUMBER_MS}ms ease-out forwards`,
              fontWeight: 800,
              fontSize: n.isCrit ? 30 : 20,
              lineHeight: 1,
              color: n.isCrit ? '#fffbea' : 'var(--app-text-primary)',
              textShadow: n.isCrit
                ? '0 2px 6px rgba(0,0,0,0.58), 0 0 10px rgba(255,255,255,0.75), 0 0 18px rgba(251,191,36,0.74)'
                : '0 2px 5px rgba(0,0,0,0.4)',
              WebkitTextStroke: n.isCrit ? '1px rgba(146,64,14,0.52)' : undefined,
              whiteSpace: 'nowrap',
            }}
          >
            {n.value}
          </div>
        </div>
      ))}

      {crits.map((c) => (
        <div
          key={c.id}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translate(16px, -30px) rotate(-5deg)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              animation: `crit-pop ${BATTLE_ANIM.CRIT_BADGE_MS}ms ease-out forwards`,
              fontWeight: 800,
              fontSize: 11,
              lineHeight: 1,
              letterSpacing: 0,
              color: '#78350f',
              background: 'linear-gradient(180deg, #fef3c7 0%, #fbbf24 100%)',
              border: '1px solid rgba(255,255,255,0.85)',
              borderRadius: 4,
              padding: '3px 5px 2px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.34), 0 0 10px rgba(251,191,36,0.62)',
              textShadow: '0 1px 0 rgba(255,255,255,0.45)',
              whiteSpace: 'nowrap',
            }}
          >
            CRIT!
          </div>
        </div>
      ))}
    </>
  )
}
