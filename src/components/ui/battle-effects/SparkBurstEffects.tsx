export interface SparkParticle {
  angleDeg: number
  travelPx: number  // CSS px to travel outward along the rotated X axis
  sizePx: number    // CSS px side length of the square chip
  delayMs: number
}

export interface SparkBurstEffect {
  id: number
  xPct: number
  yPct: number
  particles: SparkParticle[]
  durationMs: number
  color?: string
}

export function SparkBurstEffects({ bursts }: { bursts: SparkBurstEffect[] }) {
  return (
    <>
      {bursts.map((burst) => (
        <div
          key={burst.id}
          style={{
            position: 'absolute',
            left: `${burst.xPct}%`,
            top: `${burst.yPct}%`,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
        >
          {burst.particles.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `rotate(${p.angleDeg}deg)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: -p.sizePx / 2,
                  width: p.sizePx,
                  height: p.sizePx,
                  background: burst.color ?? '#fde047',
                  filter: `drop-shadow(0 0 2px ${burst.color ?? '#fde047'}) drop-shadow(0 0 5px ${burst.color ?? '#fde047'})`,
                  imageRendering: 'pixelated',
                  animationName: 'spark-fly',
                  animationDuration: `${burst.durationMs}ms`,
                  animationTimingFunction: 'steps(5, end)',
                  animationFillMode: 'both',
                  animationDelay: `${p.delayMs}ms`,
                  ['--spark-travel' as string]: `${p.travelPx}px`,
                } as React.CSSProperties}
              />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
