import { useEffect, useRef, useState } from 'react'
import { getPublicAssetUrl } from '@/lib/sprites'
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
  @keyframes worldmap-glow-pulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1.0; }
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
    const positions = nodes.map((node, i) => resolveNodePosition(node, i, nodes.length, layout, 5))

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
            return (
              <WorldMapPathSegment
                key={`path-${arena.id}`}
                from={positions[i - 1]}
                to={positions[i]}
                layoutWidth={layout.width}
                nodeScale={layout.nodeScale}
                isUnlocked={arena.isUnlocked}
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

const ZOOM_SCALE = 1.65

function NodeModeCanvas({
  nodes,
  companion,
  positions,
  layout,
  currentNode,
  wrapperRef,
  onSelectNode,
}: NodeModeCanvasProps) {
  const [isZoomed, setIsZoomed] = useState(false)
  const currentNodeId = currentNode?.id ?? null

  const currentIdx = currentNode ? nodes.findIndex((n) => n.id === currentNode.id) : -1
  const currentPos = currentIdx >= 0 ? positions[currentIdx] : null
  const originX = currentPos ? `${(currentPos.x / layout.width * 100).toFixed(1)}%` : '50%'
  const originY = currentPos ? `${(currentPos.y / layout.height * 100).toFixed(1)}%` : '50%'

  // Auto-scroll to current node on mount.
  useEffect(() => {
    if (!currentNodeId || !wrapperRef.current) return
    const idx = nodes.findIndex((n) => n.id === currentNodeId)
    if (idx === -1) return
    const pos = resolveNodePosition(nodes[idx], idx, nodes.length, layout, 5)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId, layout])

  // Re-center on current node when zooming in.
  useEffect(() => {
    if (!isZoomed || !currentPos || !wrapperRef.current) return
    const mapEl = wrapperRef.current
    const scrollEl = mapEl.closest('main')
    if (!scrollEl) return

    const frame = requestAnimationFrame(() => {
      const mapRect = mapEl.getBoundingClientRect()
      const scrollRect = scrollEl.getBoundingClientRect()
      const mapTopInScroll = scrollEl.scrollTop + mapRect.top - scrollRect.top
      const viewportH = window.visualViewport?.height ?? window.innerHeight
      const scrollTop = Math.max(0, mapTopInScroll + currentPos.y - viewportH * 0.45)
      scrollEl.scrollTo({ top: scrollTop, behavior: 'smooth' })
    })

    return () => cancelAnimationFrame(frame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isZoomed])

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
          overflow: 'hidden',
        }}
      >
        {/* Scaled map content */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: isZoomed ? `scale(${ZOOM_SCALE})` : undefined,
            transformOrigin: `${originX} ${originY}`,
            transition: 'transform 0.4s ease-out',
            willChange: 'transform',
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
            {nodes.map((node, i) => {
              if (i === 0) return null
              return (
                <WorldMapPathSegment
                  key={`path-${node.id}`}
                  from={positions[i - 1]}
                  to={positions[i]}
                  layoutWidth={layout.width}
                  nodeScale={layout.nodeScale}
                  isUnlocked={node.isChallengeable}
                  isDefeated={node.isDefeated || node.id === currentNode?.id}
                />
              )
            })}

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

        {/* Zoom toggle — sits outside the scaled div so it doesn't scale */}
        <button
          type="button"
          onClick={() => setIsZoomed((z) => !z)}
          aria-label={isZoomed ? 'Zoom out' : 'Zoom in'}
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 10,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            fontSize: 22,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isZoomed ? '−' : '+'}
        </button>
      </div>
    </>
  )
}
