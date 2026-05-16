import type { CSSProperties } from 'react'
import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export interface RegenMote {
  fxPx: number
  delayMs: number
  sizePx: number
}

export interface RegenOrbitEffect {
  id: number
  value: number
  motes: RegenMote[]
}

export function RegenEffects({
  regenOrbits,
  displaySize,
}: {
  regenOrbits: RegenOrbitEffect[]
  displaySize?: number
}) {
  return (
    <>
      {regenOrbits.map((h) => {
        const ds = displaySize ?? 128
        const cx = ds / 2
        const cy = ds * 0.44
        const rings = [
          { delay: 0,   sizePct: 0.55, dur: 700 },
          { delay: 180, sizePct: 0.70, dur: 800 },
          { delay: 380, sizePct: 0.86, dur: 900 },
        ]
        return (
          <div
            key={h.id}
            data-testid="battle-regen-orbit"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {h.motes.map((m, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: cx,
                  top: cy,
                  width: m.sizePx,
                  height: m.sizePx,
                  marginLeft: -m.sizePx / 2,
                  marginTop: -m.sizePx / 2,
                  borderRadius: '50%',
                  background: i % 4 === 0 ? '#bbf7d0' : '#4ade80',
                  boxShadow: '0 0 6px rgba(74,222,128,0.9), 0 0 10px rgba(34,197,94,0.45)',
                  ['--fx' as string]: `${m.fxPx}px`,
                  animation: `regen-mote-rise 900ms ease-out ${m.delayMs}ms forwards`,
                  opacity: 0,
                } as CSSProperties}
              />
            ))}

            {rings.map((ring, i) => {
              const w = ds * ring.sizePct
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: cx - w / 2,
                    top: cy - w / 2,
                    width: w,
                    height: w,
                    border: '3px solid rgba(74,222,128,0.88)',
                    borderRadius: '50%',
                    boxShadow: '0 0 10px rgba(74,222,128,0.45)',
                    animation: `regen-ring-expand ${ring.dur}ms ease-out ${ring.delay}ms forwards`,
                    opacity: 0,
                  }}
                />
              )
            })}

            <div
              style={{
                position: 'absolute',
                left: cx,
                top: cy,
                animation: `regen-number-pop 1200ms cubic-bezier(0.2,0.8,0.3,1) ${BATTLE_ANIM.REGEN_NUMBER_DELAY_MS}ms forwards`,
                fontWeight: 800,
                fontSize: 24,
                lineHeight: 1,
                color: '#4ade80',
                textShadow: '0 2px 5px rgba(0,0,0,0.5), 0 0 12px rgba(74,222,128,0.7)',
                whiteSpace: 'nowrap',
                opacity: 0,
                pointerEvents: 'none',
              }}
            >
              +{h.value}
            </div>
          </div>
        )
      })}
    </>
  )
}
