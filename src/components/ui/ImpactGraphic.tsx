import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export type ImpactVariant = 'slash' | 'arc' | 'burst' | 'cut'

interface ImpactGraphicProps {
  variant: ImpactVariant
  size: number
  isCrit: boolean
  angle: number
  emphasis?: boolean
  /** Optional skill tint. Crit always overrides to white for maximum pop. */
  impactColor?: { stroke: string; glowFilter: string }
}

export function ImpactGraphic({ variant, size, isCrit, angle, emphasis = false, impactColor }: ImpactGraphicProps) {
  const color = isCrit ? '#ffffff' : (impactColor?.stroke ?? '#fde047')
  const glow = isCrit
    ? 'drop-shadow(0 0 10px rgba(255,255,255,0.98)) drop-shadow(0 0 18px rgba(255,255,220,0.72))'
    : (impactColor?.glowFilter ?? 'drop-shadow(0 0 7px rgba(250,204,21,0.98)) drop-shadow(0 0 12px rgba(234,179,8,0.7))')
  const dur = BATTLE_ANIM.HIT_IMPACT_MS
  const strokeBoost = emphasis ? 1.25 : 1

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ overflow: 'visible', filter: glow, transform: `rotate(${angle}deg)`, transformOrigin: 'center' }}
      aria-hidden="true"
    >
      {variant === 'slash' && (
        <>
          {/* Directional basic-hit slash: asymmetric contact mark plus a small spark core. */}
          <circle
            cx="47" cy="51" r={emphasis ? 8 : 6}
            fill={color}
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `${emphasis ? 'impact-final-core' : 'impact-core'} ${dur}ms ease-out forwards`,
            }}
          />
          <path
            d="M18 67 C36 49 50 38 78 23"
            stroke={color}
            strokeWidth={(isCrit ? 5.2 : 4.1) * strokeBoost}
            strokeLinecap="round"
            fill="none"
            pathLength="100"
            style={{
              strokeDasharray: 100,
              strokeDashoffset: 100,
              animation: `impact-slash ${dur}ms ease-out forwards`,
            }}
          />
          {([
            [34, 56, 15, 62],
            [57, 42, 74, 36],
            [45, 60, 39, 77],
          ] as const).map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={(isCrit ? 2.8 : 2.1) * strokeBoost}
              strokeLinecap="round"
              pathLength="100"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: `impact-slash ${dur}ms ease-out forwards`,
                animationDelay: `${i === 0 ? 0 : i * 16}ms`,
              }}
            />
          ))}
        </>
      )}

      {variant === 'arc' && (
        /* Combo hit — curved slices so rapid hits read as motion, not radial bursts. */
        <>
          {[
            { d: 'M24 62 C38 31 67 24 80 43', w: isCrit ? 4 : 3, delay: 0 },
            { d: 'M30 73 C47 52 65 50 76 60', w: isCrit ? 2.8 : 2.1, delay: 24 },
            { d: 'M22 48 C36 63 55 70 74 69', w: isCrit ? 2.2 : 1.7, delay: 42 },
          ].map((arc, i) => (
            <path
              key={i}
              d={arc.d}
              stroke={color}
              strokeWidth={arc.w * strokeBoost}
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: `impact-arc ${dur}ms ease-out forwards`,
                animationDelay: `${arc.delay}ms`,
              }}
            />
          ))}
          <circle
            cx="49" cy="55" r={emphasis ? 6 : 4}
            fill={color}
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `${emphasis ? 'impact-final-core' : 'impact-core'} ${dur}ms ease-out forwards`,
            }}
          />
        </>
      )}

      {variant === 'cut' && (
        /* Directional slash marks — three parallel diagonal strokes.
           The SVG is rotated by `angle` so each hit reads as a distinct cut direction. */
        <>
          {[
            { x1: 13, y1: 74, x2: 59, y2: 10, delay: 0,  w: isCrit ? 2.7 : 2.0 },
            { x1: 27, y1: 82, x2: 73, y2: 18, delay: 12, w: isCrit ? 5.2 : 4.1 },
            { x1: 43, y1: 86, x2: 87, y2: 25, delay: 4,  w: isCrit ? 2.7 : 2.0 },
          ].map(({ x1, y1, x2, y2, delay, w }, i) => (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={w * strokeBoost}
              strokeLinecap="round"
              pathLength="100"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: `impact-slash ${dur}ms ease-out forwards`,
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
          <circle
            cx="47" cy="48" r={isCrit ? 5 : 4}
            fill={color}
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `${emphasis ? 'impact-final-core' : 'impact-core'} ${dur}ms ease-out forwards`,
            }}
          />
        </>
      )}

      {variant === 'burst' && (
        <>
          <circle
            cx="50" cy="50" r={emphasis ? 12 : 10}
            fill={color}
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `${emphasis ? 'impact-final-core' : 'impact-core'} ${dur}ms ease-out forwards`,
            }}
          />
          <circle
            cx="50" cy="50" r="18"
            fill="none"
            stroke={color}
            strokeWidth={(isCrit ? 3.6 : 2.8) * strokeBoost}
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `${emphasis ? 'impact-final-ring' : 'impact-ring'} ${dur}ms ease-out forwards`,
            }}
          />
          <g
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `${emphasis ? 'impact-final-burst' : 'impact-burst'} ${dur}ms ease-out forwards`,
            }}
          >
            {([0, 45, 90, 135, 22, 67, 112, 157] as const).map((deg, i) => {
              const rad = (deg * Math.PI) / 180
              const r1 = i % 2 === 0 ? 14 : 9
              const r2 = i % 2 === 0 ? 38 : 27
              return (
                <line
                  key={deg}
                  x1={(50 + Math.cos(rad) * r1).toFixed(1)}
                  y1={(50 + Math.sin(rad) * r1).toFixed(1)}
                  x2={(50 + Math.cos(rad) * r2).toFixed(1)}
                  y2={(50 + Math.sin(rad) * r2).toFixed(1)}
                  stroke={color}
                  strokeWidth={(i % 2 === 0 ? 3.3 : 2.1) * strokeBoost}
                  strokeLinecap="round"
                />
              )
            })}
          </g>
        </>
      )}
    </svg>
  )
}
