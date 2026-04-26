import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { getArenaTerrain, getPlayerBattleSpriteDescriptor } from '@/lib/sprites'
import type { ArenaListArena, CreatureCompanion } from '@/types/domain'
import { WorldMapArenaNode } from './WorldMapArenaNode'
import { WorldMapPathSegment } from './WorldMapPathSegment'
import { DEFAULT_WORLD_MAP_LAYOUT, resolveNodePosition } from './worldMapGeometry'
import type { NodePosition, WorldMapLayout } from './worldMapGeometry'

interface WorldMapCanvasProps {
  arenas: ArenaListArena[]
  companion: CreatureCompanion | null
  onSelectArena: (id: string, name: string) => void
}

// ── Terrain zone bands ────────────────────────────────────────────────────────
// Each arena gets a vertical band of canvas height. A radial gradient centred
// on the node creates a biome-coloured glow zone — faint on the dark bg but
// enough to divide the canvas into visually distinct elevation tiers.

interface Band {
  arenaId: string
  accent: string
  nodePos: NodePosition
  top: number
  bottom: number
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

function TerrainBands({ bands, layout }: { bands: Band[]; layout: WorldMapLayout }) {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function useMobileWorldMapLayout(wrapperRef: RefObject<HTMLDivElement | null>) {
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

        const width = Math.round(Math.min(viewportWidth, 480))
        const availableHeight = viewportHeight - top - 88
        const height = Math.round(clamp(availableHeight, 500, 760))
        const nodeScale = Number(clamp(Math.min(width / 390, height / 620), 0.9, 1.22).toFixed(3))

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

export function WorldMapCanvas({ arenas, companion, onSelectArena }: WorldMapCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const layout = useMobileWorldMapLayout(wrapperRef)
  const sorted = [...arenas].sort((a, b) => a.sortOrder - b.sortOrder)
  const positions = sorted.map((arena, i) => resolveNodePosition(arena, i, sorted.length, layout))
  const bands = computeBands(sorted, positions, layout)

  const currentArena = sorted.find(
    (a) => a.isUnlocked && (a.opponentCount === 0 || a.defeatedCount < a.opponentCount),
  ) ?? sorted.filter((a) => a.isUnlocked).at(-1) ?? null

  const companionSprite = companion
    ? getPlayerBattleSpriteDescriptor(companion.stage, companion.currentCondition)
    : null

  return (
    <>
      <style>{`
        @keyframes worldmap-pulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%       { opacity: 0.80; transform: scale(1.12); }
        }
        @keyframes worldmap-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
      `}</style>

      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          width: '100vw',
          height: layout.height,
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
        }}
      >
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            pointerEvents: 'none',
          }}
        >
          <TerrainBands bands={bands} layout={layout} />
        </svg>

        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'block',
            overflow: 'visible',
            margin: '0 auto',
          }}
          aria-label="Arena world map"
        >
          {/* Layer 2: path connectors */}
          {sorted.map((arena, i) => {
            if (i === 0) return null
            const prevArena = sorted[i - 1]
            const terrain = getArenaTerrain(prevArena.id)
            return (
              <WorldMapPathSegment
                key={`path-${arena.id}`}
                from={positions[i - 1]}
                to={positions[i]}
                layoutWidth={layout.width}
                nodeScale={layout.nodeScale}
                isUnlocked={arena.isUnlocked}
                accentColor={terrain.accentColor ?? '#6b7280'}
              />
            )
          })}

          {/* Layer 3: arena nodes */}
          {sorted.map((arena, i) => (
            <WorldMapArenaNode
              key={arena.id}
              arena={arena}
              position={positions[i]}
              isCurrent={arena.id === currentArena?.id}
              nodeScale={layout.nodeScale}
              onClick={
                arena.isUnlocked
                  ? () => onSelectArena(arena.id, arena.name)
                  : undefined
              }
            />
          ))}

          {/* Layer 4: companion marker */}
          {currentArena && (() => {
            const idx = sorted.findIndex((a) => a.id === currentArena.id)
            const pos = positions[idx]
            if (!pos) return null
            const MARKER_SIZE = 40 * layout.nodeScale
            // Platform is 96×45px centred on pos. Surface sits at ovalSurfaceY≈97/240
            // from the platform's top edge. Land the companion's feet there.
            const PLATFORM_W = 96 * layout.nodeScale
            const PLATFORM_H = Math.round(PLATFORM_W * 240 / 512)
            const platformTop = pos.y - PLATFORM_H / 2
            const surfaceY = platformTop + PLATFORM_H * (97 / 240)
            const markerX = pos.x - MARKER_SIZE / 2
            const markerY = surfaceY - MARKER_SIZE

            return (
              <g transform={`translate(${markerX} ${markerY})`}>
                <g style={{ animation: 'worldmap-float 3s ease-in-out infinite' }}>
                  {companionSprite ? (
                    <>
                      <image
                        href={companionSprite.url}
                        width={MARKER_SIZE}
                        height={MARKER_SIZE}
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <ellipse
                        cx={MARKER_SIZE / 2}
                        cy={MARKER_SIZE + 2}
                        rx={8} ry={3}
                        fill="rgba(0,0,0,0.35)"
                      />
                    </>
                  ) : (
                    <>
                      <circle cx={MARKER_SIZE / 2} cy={MARKER_SIZE / 2} r={MARKER_SIZE / 2} fill="rgba(124,58,237,0.85)" />
                      <text
                        x={MARKER_SIZE / 2} y={MARKER_SIZE / 2}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize={13} fontWeight={700} fill="white"
                      >
                        {companion?.name?.[0]?.toUpperCase() ?? '?'}
                      </text>
                    </>
                  )}
                </g>
              </g>
            )
          })()}
        </svg>
      </div>
    </>
  )
}
