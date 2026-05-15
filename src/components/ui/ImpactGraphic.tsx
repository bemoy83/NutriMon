import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'

export type ImpactVariant = 'slash' | 'arc' | 'burst' | 'cut'

interface ImpactGraphicProps {
  variant: ImpactVariant
  size: number
  isCrit: boolean
  angle: number
  /** Optional skill tint. Crit always overrides to white for maximum pop. */
  impactColor?: { stroke: string; glowFilter: string }
}


export function ImpactGraphic({ variant, size, isCrit, angle, impactColor }: ImpactGraphicProps) {
  const color = isCrit ? '#ffffff' : (impactColor?.stroke ?? '#fde047')
  const glow = isCrit
    ? 'drop-shadow(0 0 10px rgba(255,255,255,0.98)) drop-shadow(0 0 18px rgba(255,255,220,0.72))'
    : (impactColor?.glowFilter ?? 'drop-shadow(0 0 7px rgba(250,204,21,0.98)) drop-shadow(0 0 12px rgba(234,179,8,0.7))')
  const dur = BATTLE_ANIM.HIT_IMPACT_MS

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
          {/* Core flash */}
          <circle
            cx="50" cy="50" r="9"
            fill={color}
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `impact-core ${dur}ms ease-out forwards`,
            }}
          />
          {/* Expanding ring */}
          <circle
            cx="50" cy="50" r="16"
            fill="none"
            stroke={color}
            strokeWidth={isCrit ? 3 : 2.5}
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `impact-ring ${dur}ms ease-out forwards`,
            }}
          />
          {/* 4 cardinal spokes */}
          {([
            [50, 39, 50, 14],
            [61, 50, 86, 50],
            [50, 61, 50, 86],
            [39, 50, 14, 50],
          ] as const).map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={isCrit ? 3.5 : 2.5}
              strokeLinecap="round"
              pathLength="100"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: `impact-slash ${dur}ms ease-out forwards`,
              }}
            />
          ))}
          {/* 4 diagonal spokes */}
          {([
            [56, 44, 67, 33],
            [44, 44, 33, 33],
            [44, 56, 33, 67],
            [56, 56, 67, 67],
          ] as const).map(([x1, y1, x2, y2], i) => (
            <line
              key={i + 4}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={isCrit ? 2.5 : 1.8}
              strokeLinecap="round"
              pathLength="100"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: `impact-slash ${dur}ms ease-out forwards`,
                animationDelay: '30ms',
              }}
            />
          ))}
        </>
      )}

      {variant === 'arc' && (
        /* Combo hit — tighter explosion for rapid multi-hit */
        <>
          <circle
            cx="50" cy="50" r="7"
            fill={color}
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `impact-core ${dur}ms ease-out forwards`,
            }}
          />
          <circle
            cx="50" cy="50" r="13"
            fill="none"
            stroke={color}
            strokeWidth={isCrit ? 2.5 : 2}
            style={{
              transformBox: 'fill-box' as React.CSSProperties['transformBox'],
              transformOrigin: 'center',
              animation: `impact-ring ${dur}ms ease-out forwards`,
            }}
          />
          {([
            [50, 40, 50, 20],
            [60, 50, 80, 50],
            [50, 60, 50, 80],
            [40, 50, 20, 50],
          ] as const).map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={isCrit ? 3 : 2}
              strokeLinecap="round"
              pathLength="100"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: `impact-slash ${dur}ms ease-out forwards`,
              }}
            />
          ))}
          {([
            [55, 45, 65, 35],
            [45, 45, 35, 35],
            [45, 55, 35, 65],
            [55, 55, 65, 65],
          ] as const).map(([x1, y1, x2, y2], i) => (
            <line
              key={i + 4}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={isCrit ? 2 : 1.5}
              strokeLinecap="round"
              pathLength="100"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: `impact-slash ${dur}ms ease-out forwards`,
                animationDelay: '30ms',
              }}
            />
          ))}
        </>
      )}

      {variant === 'cut' && (
        /* Directional slash marks — three parallel diagonal strokes.
           The SVG is rotated by `angle` so each hit reads as a distinct cut direction. */
        <>
          {[
            { x1: 14, y1: 70, x2: 54, y2: 14, delay: 0,  w: isCrit ? 2.5 : 1.8 },
            { x1: 28, y1: 78, x2: 68, y2: 22, delay: 16, w: isCrit ? 4.5 : 3.5 },
            { x1: 40, y1: 84, x2: 80, y2: 28, delay: 6,  w: isCrit ? 2.5 : 1.8 },
          ].map(({ x1, y1, x2, y2, delay, w }, i) => (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={w}
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
              animation: `impact-core ${dur}ms ease-out forwards`,
            }}
          />
        </>
      )}

      {variant === 'burst' && (
        <g
          style={{
            transformBox: 'fill-box' as React.CSSProperties['transformBox'],
            transformOrigin: 'center',
            animation: `impact-burst ${dur}ms ease-out forwards`,
          }}
        >
          {([0, 45, 90, 135, 22, 67, 112, 157] as const).map((deg, i) => {
            const rad = (deg * Math.PI) / 180
            const r1 = i % 2 === 0 ? 11 : 7
            const r2 = i % 2 === 0 ? 32 : 22
            return (
              <line
                key={deg}
                x1={(50 + Math.cos(rad) * r1).toFixed(1)}
                y1={(50 + Math.sin(rad) * r1).toFixed(1)}
                x2={(50 + Math.cos(rad) * r2).toFixed(1)}
                y2={(50 + Math.sin(rad) * r2).toFixed(1)}
                stroke={color}
                strokeWidth={i % 2 === 0 ? 3 : 2}
                strokeLinecap="round"
              />
            )
          })}
        </g>
      )}
    </svg>
  )
}
