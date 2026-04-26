import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import {
  clamp,
  DEFAULT_WORLD_MAP_LAYOUT,
  WORLD_MAP_BOTTOM_RESERVED_PX,
  WORLD_MAP_HEIGHT_SCALE_BASE,
  WORLD_MAP_MAX_HEIGHT,
  WORLD_MAP_MAX_NODE_SCALE,
  WORLD_MAP_MAX_WIDTH,
  WORLD_MAP_MIN_HEIGHT,
  WORLD_MAP_MIN_NODE_SCALE,
  WORLD_MAP_WIDTH_SCALE_BASE,
} from './worldMapLayout'
import type { WorldMapLayout } from './worldMapLayout'

export function useMobileWorldMapLayout(wrapperRef: RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState<WorldMapLayout>(DEFAULT_WORLD_MAP_LAYOUT)

  useEffect(() => {
    let frame = 0

    const updateLayout = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const visualViewport = window.visualViewport
        const viewportWidth = visualViewport?.width ?? window.innerWidth
        const viewportHeight = visualViewport?.height ?? window.innerHeight
        const top = wrapperRef.current?.getBoundingClientRect().top ?? 0

        const width = Math.round(Math.min(viewportWidth, WORLD_MAP_MAX_WIDTH))
        const availableHeight = viewportHeight - top - WORLD_MAP_BOTTOM_RESERVED_PX
        const height = Math.round(clamp(availableHeight, WORLD_MAP_MIN_HEIGHT, WORLD_MAP_MAX_HEIGHT))
        const nodeScale = Number(clamp(
          Math.min(width / WORLD_MAP_WIDTH_SCALE_BASE, height / WORLD_MAP_HEIGHT_SCALE_BASE),
          WORLD_MAP_MIN_NODE_SCALE,
          WORLD_MAP_MAX_NODE_SCALE,
        ).toFixed(3))

        setLayout((current) => {
          if (
            current.width === width &&
            current.height === height &&
            current.nodeScale === nodeScale
          ) {
            return current
          }
          return { width, height, nodeScale }
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
  }, [wrapperRef])

  return layout
}
