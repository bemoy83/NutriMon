import { DEFAULT_WORLD_MAP_LAYOUT } from './worldMapLayout'
import type { WorldMapLayout } from './worldMapLayout'

export interface NodePosition {
  x: number
  y: number
}

/** Minimal shape required for position resolution — accepts ArenaListArena or WorldMapOpponentNode. */
interface MapNode {
  mapX: number | null
  mapY: number | null
}

/** Center-to-side route pattern with a mild rightward climb after the first side step. */
const X_PATTERN = [0.50, 0.30, 0.58, 0.70, 0.50, 0.30]

/** 5-step winding pattern used when nodes are grouped into biomes of 5.
 *  Node 0 (biome entry) and node 4 (boss) are near center so cross-biome
 *  path segments stay roughly vertical. */
const X_PATTERN_5 = [0.50, 0.26, 0.70, 0.28, 0.54]

export function resolveNodePosition(
  node: MapNode,
  index: number,
  total: number,
  layout: WorldMapLayout = DEFAULT_WORLD_MAP_LAYOUT,
  groupSize?: number,
): NodePosition {
  if (node.mapX !== null && node.mapY !== null) {
    return { x: node.mapX * layout.width, y: node.mapY * layout.height }
  }

  const sideGutter = 58 * layout.nodeScale

  if (groupSize && groupSize > 1) {
    const biomeCount = Math.ceil(total / groupSize)
    const biomeIndex = Math.floor(index / groupSize)
    const posInBiome = index % groupSize
    const actualGroupSize = Math.min(groupSize, total - biomeIndex * groupSize)

    const biomeH = layout.height / biomeCount
    const biomePad = biomeH * 0.10
    const biomeBottom = layout.height - biomeIndex * biomeH
    const biomeSpan = biomeH - biomePad * 2

    // posInBiome 0 = bottom of biome, top = boss
    const y = biomeBottom - biomePad - (posInBiome / Math.max(actualGroupSize - 1, 1)) * biomeSpan

    const rawX = layout.width * (X_PATTERN_5[posInBiome % X_PATTERN_5.length] ?? 0.5)
    const x = Math.min(Math.max(rawX, sideGutter), layout.width - sideGutter)
    return { x, y }
  }

  const margin = Math.max(layout.height * 0.07, 50 * layout.nodeScale)
  const span = layout.height - margin * 2
  // index 0 = bottom, index N-1 = top
  const y = layout.height - margin - (index / Math.max(total - 1, 1)) * span
  const rawX = layout.width * (X_PATTERN[index % X_PATTERN.length] ?? 0.5)
  const x = Math.min(Math.max(rawX, sideGutter), layout.width - sideGutter)
  return { x, y }
}
