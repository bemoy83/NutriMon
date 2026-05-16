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
              color: n.isCrit ? '#ffffff' : 'var(--app-text-primary)',
              textShadow: n.isCrit
                ? '0 2px 6px rgba(0,0,0,0.55), 0 0 14px rgba(255,255,180,0.8)'
                : '0 2px 5px rgba(0,0,0,0.4)',
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
            bottom: '110%',
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              animation: `crit-pop ${BATTLE_ANIM.CRIT_BADGE_MS}ms ease-out forwards`,
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: '0.08em',
              color: 'var(--app-warning)',
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
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
