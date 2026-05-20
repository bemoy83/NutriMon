import { BATTLE_ANIM } from '@/lib/battleAnimationConfig'
import type { ImpactVariant } from '@/lib/battleAnimationConfig'

export type { ImpactVariant }

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

  const isPixelArt = variant === 'cross'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      shapeRendering={isPixelArt ? 'crispEdges' : undefined}
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

      {variant === 'star' && (
        /* Organic explosion burst. Irregular jagged silhouette — reads as raw impact energy.
           Path is authored in a 32×32 space; scale(3.125) maps it to the 100×100 viewBox.
           Outer g owns the burst animation; inner g owns the coordinate scaling. */
        <g
          style={{
            transformBox: 'fill-box' as React.CSSProperties['transformBox'],
            transformOrigin: 'center',
            animation: `${emphasis ? 'impact-final-burst' : 'impact-burst'} ${dur}ms ease-out forwards`,
          }}
        >
          <g transform="translate(12, 10) scale(2.5)">
            <path
              fill={color}
              d="M30.79 20.247v-1.813c-3.349-1.335-5.321-2.581-5.928-4.568-0.498-1.631 1.004-3.801 3.836-6.416-2.958 1.621-5.135 2.722-5.997 1.185-0.774-1.38 0.093-3.966 1.464-7.357h-0.976c-1.094 1.731-2.025 3.044-2.371 2.72-0.301-0.283-0.305-1.301-0.174-2.72l-2.022-0.001c-1.338 2.997-2.757 4.695-4.812 4.986-1.756 0.249-4.029-1.814-6.59-4.742 1.458 2.894 1.994 5.215 1.011 5.788-1.162 0.678-3.491-0.121-6.939-1.569v0.662c2.372 1.506 4.557 2.975 4.149 3.522-0.358 0.48-1.992 0.397-4.149 0.105v1.709c3.121 1.576 4.812 3.193 4.812 4.707 0 1.302-2.601 3.961-4.812 6.067v1.011c1.995-0.654 4.443-0.908 5.265 0.558 0.839 1.495 0.276 3.611-0.802 6.695h1.848c1.958-2.645 3.819-4.766 4.812-4.672 0.703 0.066 0.375 2.225-0.105 4.672h0.558c1.743-4.845 3.892-7.814 7.078-7.706 2.796 0.096 5.449 2.91 8.368 4.916-1.526-1.867-4.337-4.526-3.731-5.021 0.637-0.521 3.367 0.432 6.207 1.464v-0.907c-1.863-1.271-3.576-2.492-3.138-2.929 0.394-0.393 1.596-0.456 3.138-0.349zM21.948 18.081c-0.335 0.334 1.759 1.577 2.956 2.438-1.81-0.632-4.092-1.582-4.518-1.234-0.308 0.252 1.12 1.603 1.897 2.553-1.485-1.021-2.845-2.448-4.267-2.496-2.092-0.071-3.29 2.442-4.323 6.282 0.272-1.823 1.089-4.679 0.502-4.733-0.833-0.078-2.846 2.892-4.351 5.106 1.051-3.185 2.006-5 1.367-6.139-0.577-1.029-2.744-0.403-3.682 0.143 1.105-1.043 3.447-3.141 3.447-4.025 0-1.286-2.32-2.733-6.599-3.951 2.572 0.405 5.888 1.149 6.275 0.631 0.303-0.405-2.192-1.813-3.71-2.811 2.672 1.146 4.365 1.92 5.122 1.479 0.5-0.292 0.222-1.47-0.52-2.942 1.303 1.489 2.471 2.538 3.364 2.411 1.884-0.267 2.698-2.76 4.166-7.518l0 0c-0.345 2.648-1.044 5.965-0.614 6.369 0.322 0.303 1.636-2.144 2.65-3.701-1.144 2.886-2.245 5.056-1.69 6.045 0.439 0.782 1.552 0.23 3.056-0.594-1.44 1.33-2.214 2.433-1.961 3.263 0.503 1.647 2.857 2.292 7.065 3.766-2.161-0.28-5.135-0.842-5.634-0.344z"
            />
          </g>
        </g>
      )}

      {variant === 'cross' && (
        /* Chunky plus-sign. Thick bars + small finial squares at each tip.
           No curves — fully rectangular for a blunt physical impact read. */
        <g
          style={{
            transformBox: 'fill-box' as React.CSSProperties['transformBox'],
            transformOrigin: 'center',
            animation: `${emphasis ? 'impact-final-core' : 'impact-core'} ${dur}ms ease-out forwards`,
          }}
        >
          {/* Vertical bar */}
          <rect x="44" y="20" width="12" height="60" fill={color} />
          {/* Horizontal bar */}
          <rect x="20" y="44" width="60" height="12" fill={color} />
          {/* Tip finials — small accent squares at each arm end */}
          <rect x="44" y="12" width="12" height="8" fill={color} />
          <rect x="44" y="80" width="12" height="8" fill={color} />
          <rect x="12"  y="44" width="8" height="12" fill={color} />
          <rect x="80" y="44" width="8" height="12" fill={color} />
        </g>
      )}

    </svg>
  )
}
