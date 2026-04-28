import { useEffect, useRef } from 'react'
import { getArenaTerrain, getPublicAssetUrl } from '@/lib/sprites'
import type { ArenaListArena, CreatureCompanion, WorldMapOpponentNode } from '@/types/domain'
import { WorldMapArenaNode } from './WorldMapArenaNode'
import { WorldMapOpponentNodeComponent } from './WorldMapOpponentNode'
import { WorldMapCompanionMarker } from './WorldMapCompanionMarker'
import { WorldMapPathSegment } from './WorldMapPathSegment'
import { WorldMapTerrainBands } from './WorldMapTerrainBands'
import { useMobileWorldMapLayout } from './useMobileWorldMapLayout'
import { resolveNodePosition } from './worldMapGeometry'

// ── Arena-based props (legacy — ArenaDetailPage still uses this path) ─────────
interface WorldMapCanvasArenaProps {
  arenas: ArenaListArena[]
  companion: CreatureCompanion | null
  onSelectArena: (id: string, name: string) => void
  nodes?: undefined
  onSelectNode?: undefined
}

// ── Node-based props (new — 25-opponent world map) ────────────────────────────
interface WorldMapCanvasNodeProps {
  nodes: WorldMapOpponentNode[]
  companion: CreatureCompanion | null
  onSelectNode: (node: WorldMapOpponentNode) => void
  arenas?: undefined
  onSelectArena?: undefined
}

type WorldMapCanvasProps = WorldMapCanvasArenaProps | WorldMapCanvasNodeProps

const MAP_ANIMATIONS = `
  @keyframes worldmap-pulse {
    0%, 100% { opacity: 0.45; transform: scale(1); }
    50%       { opacity: 0.80; transform: scale(1.12); }
  }
  @keyframes worldmap-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-4px); }
  }
`

