import type { CSSProperties } from 'react'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export interface FocusSpendEffect {
  id: number
  pipCount: number
}

export interface ChargeSpendEffect {
  id: number
  pipCount: number
}

export function PipSpendEffects({
  focusSpends,
  chargeSpends,
  displaySize,
}: {
  focusSpends: FocusSpendEffect[]
  chargeSpends: ChargeSpendEffect[]
  displaySize?: number
}) {
  return (
    <>
      {focusSpends.map((effect) => (
        <div
          key={effect.id}
          data-testid="battle-focus-spend"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {Array.from({ length: effect.pipCount }).map((_, i) => {
            const offset = i - (effect.pipCount - 1) / 2
            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: `${50 + offset * 12}%`,
                  bottom: '16%',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#facc15',
                  boxShadow: '0 0 8px rgba(250,204,21,0.9), 0 0 14px rgba(245,158,11,0.5)',
                  animation: `battle-focus-spend ${BATTLE_ANIM.FOCUS_SPEND_MS}ms ease-in forwards`,
                  animationDelay: `${i * 24}ms`,
                }}
              />
            )
          })}
        </div>
      ))}

      {chargeSpends.map((effect) => (
        <div
          key={effect.id}
          data-testid="battle-charge-spend"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {Array.from({ length: effect.pipCount }).map((_, i) => {
            const ds = displaySize ?? 128
            const offset = i - (effect.pipCount - 1) / 2
            const startX = ds / 2 + offset * ds * 0.13
            const startY = ds * 0.82
            const dx = ds / 2 - startX
            const dy = ds * 0.50 - startY
            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: startX,
                  top: startY,
                  width: 9,
                  height: 9,
                  marginLeft: -4.5,
                  marginTop: -4.5,
                  borderRadius: '50%',
                  background: '#facc15',
                  boxShadow: '0 0 10px rgba(250,204,21,0.95), 0 0 18px rgba(245,158,11,0.6)',
                  ['--dx' as string]: `${dx}px`,
                  ['--dy' as string]: `${dy}px`,
                  animation: `battle-focus-converge ${BATTLE_ANIM.FOCUS_SPEND_MS}ms ease-in ${i * 22}ms forwards`,
                } as CSSProperties}
              />
            )
          })}
        </div>
      ))}
    </>
  )
}
