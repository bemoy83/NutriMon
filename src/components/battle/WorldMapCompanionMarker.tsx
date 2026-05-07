import type { RefObject } from 'react'
import { getPlayerWorldMapSpriteDescriptor } from '@/lib/sprites'
import type { CreatureCompanion } from '@/types/domain'
import type { NodePosition } from './worldMapGeometry'
import {
  COMPANION_MARKER_SIZE,
  WORLD_MAP_NODE_R,
} from './worldMapLayout'
import type { WorldMapLayout } from './worldMapLayout'

interface WorldMapCompanionMarkerProps {
  companion: CreatureCompanion | null
  position: NodePosition
  layout: WorldMapLayout
  /** Ref forwarded to the outer <g> so the parent can drive the transform during travel. */
  outerRef?: RefObject<SVGGElement | null>
}

export function WorldMapCompanionMarker({
  companion,
  position,
  layout,
  outerRef,
}: WorldMapCompanionMarkerProps) {
  const companionSprite = companion
    ? getPlayerWorldMapSpriteDescriptor(companion.stage, companion.currentCondition)
    : null
  const markerSize = COMPANION_MARKER_SIZE * layout.nodeScale
  const nodeR = WORLD_MAP_NODE_R * layout.nodeScale

  // Southwest of the opponent node — companion faces right (east), opponent is NE.
  // Right edge of companion overlaps the opponent's left edge by ~¼ nodeR.
  const offsetX = -(markerSize + nodeR * 0.75)
  const offsetY = nodeR * 0.5 - markerSize / 2

  return (
    // Outer <g> anchored at the node center in SVG user units.
    // The parent rAF loop animates this element's transform directly.
    <g ref={outerRef} transform={`translate(${position.x} ${position.y})`}>
      <g transform={`translate(${offsetX} ${offsetY})`}>
        <g>
          {companionSprite ? (
            <>
              <image
                href={companionSprite.url}
                width={markerSize}
                height={markerSize}
                style={{ imageRendering: 'pixelated' }}
              />
              <ellipse
                cx={markerSize / 2}
                cy={markerSize + 2 * layout.nodeScale}
                rx={12 * layout.nodeScale} ry={4 * layout.nodeScale}
                fill="rgba(0,0,0,0.35)"
              />
            </>
          ) : (
            <>
              <circle cx={markerSize / 2} cy={markerSize / 2} r={markerSize / 2} fill="rgba(124,58,237,0.85)" />
              <text
                x={markerSize / 2} y={markerSize / 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize={18 * layout.nodeScale} fontWeight={700} fill="white"
              >
                {companion?.name?.[0]?.toUpperCase() ?? '?'}
              </text>
            </>
          )}
        </g>
      </g>
    </g>
  )
}
