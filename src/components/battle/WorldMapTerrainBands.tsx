import { getArenaTerrain } from '@/lib/sprites'
import type { ArenaListArena } from '@/types/domain'
import type { NodePosition } from './worldMapGeometry'
import type { WorldMapLayout } from './worldMapLayout'

interface Band {
  arenaId: string
  accent: string
  nodePos: NodePosition
  top: number
  bottom: number
}

interface WorldMapTerrainBandsProps {
  arenas: ArenaListArena[]
  positions: NodePosition[]
  layout: WorldMapLayout
}

function computeBands(
  sorted: ArenaListArena[],
  positions: NodePosition[],
  layout: WorldMapLayout,
): Band[] {
  return sorted.map((arena, i) => {
    const pos = positions[i]
    const above = positions[i + 1] // higher y index = higher on screen (smaller y)
    const below = positions[i - 1] // lower y index = lower on screen (larger y)

    const top = above ? (pos.y + above.y) / 2 : 0
    const bottom = below ? (pos.y + below.y) / 2 : layout.height

    const terrain = getArenaTerrain(arena.id)
    return { arenaId: arena.id, accent: terrain.accentColor ?? '#6b7280', nodePos: pos, top, bottom }
  })
}

export function WorldMapTerrainBands({ arenas, positions, layout }: WorldMapTerrainBandsProps) {
  const bands = computeBands(arenas, positions, layout)

  return (
    <g>
      <defs>
        {bands.map(({ arenaId, accent, nodePos, top, bottom }) => {
          const height = Math.max(bottom - top, 1)
          const feather = Math.min(86, height * 0.62)
          const topFade = Math.max(0, top - feather)
          const topBody = top + Math.min(feather, (nodePos.y - top) * 0.75)
          const bottomBody = bottom - Math.min(feather, (bottom - nodePos.y) * 0.75)
          const bottomFade = Math.min(layout.height, bottom + feather)
          const toOffset = (y: number) => `${(y / layout.height) * 100}%`

          return (
            <linearGradient
              key={arenaId}
              id={`zone-${arenaId}`}
              x1={0}
              y1={0}
              x2={0}
              y2={layout.height}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={accent} stopOpacity={0} />
              <stop offset={toOffset(topFade)} stopColor={accent} stopOpacity={0} />
              <stop offset={toOffset(topBody)} stopColor={accent} stopOpacity={0.09} />
              <stop offset={toOffset(nodePos.y)} stopColor={accent} stopOpacity={0.18} />
              <stop offset={toOffset(bottomBody)} stopColor={accent} stopOpacity={0.09} />
              <stop offset={toOffset(bottomFade)} stopColor={accent} stopOpacity={0} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          )
        })}
      </defs>

      {/* Full-width feathered terrain zones. Adjacent zones overlap to avoid hard seams. */}
      {bands.map(({ arenaId }) => (
        <rect
          key={arenaId}
          x={0}
          y={0}
          width={layout.width}
          height={layout.height}
          fill={`url(#zone-${arenaId})`}
        />
      ))}
    </g>
  )
}
