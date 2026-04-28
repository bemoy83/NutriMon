import { getArenaTerrain } from '@/lib/sprites'
import type { ArenaListArena, WorldMapOpponentNode } from '@/types/domain'
import type { NodePosition } from './worldMapGeometry'
import type { WorldMapLayout } from './worldMapLayout'

interface Band {
  arenaId: string
  accent: string
  nodePos: NodePosition
  top: number
  bottom: number
}

interface WorldMapTerrainBandsArenaProps {
  arenas: ArenaListArena[]
  positions: NodePosition[]
  layout: WorldMapLayout
  nodes?: undefined
}

interface WorldMapTerrainBandsNodeProps {
  nodes: WorldMapOpponentNode[]
  positions: NodePosition[]
  layout: WorldMapLayout
  arenas?: undefined
}

type WorldMapTerrainBandsProps = WorldMapTerrainBandsArenaProps | WorldMapTerrainBandsNodeProps

function computeBandsFromArenas(
  sorted: ArenaListArena[],
  positions: NodePosition[],
  layout: WorldMapLayout,
): Band[] {
  return sorted.map((arena, i) => {
    const pos = positions[i]
    const above = positions[i + 1]
    const below = positions[i - 1]

    const top = above ? (pos.y + above.y) / 2 : 0
    const bottom = below ? (pos.y + below.y) / 2 : layout.height

    const terrain = getArenaTerrain(arena.id)
    return { arenaId: arena.id, accent: terrain.accentColor ?? '#6b7280', nodePos: pos, top, bottom }
  })
}

function computeBandsFromNodes(
  nodes: WorldMapOpponentNode[],
  positions: NodePosition[],
  layout: WorldMapLayout,
): Band[] {
  // Group nodes by arenaSortOrder, compute one band per biome spanning all its nodes.
  const biomeMap = new Map<number, { arenaId: string; indices: number[] }>()
  nodes.forEach((node, i) => {
    const entry = biomeMap.get(node.arenaSortOrder)
    if (entry) {
      entry.indices.push(i)
    } else {
      biomeMap.set(node.arenaSortOrder, { arenaId: node.arenaId, indices: [i] })
    }
  })

  const sortedBiomes = Array.from(biomeMap.entries()).sort(([a], [b]) => a - b)

  return sortedBiomes.map(([, { arenaId, indices }], biomeIdx) => {
    const firstIdx = indices[0]
    const lastIdx = indices[indices.length - 1]
    const midIdx = indices[Math.floor(indices.length / 2)]

    const firstPos = positions[firstIdx]
    const lastPos = positions[lastIdx]
    const midPos = positions[midIdx]

    const prevBiome = sortedBiomes[biomeIdx - 1]
    const nextBiome = sortedBiomes[biomeIdx + 1]

    const prevLastPos = prevBiome
      ? positions[prevBiome[1].indices[prevBiome[1].indices.length - 1]]
      : null
    const nextFirstPos = nextBiome
      ? positions[nextBiome[1].indices[0]]
      : null

    // top = midpoint between previous biome's last node and this biome's first node
    const top = prevLastPos ? (lastPos.y + prevLastPos.y) / 2 : 0
    // bottom = midpoint between this biome's last node and next biome's first node
    const bottom = nextFirstPos ? (firstPos.y + nextFirstPos.y) / 2 : layout.height

    const terrain = getArenaTerrain(arenaId)
    return { arenaId, accent: terrain.accentColor ?? '#6b7280', nodePos: midPos, top, bottom }
  })
}

export function WorldMapTerrainBands({ arenas, nodes, positions, layout }: WorldMapTerrainBandsProps) {
  const bands = nodes
    ? computeBandsFromNodes(nodes, positions, layout)
    : computeBandsFromArenas(arenas!, positions, layout)

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
