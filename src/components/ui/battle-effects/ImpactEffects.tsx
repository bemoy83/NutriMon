import { ImpactGraphic, type ImpactVariant } from '../ImpactGraphic'

export interface ImpactColor {
  stroke: string
  glowFilter: string
}

export interface HitImpact {
  id: number
  isCrit: boolean
  delayMs: number
  xPct: number
  yPct: number
  variant: ImpactVariant
  angle: number
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
          style={{
            position: 'absolute',
            top: `${h.yPct}%`,
            left: `${h.xPct}%`,
            width: impactPx,
            height: impactPx,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <ImpactGraphic
            variant={h.variant}
            size={impactPx}
            isCrit={h.isCrit}
            angle={h.angle}
            impactColor={h.impactColor}
          />
        </div>
      ))}
    </>
  )
}
