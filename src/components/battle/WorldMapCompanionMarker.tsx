import type { RefObject } from 'react'
import { getArenaTerrain, getPlayerBattleSpriteDescriptor } from '@/lib/sprites'
import type { CreatureCompanion } from '@/types/domain'
import type { NodePosition } from './worldMapGeometry'
import {
  COMPANION_MARKER_SIZE,
  getHubPlatformMetrics,
} from './worldMapLayout'
import type { WorldMapLayout } from './worldMapLayout'

interface WorldMapCompanionMarkerProps {
  companion: CreatureCompanion | null
  /** Arena ID used for terrain lookup — accepts either an ArenaListArena.id or WorldMapOpponentNode.arenaId. */
  arenaId: string
  position: NodePosition
  layout: WorldMapLayout
  /** Ref forwarded to the outer <g> so the parent can drive the transform during travel. */
  outerRef?: RefObject<SVGGElement | null>
}

export function WorldMapCompanionMarker({
  companion,
  arenaId,
  position,
  layout,
  outerRef,
}: WorldMapCompanionMarkerProps) {
  const companionSprite = companion
    ? getPlayerBattleSpriteDescriptor(companion.stage, companion.currentCondition)
    : null
  const terrain = getArenaTerrain(arenaId)
  const platform = getHubPlatformMetrics(terrain, layout.nodeScale)
  const markerSize = COMPANION_MARKER_SIZE * layout.nodeScale
  const platformTop = position.y - platform.height / 2
  const surfaceY = platformTop + platform.height * platform.calibration.ovalSurfaceY

  // Offsets from node center — consistent with where the rAF travel loop ends.
  const offsetX = -markerSize / 2
  const offsetY = surfaceY - markerSize - position.y

  return (
    // Outer <g> anchored at the node center in SVG user units.
    // The parent rAF loop animates this element's transform directly.
    <g ref={outerRef} transform={`translate(${position.x} ${position.y})`}>
      <g transform={`translate(${offsetX} ${offsetY})`}>
        <g style={{ animation: 'worldmap-float 3s ease-in-out infinite' }}>
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
