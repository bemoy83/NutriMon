import type { CSSProperties } from 'react'
import { spriteCenter } from './spriteCenter'

export interface FocusMote {
  px: number
  py: number
  dx: number
  dy: number
  delayMs: number
  sizePx: number
}

export interface FocusEffect {
  id: number
  motes: FocusMote[]
}

export function FocusChargeEffects({
  focuses,
  displaySize,
}: {
  focuses: FocusEffect[]
  displaySize?: number
}) {
  return (
    <>
      {focuses.map((f) => {
        const ds = displaySize ?? 128
        const { cx, cy } = spriteCenter(ds)
        const shrinkRings = [
          { w: ds * 1.02, delay: 0,   dur: 520 },
          { w: ds * 0.76, delay: 90,  dur: 540 },
        ]
        const burstW = ds * 0.52
        return (
          <div
            key={f.id}
            data-testid="battle-focus-charge"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {f.motes.map((m, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: m.px,
                  top: m.py,
                  width: m.sizePx,
                  height: m.sizePx,
                  marginLeft: -m.sizePx / 2,
                  marginTop: -m.sizePx / 2,
                  borderRadius: '50%',
                  background: i % 3 === 0 ? '#fef08a' : '#facc15',
                  boxShadow: '0 0 6px rgba(250,204,21,0.9), 0 0 10px rgba(245,158,11,0.45)',
                  ['--dx' as string]: `${m.dx}px`,
                  ['--dy' as string]: `${m.dy}px`,
                  animation: `focus-orbit-in 640ms ease-in ${m.delayMs}ms forwards`,
                  opacity: 0,
                } as CSSProperties}
              />
            ))}

            {shrinkRings.map((ring, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: cx,
                  top: cy,
                  width: ring.w,
                  height: ring.w,
                  border: '2.5px solid rgba(250,204,21,0.82)',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px rgba(250,204,21,0.4)',
                  animation: `focus-ring-shrink ${ring.dur}ms ease-in ${ring.delay}ms forwards`,
                  opacity: 0,
                }}
              />
            ))}

            <div
              style={{
                position: 'absolute',
                left: cx,
                top: cy,
                width: burstW,
                height: burstW,
                border: '3px solid rgba(253,224,71,0.95)',
                borderRadius: '50%',
                boxShadow: '0 0 12px rgba(250,204,21,0.65), 0 0 22px rgba(245,158,11,0.35)',
                animation: 'focus-burst-out 220ms ease-out 620ms forwards',
                opacity: 0,
              }}
            />
          </div>
        )
      })}
    </>
  )
}
