import type { ArenaListArena } from '@/types/domain'

export interface NodePosition {
  x: number
  y: number
}

export const MAP_CANVAS_W = 360
export const MAP_CANVAS_H = 520

/** Zigzag x-fractions for up to 6 arenas. Extend if more are added. */
const X_PATTERN = [0.50, 0.28, 0.72, 0.50, 0.28, 0.72]

export function resolveNodePosition(
  arena: ArenaListArena,
  index: number,
  total: number,
): NodePosition {
  if (arena.mapX !== null && arena.mapY !== null) {
    return { x: arena.mapX * MAP_CANVAS_W, y: arena.mapY * MAP_CANVAS_H }
  }
  const margin = MAP_CANVAS_H * 0.10
  const span = MAP_CANVAS_H - margin * 2
  // index 0 = bottom, index N-1 = top
  const y = MAP_CANVAS_H - margin - (index / Math.max(total - 1, 1)) * span
  const x = MAP_CANVAS_W * (X_PATTERN[index % X_PATTERN.length] ?? 0.5)
  return { x, y }
}
