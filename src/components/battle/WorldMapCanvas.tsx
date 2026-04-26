import { getArenaTerrain, getPlayerBattleSpriteDescriptor } from '@/lib/sprites'
import type { ArenaListArena, CreatureCompanion } from '@/types/domain'
import { WorldMapArenaNode } from './WorldMapArenaNode'
import { WorldMapPathSegment } from './WorldMapPathSegment'
import { MAP_CANVAS_H, MAP_CANVAS_W, resolveNodePosition } from './worldMapGeometry'
import type { NodePosition } from './worldMapGeometry'

interface WorldMapCanvasProps {
  arenas: ArenaListArena[]
  companion: CreatureCompanion | null
  onSelectArena: (id: string, name: string) => void
}

// ── Terrain zone bands ────────────────────────────────────────────────────────
// Each arena gets a vertical band of canvas height. A radial gradient centred
// on the node creates a biome-coloured glow zone — faint on the dark bg but
// enough to divide the canvas into visually distinct elevation tiers.

interface Band {
  arenaId: string
  accent: string
  nodePos: NodePosition
  top: number
  bottom: number
}

function computeBands(
  sorted: ArenaListArena[],
  positions: NodePosition[],
): Band[] {
  return sorted.map((arena, i) => {
    const pos = positions[i]
    const above = positions[i + 1] // higher y index = higher on screen (smaller y)
    const below = positions[i - 1] // lower y index = lower on screen (larger y)

    const top = above ? (pos.y + above.y) / 2 : 0
    const bottom = below ? (pos.y + below.y) / 2 : MAP_CANVAS_H

    const terrain = getArenaTerrain(arena.id)
    return { arenaId: arena.id, accent: terrain.accentColor ?? '#6b7280', nodePos: pos, top, bottom }
  })
}

function TerrainBands({ bands }: { bands: Band[] }) {
  return (
    <g>
      <defs>
        {bands.map(({ arenaId, accent, nodePos }) => (
          <radialGradient
            key={arenaId}
            id={`zone-${arenaId}`}
            cx={nodePos.x}
            cy={nodePos.y}
            r={200}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor={accent} stopOpacity={0.22} />
            <stop offset="55%"  stopColor={accent} stopOpacity={0.07} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </radialGradient>
        ))}
        {bands.map(({ arenaId, top, bottom }) => (
          <clipPath key={arenaId} id={`clip-zone-${arenaId}`}>
            <rect x={0} y={top} width={MAP_CANVAS_W} height={bottom - top} />
          </clipPath>
        ))}
      </defs>

      {/* Zone fill rects — each clipped to its vertical band */}
      {bands.map(({ arenaId }) => (
        <rect
          key={arenaId}
          x={0} y={0}
          width={MAP_CANVAS_W}
          height={MAP_CANVAS_H}
          fill={`url(#zone-${arenaId})`}
          clipPath={`url(#clip-zone-${arenaId})`}
        />
      ))}

      {/* Subtle divider lines at band boundaries */}
      {bands.slice(0, -1).map(({ arenaId, bottom }) => (
        <line
          key={`div-${arenaId}`}
          x1={0} y1={bottom}
          x2={MAP_CANVAS_W} y2={bottom}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
    </g>
  )
}

export function WorldMapCanvas({ arenas, companion, onSelectArena }: WorldMapCanvasProps) {
  const sorted = [...arenas].sort((a, b) => a.sortOrder - b.sortOrder)
  const positions = sorted.map((arena, i) => resolveNodePosition(arena, i, sorted.length))
  const bands = computeBands(sorted, positions)

  const currentArena = sorted.find(
    (a) => a.isUnlocked && (a.opponentCount === 0 || a.defeatedCount < a.opponentCount),
  ) ?? sorted.filter((a) => a.isUnlocked).at(-1) ?? null

  const companionSprite = companion
    ? getPlayerBattleSpriteDescriptor(companion.stage, companion.currentCondition)
    : null

  return (
    <>
      <style>{`
        @keyframes worldmap-pulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%       { opacity: 0.80; transform: scale(1.12); }
        }
        @keyframes worldmap-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: MAP_CANVAS_W, margin: '0 auto' }}>
        <svg
          viewBox={`0 0 ${MAP_CANVAS_W} ${MAP_CANVAS_H}`}
          width="100%"
          style={{ display: 'block', overflow: 'visible' }}
          aria-label="Arena world map"
        >
          {/* Layer 1: terrain zone bands */}
          <TerrainBands bands={bands} />

          {/* Layer 2: path connectors */}
          {sorted.map((arena, i) => {
            if (i === 0) return null
            const prevArena = sorted[i - 1]
            const terrain = getArenaTerrain(prevArena.id)
            return (
              <WorldMapPathSegment
                key={`path-${arena.id}`}
                from={positions[i - 1]}
                to={positions[i]}
                isUnlocked={arena.isUnlocked}
                accentColor={terrain.accentColor ?? '#6b7280'}
              />
            )
          })}

          {/* Layer 3: arena nodes */}
          {sorted.map((arena, i) => (
            <WorldMapArenaNode
              key={arena.id}
              arena={arena}
              position={positions[i]}
              isCurrent={arena.id === currentArena?.id}
              onClick={
                arena.isUnlocked
                  ? () => onSelectArena(arena.id, arena.name)
                  : undefined
              }
            />
          ))}

          {/* Layer 4: companion marker */}
          {currentArena && (() => {
            const idx = sorted.findIndex((a) => a.id === currentArena.id)
            const pos = positions[idx]
            if (!pos) return null
            const MARKER_SIZE = 40
            // Platform is 96×45px centred on pos. Surface sits at ovalSurfaceY≈97/240
            // from the platform's top edge. Land the companion's feet there.
            const PLATFORM_W = 96
            const PLATFORM_H = Math.round(PLATFORM_W * 240 / 512)
            const platformTop = pos.y - PLATFORM_H / 2
            const surfaceY = platformTop + PLATFORM_H * (97 / 240)
            const markerX = pos.x - MARKER_SIZE / 2
            const markerY = surfaceY - MARKER_SIZE

            return (
              <g transform={`translate(${markerX} ${markerY})`}>
                <g style={{ animation: 'worldmap-float 3s ease-in-out infinite' }}>
                  {companionSprite ? (
                    <>
                      <image
                        href={companionSprite.url}
                        width={MARKER_SIZE}
                        height={MARKER_SIZE}
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <ellipse
                        cx={MARKER_SIZE / 2}
                        cy={MARKER_SIZE + 2}
                        rx={8} ry={3}
                        fill="rgba(0,0,0,0.35)"
                      />
                    </>
                  ) : (
                    <>
                      <circle cx={MARKER_SIZE / 2} cy={MARKER_SIZE / 2} r={MARKER_SIZE / 2} fill="rgba(124,58,237,0.85)" />
                      <text
                        x={MARKER_SIZE / 2} y={MARKER_SIZE / 2}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize={13} fontWeight={700} fill="white"
                      >
                        {companion?.name?.[0]?.toUpperCase() ?? '?'}
                      </text>
                    </>
                  )}
                </g>
              </g>
            )
          })()}
        </svg>
      </div>
    </>
  )
}
