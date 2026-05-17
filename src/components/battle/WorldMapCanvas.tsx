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
  travelTarget?: WorldMapOpponentNode | null
  onTravelComplete?: () => void
  initialCompanionNodeId?: string | null
  arenas?: undefined
  onSelectArena?: undefined
}

type WorldMapCanvasProps = WorldMapCanvasArenaProps | WorldMapCanvasNodeProps

const MAP_ANIMATIONS = `
  @keyframes worldmap-pulse {
    0%, 100% { opacity: 0.45; transform: scale(1); }
    50%       { opacity: 0.80; transform: scale(1.12); }
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
    const { nodes, companion, onSelectNode, travelTarget, onTravelComplete, initialCompanionNodeId } = props
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
        travelTarget={travelTarget ?? null}
        onTravelComplete={onTravelComplete ?? (() => {})}
        initialCompanionNodeId={initialCompanionNodeId ?? null}
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
          minHeight: layout.height,
          flex: '0 0 auto',
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          contain: 'layout paint',
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
  travelTarget: WorldMapOpponentNode | null
  onTravelComplete: () => void
  initialCompanionNodeId: string | null
}

const ZOOM_SCALE = 1.65
const TAP_THRESHOLD = 8  // px; touches that move less than this are treated as taps

// ── Travel animation helpers ──────────────────────────────────────────────────

interface BezierSegment { from: NodePosition; ctrl: NodePosition; to: NodePosition }

function buildTravelSegments(
  fromIdx: number,
  toIdx: number,
  positions: NodePosition[],
  layoutWidth: number,
): BezierSegment[] {
  if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return []
  const step = toIdx > fromIdx ? 1 : -1
  const segs: BezierSegment[] = []
  let i = fromIdx
  while (i !== toIdx) {
    const from = positions[i]
    const to = positions[i + step]
    if (!from || !to) break
    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2
    const ctrlX = midX + (layoutWidth / 2 - midX) * 0.28
    segs.push({ from, ctrl: { x: ctrlX, y: midY }, to })
    i += step
  }
  return segs
}

function quadBezierPoint(seg: BezierSegment, t: number): NodePosition {
  const mt = 1 - t
  return {
    x: mt * mt * seg.from.x + 2 * mt * t * seg.ctrl.x + t * t * seg.to.x,
    y: mt * mt * seg.from.y + 2 * mt * t * seg.ctrl.y + t * t * seg.to.y,
  }
}

// Smoothstep — slow in/out per segment, gives the SMW "walking" feel.
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

const TRAVEL_MS_PER_SEG = 420   // ms of actual movement per node
const NODE_PAUSE_MS     = 120   // ms pause at each intermediate node

function NodeModeCanvas({
  nodes,
  companion,
  positions,
  layout,
  currentNode,
  wrapperRef,
  onSelectNode,
  travelTarget,
  onTravelComplete,
  initialCompanionNodeId,
}: NodeModeCanvasProps) {
  const currentIdx = currentNode ? nodes.findIndex((n) => n.id === currentNode.id) : -1

  // Companion node index — seeded from localStorage, falls back to current progression node.
  const [companionNodeIdx, setCompanionNodeIdx] = useState<number>(() => {
    if (initialCompanionNodeId) {
      const idx = nodes.findIndex((n) => n.id === initialCompanionNodeId)
      if (idx >= 0) return idx
    }
    return currentIdx >= 0 ? currentIdx : 0
  })

  const companionPos = positions[companionNodeIdx] ?? null

  // Pan bounds (screen px) — how far the zoomed content can slide in each direction.
  const viewportW = window.visualViewport?.width ?? layout.width
  const maxPanX = Math.max(0, layout.width * ZOOM_SCALE - viewportW)
  const maxPanY = Math.max(0, layout.height * ZOOM_SCALE - layout.panelHeight)

  // Initial pan centers the companion in the panel; no mount flash because it's lazy.
  const [panX, setPanX] = useState<number>(() => {
    if (!companionPos) return 0
    const target = viewportW / 2 - companionPos.x * ZOOM_SCALE
    return Math.min(0, Math.max(-maxPanX, target))
  })
  const [panY, setPanY] = useState<number>(() => {
    if (!companionPos) return 0
    const target = layout.panelHeight * 0.4 - companionPos.y * ZOOM_SCALE
    return Math.min(0, Math.max(-maxPanY, target))
  })

  // Ref to the companion marker's outer <g> — the rAF loop mutates its transform directly.
  const companionGRef = useRef<SVGGElement>(null)
  const rafRef = useRef<number | null>(null)

  // Touch gesture state — kept in refs to avoid re-renders during drag.
  const touchStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const hasDraggedRef = useRef(false)

  // Attach non-passive touchmove/touchend so we can preventDefault during drag.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    function onTouchMove(e: TouchEvent) {
      if (!touchStartRef.current) return
      const touch = e.touches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y

      if (!hasDraggedRef.current && Math.sqrt(dx * dx + dy * dy) > TAP_THRESHOLD) {
        hasDraggedRef.current = true
      }

      if (!hasDraggedRef.current) return
      e.preventDefault()

      const nextX = Math.min(0, Math.max(-maxPanX, touchStartRef.current.panX + dx))
      const nextY = Math.min(0, Math.max(-maxPanY, touchStartRef.current.panY + dy))
      setPanX(nextX)
      setPanY(nextY)
    }

    function onTouchEnd() {
      touchStartRef.current = null
      hasDraggedRef.current = false
    }

    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPanX, maxPanY])

  // rAF-driven travel: follows bezier segments with per-node pauses (SMW style).
  useEffect(() => {
    if (!travelTarget) return
    const target = travelTarget  // capture for rAF closure — TypeScript can't narrow across async boundaries
    const targetIdx = nodes.findIndex((n) => n.id === target.id)
    if (targetIdx === -1) { onTravelComplete(); return }

    const segs = buildTravelSegments(companionNodeIdx, targetIdx, positions, layout.width)
    if (segs.length === 0) { onTravelComplete(); return }

    const unit = TRAVEL_MS_PER_SEG + NODE_PAUSE_MS
    const totalDuration = segs.length * TRAVEL_MS_PER_SEG + (segs.length - 1) * NODE_PAUSE_MS

    let startTime: number | null = null
    let done = false

    function tick(now: number) {
      if (!startTime) startTime = now
      const elapsed = Math.min(now - startTime, totalDuration)

      // Map elapsed time to the current segment + local progress within it.
      let segIdx = segs.length - 1
      let localT = 1
      for (let i = 0; i < segs.length; i++) {
        const segStart = i * unit
        const segEnd = segStart + TRAVEL_MS_PER_SEG
        const pauseEnd = segEnd + (i < segs.length - 1 ? NODE_PAUSE_MS : 0)
        if (elapsed <= segEnd) {
          segIdx = i
          localT = (elapsed - segStart) / TRAVEL_MS_PER_SEG
          break
        } else if (elapsed <= pauseEnd) {
          segIdx = i
          localT = 1
          break
        }
      }

      const pos = quadBezierPoint(segs[segIdx], smoothstep(Math.min(localT, 1)))
      companionGRef.current?.setAttribute('transform', `translate(${pos.x} ${pos.y})`)

      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (!done) {
        done = true
        setCompanionNodeIdx(targetIdx)
        localStorage.setItem('nutrimon_companion_node_id', target.id)
        onTravelComplete()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelTarget])

  return (
    <>
      <style>{MAP_ANIMATIONS}</style>
      <div
        ref={wrapperRef}
        onTouchStart={(e) => {
          const touch = e.touches[0]
          touchStartRef.current = { x: touch.clientX, y: touch.clientY, panX, panY }
          hasDraggedRef.current = false
        }}
        style={{
          position: 'relative',
          width: '100vw',
          height: layout.panelHeight,
          flex: '0 0 auto',
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          overflow: 'hidden',
          contain: 'layout paint',
          touchAction: 'none',
        }}
      >
        {/* Scaled + panned map content */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: layout.width,
            height: layout.height,
            transform: `translate(${panX}px, ${panY}px) scale(${ZOOM_SCALE})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <img
            src={getPublicAssetUrl('/sprites/worldmap_bg.png')}
            alt=""
            aria-hidden="true"
            width={814}
            height={1933}
            loading="eager"
            fetchPriority="high"
            decoding="async"
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

            {(() => {
              const companionPos = positions[companionNodeIdx]
              if (!companionPos) return null
              return (
                <WorldMapCompanionMarker
                  companion={companion}
                  position={companionPos}
                  layout={layout}
                  outerRef={companionGRef}
                />
              )
            })()}
          </svg>
        </div>
      </div>
    </>
  )
}
