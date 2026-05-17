import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export interface FloatingNumber {
  id: number
  value: number
  isCrit: boolean
  xOffsetPx: number
}

function damageNumberSize(value: number, isCrit: boolean): number {
  if (isCrit) return value >= 50 ? 38 : value >= 25 ? 34 : 30
  return value >= 50 ? 28 : value >= 25 ? 25 : 22
}

export function DamageNumberEffects({
  numbers,
  side = 'opponent',
}: {
  numbers: FloatingNumber[]
  side?: 'player' | 'opponent'
}) {
  const isPlayerSide = side === 'player'
  return (
    <>
      {numbers.map((n) => (
        <div
          key={n.id}
          style={{
            position: 'absolute',
            top: '25%',
            left: `calc(50% + ${n.xOffsetPx}px)`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              animation: `${n.isCrit ? 'crit-float-up' : 'float-up'} ${BATTLE_ANIM.DAMAGE_NUMBER_MS}ms ease-out forwards`,
              fontWeight: 900,
              fontSize: damageNumberSize(n.value, n.isCrit),
              lineHeight: 1,
              color: n.isCrit
                ? '#fbbf24'
                : (isPlayerSide ? '#f87171' : '#ffffff'),
              textShadow: n.isCrit
                ? '0 2px 6px rgba(0,0,0,0.6), 0 0 10px rgba(255,255,255,0.55), 0 0 20px rgba(251,191,36,0.85)'
                : (isPlayerSide
                    ? '0 2px 5px rgba(0,0,0,0.5), 0 0 10px rgba(239,68,68,0.55)'
                    : '0 2px 5px rgba(0,0,0,0.45), 0 0 8px rgba(255,255,255,0.2)'),
              WebkitTextStroke: n.isCrit ? '1px rgba(146,64,14,0.45)' : undefined,
              whiteSpace: 'nowrap',
            }}
          >
            {n.value}
          </div>
        </div>
      ))}
    </>
  )
}