export function WorldMapCanvas(props: WorldMapCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const isNodeMode = props.nodes !== undefined

  const nodeCount = isNodeMode ? props.nodes.length : 0
  const layout = useMobileWorldMapLayout(wrapperRef, nodeCount)

  // ── Node-mode rendering ────────────────────────────────────────────────────
  if (isNodeMode) {
    const { nodes, companion, onSelectNode } = props
    const positions = nodes.map((node, i) => resolveNodePosition(node, i, nodes.length, layout))

    const currentNode = nodes.find((n) => !n.isDefeated && n.isChallengeable)
      ?? nodes.filter((n) => n.isChallengeable).at(-1)
      ?? null

    return (
      <NodeModeCanvas
        nodes={nodes}
        companion={companion}
        positions={positions}
        layout={layout}
        currentNode={currentNode}
        wrapperRef={wrapperRef}
        onSelectNode={onSelectNode}
      />
    )
  }

  // ── Arena-mode rendering (unchanged) ──────────────────────────────────────
  const { arenas, companion, onSelectArena } = props
  const sorted = [...arenas].sort((a, b) => a.sortOrder - b.sortOrder)
  const positions = sorted.map((arena, i) => resolveNodePosition(arena, i, sorted.length, layout))

  const currentArena = sorted.find(
    (a) => a.isUnlocked && (a.opponentCount === 0 || a.defeatedCount < a.opponentCount),
  ) ?? sorted.filter((a) => a.isUnlocked).at(-1) ?? null

  return (
    <>
      <style>{MAP_ANIMATIONS}</style>
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
          style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none' }}
        >
          <WorldMapTerrainBands arenas={sorted} positions={positions} layout={layout} />
        </svg>

        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          style={{ position: 'relative', zIndex: 1, display: 'block', overflow: 'visible', margin: '0 auto' }}
          aria-label="Arena world map"
        >
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

          {sorted.map((arena, i) => (
            <WorldMapArenaNode
              key={arena.id}
              arena={arena}
              position={positions[i]}
              isCurrent={arena.id === currentArena?.id}
              nodeScale={layout.nodeScale}
              onClick={arena.isUnlocked ? () => onSelectArena(arena.id, arena.name) : undefined}
            />
          ))}

          {currentArena && (() => {
            const idx = sorted.findIndex((a) => a.id === currentArena.id)
            const pos = positions[idx]
            if (!pos) return null
            return (
              <WorldMapCompanionMarker
                companion={companion}
                arenaId={currentArena.id}
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

// ── Node-mode sub-component (avoids hooks-in-conditional) ─────────────────────

import type { RefObject } from 'react'
import type { NodePosition } from './worldMapGeometry'
import type { WorldMapLayout } from './worldMapLayout'

interface NodeModeCanvasProps {
  nodes: WorldMapOpponentNode[]
  companion: CreatureCompanion | null
  positions: NodePosition[]
  layout: WorldMapLayout
  currentNode: WorldMapOpponentNode | null
  wrapperRef: RefObject<HTMLDivElement | null>
  onSelectNode: (node: WorldMapOpponentNode) => void
}

function NodeModeCanvas({
  nodes,
  companion,
  positions,
  layout,
  currentNode,
  wrapperRef,
  onSelectNode,
}: NodeModeCanvasProps) {
  const currentNodeId = currentNode?.id ?? null

  // Auto-scroll the app page to the current node when the hub is entered.
  useEffect(() => {
    if (!currentNodeId || !wrapperRef.current) return
    const idx = nodes.findIndex((n) => n.id === currentNodeId)
    if (idx === -1) return
    const pos = resolveNodePosition(nodes[idx], idx, nodes.length, layout)
    if (!pos) return

    const mapEl = wrapperRef.current
    const scrollEl = mapEl.closest('main')
    if (!scrollEl) return

    const frame = requestAnimationFrame(() => {
      const mapRect = mapEl.getBoundingClientRect()
      const scrollRect = scrollEl.getBoundingClientRect()
      const mapTopInScroll = scrollEl.scrollTop + mapRect.top - scrollRect.top
      const viewportOffset = (window.visualViewport?.height ?? window.innerHeight) * 0.35
      const scrollTop = Math.max(0, mapTopInScroll + pos.y - viewportOffset)
      scrollEl.scrollTo({ top: scrollTop, behavior: 'instant' })
    })

    return () => cancelAnimationFrame(frame)
  }, [currentNodeId, layout, nodes, wrapperRef])

  return (
    <>
      <style>{MAP_ANIMATIONS}</style>
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
        <img
          src={getPublicAssetUrl('/sprites/worldmap_bg.png')}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: layout.height,
            objectFit: 'cover',
            imageRendering: 'pixelated',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />

        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="none"
          width="100%"
          height={layout.height}
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, display: 'block', opacity: 0.38, pointerEvents: 'none' }}
        >
          <WorldMapTerrainBands nodes={nodes} positions={positions} layout={layout} />
        </svg>

        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          style={{ position: 'relative', zIndex: 1, display: 'block', overflow: 'visible', margin: '0 auto' }}
          aria-label="Opponent world map"
        >
          {/* Paths */}
          {nodes.map((node, i) => {
            if (i === 0) return null
            const prevNode = nodes[i - 1]
            const terrain = getArenaTerrain(prevNode.arenaId)
            return (
              <WorldMapPathSegment
                key={`path-${node.id}`}
                from={positions[i - 1]}
                to={positions[i]}
                layoutWidth={layout.width}
                nodeScale={layout.nodeScale}
                isUnlocked={node.isChallengeable}
                accentColor={terrain.accentColor ?? '#6b7280'}
              />
            )
          })}

          {/* Opponent nodes */}
          {nodes.map((node, i) => (
            <WorldMapOpponentNodeComponent
              key={node.id}
              node={node}
              position={positions[i]}
              isCurrent={node.id === currentNode?.id}
              nodeScale={layout.nodeScale}
              onClick={node.isChallengeable ? () => onSelectNode(node) : undefined}
            />
          ))}

          {/* Companion marker */}
          {currentNode && (() => {
            const idx = nodes.findIndex((n) => n.id === currentNode.id)
            const pos = positions[idx]
            if (!pos) return null
            return (
              <WorldMapCompanionMarker
                companion={companion}
                arenaId={currentNode.arenaId}
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
