import type { ArenaListArena } from '@/types/domain'
import { DEFAULT_WORLD_MAP_LAYOUT } from './worldMapLayout'
import type { WorldMapLayout } from './worldMapLayout'

export interface NodePosition {
  x: number
  y: number
}

/** Center-to-side route pattern with a mild rightward climb after the first side step. */
const X_PATTERN = [0.50, 0.30, 0.58, 0.70, 0.50, 0.30]

export function resolveNodePosition(
  arena: ArenaListArena,
  index: number,
  total: number,
  layout: WorldMapLayout = DEFAULT_WORLD_MAP_LAYOUT,
): NodePosition {
  if (arena.mapX !== null && arena.mapY !== null) {
    return { x: arena.mapX * layout.width, y: arena.mapY * layout.height }
  }
  const margin = Math.max(layout.height * 0.07, 50 * layout.nodeScale)
  const span = layout.height - margin * 2
  // index 0 = bottom, index N-1 = top
  const y = layout.height - margin - (index / Math.max(total - 1, 1)) * span
  const sideGutter = 58 * layout.nodeScale
  const rawX = layout.width * (X_PATTERN[index % X_PATTERN.length] ?? 0.5)
  const x = Math.min(Math.max(rawX, sideGutter), layout.width - sideGutter)
  return { x, y }
}
