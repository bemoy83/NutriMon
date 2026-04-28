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
}

export function WorldMapCompanionMarker({
  companion,
  arenaId,
  position,
  layout,
}: WorldMapCompanionMarkerProps) {
  const companionSprite = companion
    ? getPlayerBattleSpriteDescriptor(companion.stage, companion.currentCondition)
    : null
  const terrain = getArenaTerrain(arenaId)
  const platform = getHubPlatformMetrics(terrain, layout.nodeScale)
  const markerSize = COMPANION_MARKER_SIZE * layout.nodeScale
  const platformTop = position.y - platform.height / 2
  const surfaceY = platformTop + platform.height * platform.calibration.ovalSurfaceY
  const markerX = position.x - markerSize / 2
  const markerY = surfaceY - markerSize

  return (
    <g transform={`translate(${markerX} ${markerY})`}>
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
  )
}
