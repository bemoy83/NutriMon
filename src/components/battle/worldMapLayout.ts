import type { PlatformCalibration, TerrainDescriptor } from '@/lib/sprites'

export const MAP_CANVAS_W = 360
export const MAP_CANVAS_H = 520
/** Vertical spacing per node (px at nodeScale 1) for the scrollable 25-node map. */
export const WORLD_MAP_VERTICAL_SPACING = 96

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

export const WORLD_MAP_MAX_WIDTH = 480
export const WORLD_MAP_BOTTOM_RESERVED_PX = 88
export const WORLD_MAP_MIN_HEIGHT = 320
export const WORLD_MAP_MAX_HEIGHT = 760
export const WORLD_MAP_WIDTH_SCALE_BASE = 390
export const WORLD_MAP_HEIGHT_SCALE_BASE = 620
export const WORLD_MAP_MIN_NODE_SCALE = 0.72
export const WORLD_MAP_MAX_NODE_SCALE = 1.22

export const HUB_PLATFORM_SCALE = 0.64
export const FALLBACK_PLATFORM_W = 136
export const COMPANION_MARKER_SIZE = 64
export const ARENA_LABEL_FONT_SIZE = 12
export const ARENA_META_FONT_SIZE = 10

export const DEFAULT_PLATFORM_CALIBRATION: PlatformCalibration = {
  nativeH: 240,
  ovalSurfaceY: 97 / 240,
}

export interface HubPlatformMetrics {
  width: number
  height: number
  calibration: PlatformCalibration
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getHubPlatformMetrics(
  terrain: TerrainDescriptor,
  nodeScale: number,
): HubPlatformMetrics {
  const platformBaseW = terrain.opponentPlatformWidth
    ? terrain.opponentPlatformWidth * HUB_PLATFORM_SCALE
    : FALLBACK_PLATFORM_W
  const calibration = terrain.opponentCalibration ?? DEFAULT_PLATFORM_CALIBRATION
  const width = platformBaseW * nodeScale
  const height = Math.round(width * calibration.nativeH / 512)

  return { width, height, calibration }
}
