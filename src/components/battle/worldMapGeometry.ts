import type { ArenaListArena } from '@/types/domain'

export interface NodePosition {
  x: number
  y: number
}

export const MAP_CANVAS_W = 360
export const MAP_CANVAS_H = 520

export interface WorldMapLayout {
  width: number
  height: number
  nodeScale: number
}

export const DEFAULT_WORLD_MAP_LAYOUT: WorldMapLayout = {
  width: MAP_CANVAS_W,
  height: MAP_CANVAS_H,
  nodeScale: 1,
}

/** Zigzag x-fractions for up to 6 arenas. Extend if more are added. */
const X_PATTERN = [0.50, 0.28, 0.72, 0.50, 0.28, 0.72]

export function resolveNodePosition(
  arena: ArenaListArena,
  index: number,
  total: number,
  layout: WorldMapLayout = DEFAULT_WORLD_MAP_LAYOUT,
): NodePosition {
  if (arena.mapX !== null && arena.mapY !== null) {
    return { x: arena.mapX * layout.width, y: arena.mapY * layout.height }
  }
  const margin = Math.max(layout.height * 0.09, 58 * layout.nodeScale)
  const span = layout.height - margin * 2
  // index 0 = bottom, index N-1 = top
  const y = layout.height - margin - (index / Math.max(total - 1, 1)) * span
  const sideGutter = 58 * layout.nodeScale
  const rawX = layout.width * (X_PATTERN[index % X_PATTERN.length] ?? 0.5)
  const x = Math.min(Math.max(rawX, sideGutter), layout.width - sideGutter)
  return { x, y }
}
