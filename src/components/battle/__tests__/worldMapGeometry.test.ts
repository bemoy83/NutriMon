import { describe, expect, it } from 'vitest'
import type { TerrainDescriptor } from '@/lib/sprites'
import type { ArenaListArena } from '@/types/domain'
import { resolveNodePosition } from '../worldMapGeometry'
import { DEFAULT_PLATFORM_CALIBRATION, getHubPlatformMetrics } from '../worldMapLayout'
import type { WorldMapLayout } from '../worldMapLayout'

const layout: WorldMapLayout = {
  width: 400,
  height: 620,
  nodeScale: 1,
}

function arena(overrides: Partial<ArenaListArena> = {}): ArenaListArena {
  return {
    id: 'arena-id',
    arenaKey: 'test-arena',
    name: 'Test Arena',
    description: null,
    sortOrder: 1,
    isActive: true,
    unlockRequiresBossOpponentId: null,
    unlockBossName: null,
    mapX: null,
    mapY: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    opponentCount: 3,
    defeatedCount: 0,
    isUnlocked: true,
    hasActiveRun: false,
    ...overrides,
  }
}

function terrain(overrides: Partial<TerrainDescriptor> = {}): TerrainDescriptor {
  return {
    playerPlatformUrl: null,
    playerPlatformRenderedWidth: null,
    opponentPlatformUrl: null,
    opponentPlatformWidth: null,
    ...overrides,
  }
}

describe('world map geometry', () => {
  it('generates evenly spaced vertical positions', () => {
    const positions = [0, 1, 2].map((index) => resolveNodePosition(arena(), index, 3, layout))

    expect(positions[0].y - positions[1].y).toBeCloseTo(positions[1].y - positions[2].y)
  })

  it('uses explicit map coordinates when both mapX and mapY are set', () => {
    const position = resolveNodePosition(arena({ mapX: 0.25, mapY: 0.75 }), 0, 3, layout)

    expect(position).toEqual({ x: 100, y: 465 })
  })

  it('uses the current generated route x pattern for the first three arenas', () => {
    const positions = [0, 1, 2].map((index) => resolveNodePosition(arena(), index, 3, layout))

    expect(positions.map((position) => position.x / layout.width)).toEqual([0.5, 0.3, 0.58])
  })

  it('clamps generated x positions to the side gutter on narrow layouts', () => {
    const narrowLayout: WorldMapLayout = {
      width: 160,
      height: 620,
      nodeScale: 1,
    }

    const position = resolveNodePosition(arena(), 1, 3, narrowLayout)

    expect(position.x).toBe(58)
  })
})

describe('world map layout metrics', () => {
  it('uses terrain platform width and calibration when available', () => {
    const metrics = getHubPlatformMetrics(
      terrain({
        opponentPlatformWidth: 224,
        opponentCalibration: { nativeH: 300, ovalSurfaceY: 0.5 },
      }),
      1.25,
    )

    expect(metrics.width).toBe(224 * 0.64 * 1.25)
    expect(metrics.height).toBe(Math.round(metrics.width * 300 / 512))
    expect(metrics.calibration).toEqual({ nativeH: 300, ovalSurfaceY: 0.5 })
  })

  it('falls back to default platform metrics when terrain has no platform data', () => {
    const metrics = getHubPlatformMetrics(terrain(), 0.75)

    expect(metrics.width).toBe(136 * 0.75)
    expect(metrics.height).toBe(Math.round(metrics.width * DEFAULT_PLATFORM_CALIBRATION.nativeH / 512))
    expect(metrics.calibration).toBe(DEFAULT_PLATFORM_CALIBRATION)
  })
})
