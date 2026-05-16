import { ImpactGraphic, type ImpactVariant } from '../ImpactGraphic'

export interface ImpactColor {
  stroke: string
  glowFilter: string
}

export interface ImpactSparkItem {
  angle: number
  innerPx: number
  lenPx: number
  thickPx: number
  delayMs: number
}

export interface HitImpact {
  id: number
  isCrit: boolean
  delayMs: number
  xPct: number
  yPct: number
  variant: ImpactVariant
  angle: number
  emphasis?: boolean
  sparkItems?: ImpactSparkItem[]
  impactColor?: ImpactColor
}

export function ImpactEffects({
  impacts,
  impactPx,
}: {
  impacts: HitImpact[]
  impactPx: number
}) {
  return (
    <>
      {impacts.map((h) => (
        <div
          key={h.id}
          data-testid="battle-attack-impact"
          data-emphasis={h.emphasis ? 'true' : undefined}
          style={{
            position: 'absolute',
            top: `${h.yPct}%`,
            left: `${h.xPct}%`,
            width: h.emphasis ? Math.round(impactPx * 1.18) : impactPx,
            height: h.emphasis ? Math.round(impactPx * 1.18) : impactPx,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <ImpactGraphic
            variant={h.variant}
            size={h.emphasis ? Math.round(impactPx * 1.18) : impactPx}
            isCrit={h.isCrit}
            angle={h.angle}
            emphasis={h.emphasis}
            impactColor={h.impactColor}
          />
          {h.sparkItems && (
            <div
              data-testid="battle-hit-spark"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 0,
                height: 0,
                pointerEvents: 'none',
              }}
            >
              {h.sparkItems.map((spark, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: 0,
                    height: 0,
                    transform: `rotate(${spark.angle}deg) translateX(${spark.innerPx}px)`,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: spark.lenPx,
                      height: spark.thickPx,
                      marginTop: -spark.thickPx / 2,
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,220,0.88) 25%, rgba(255,255,220,0.88) 75%, transparent)',
                      borderRadius: 99,
                      transformOrigin: '0 50%',
                      filter: 'drop-shadow(0 0 2px rgba(255,255,200,0.7))',
                      animation: `battle-hit-spark-in 460ms cubic-bezier(0.2,0.85,0.3,1) ${spark.delayMs}ms forwards`,
                      opacity: 0,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  )
}
