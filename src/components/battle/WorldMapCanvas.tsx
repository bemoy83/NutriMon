import { useRef } from 'react'
import { getArenaTerrain } from '@/lib/sprites'
import type { ArenaListArena, CreatureCompanion } from '@/types/domain'
import { WorldMapArenaNode } from './WorldMapArenaNode'
import { WorldMapCompanionMarker } from './WorldMapCompanionMarker'
import { WorldMapPathSegment } from './WorldMapPathSegment'
import { WorldMapTerrainBands } from './WorldMapTerrainBands'
import { useMobileWorldMapLayout } from './useMobileWorldMapLayout'
import { resolveNodePosition } from './worldMapGeometry'

interface WorldMapCanvasProps {
  arenas: ArenaListArena[]
  companion: CreatureCompanion | null
  onSelectArena: (id: string, name: string) => void
}

export function WorldMapCanvas({ arenas, companion, onSelectArena }: WorldMapCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const layout = useMobileWorldMapLayout(wrapperRef)
  const sorted = [...arenas].sort((a, b) => a.sortOrder - b.sortOrder)
  const positions = sorted.map((arena, i) => resolveNodePosition(arena, i, sorted.length, layout))

  const currentArena = sorted.find(
    (a) => a.isUnlocked && (a.opponentCount === 0 || a.defeatedCount < a.opponentCount),
  ) ?? sorted.filter((a) => a.isUnlocked).at(-1) ?? null

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
          <WorldMapTerrainBands arenas={sorted} positions={positions} layout={layout} />
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

            return (
              <WorldMapCompanionMarker
                companion={companion}
                currentArena={currentArena}
                position={pos}
                layout={layout}
              />
            )
          })()}
        </svg>
      </div>
    </>
  )
}
