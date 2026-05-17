import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import {
  clamp,
  DEFAULT_WORLD_MAP_LAYOUT,
  WORLD_MAP_HEADER_OFFSET,
  WORLD_MAP_MAX_NODE_SCALE,
  WORLD_MAP_MAX_WIDTH,
  WORLD_MAP_MIN_HEIGHT,
  WORLD_MAP_MIN_NODE_SCALE,
  WORLD_MAP_VERTICAL_SPACING,
  WORLD_MAP_WIDTH_SCALE_BASE,
} from './worldMapLayout'
import type { WorldMapLayout } from './worldMapLayout'

function getWorldMapLayout(nodeCount: number): WorldMapLayout {
  if (typeof window === 'undefined') return DEFAULT_WORLD_MAP_LAYOUT

  const visualViewport = window.visualViewport
  const viewportWidth = visualViewport?.width ?? window.innerWidth
  const viewportHeight = visualViewport?.height ?? window.innerHeight

  const width = Math.round(Math.min(viewportWidth, WORLD_MAP_MAX_WIDTH))
  const nodeScale = Number(clamp(
    width / WORLD_MAP_WIDTH_SCALE_BASE,
    WORLD_MAP_MIN_NODE_SCALE,
    WORLD_MAP_MAX_NODE_SCALE,
  ).toFixed(3))

  const height = nodeCount > 0
    ? Math.max(Math.round(nodeCount * WORLD_MAP_VERTICAL_SPACING * nodeScale), WORLD_MAP_MIN_HEIGHT)
    : DEFAULT_WORLD_MAP_LAYOUT.height

  const panelHeight = Math.max(viewportHeight - WORLD_MAP_HEADER_OFFSET, WORLD_MAP_MIN_HEIGHT)

  return { width, height, nodeScale, panelHeight }
}

/**
 * Computes the world map layout.
 * When nodeCount > 0 the map height is computed from vertical spacing per node
 * (making the map scrollable). When nodeCount is 0 or omitted the old
 * fixed-height behaviour is preserved for backwards compatibility.
 */
export function useMobileWorldMapLayout(
  wrapperRef: RefObject<HTMLDivElement | null>,
  nodeCount = 0,
) {
  const [layout, setLayout] = useState<WorldMapLayout>(() => getWorldMapLayout(nodeCount))

  useEffect(() => {
    let frame = 0

    const updateLayout = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = getWorldMapLayout(nodeCount)

        setLayout((current) => {
          if (
            current.width === next.width &&
            current.height === next.height &&
            current.nodeScale === next.nodeScale
          ) {
            return current
          }
          return next
        })
      })
    }

    updateLayout()
    window.addEventListener('resize', updateLayout)
    window.addEventListener('orientationchange', updateLayout)
    window.visualViewport?.addEventListener('resize', updateLayout)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateLayout)
      window.removeEventListener('orientationchange', updateLayout)
      window.visualViewport?.removeEventListener('resize', updateLayout)
    }
  }, [wrapperRef, nodeCount])

  return layout
}
