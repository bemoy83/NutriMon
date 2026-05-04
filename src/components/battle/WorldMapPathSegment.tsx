import type { NodePosition } from './worldMapGeometry'

const TRAVELED_COLOR = '#000000'

interface WorldMapPathSegmentProps {
  from: NodePosition
  to: NodePosition
  layoutWidth: number
  nodeScale: number
  isUnlocked: boolean
  accentColor: string
  isDefeated?: boolean
  isNext?: boolean
}

export function WorldMapPathSegment({
  from,
  to,
  layoutWidth,
  nodeScale,
  isUnlocked,
  accentColor,
  isDefeated = false,
  isNext = false,
}: WorldMapPathSegmentProps) {
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const ctrlX = midX + (layoutWidth / 2 - midX) * 0.28
  const ctrlY = midY

  // ── Locked ────────────────────────────────────────────────────────────────
  if (!isUnlocked) {
    const d = `M ${from.x} ${from.y} Q ${ctrlX} ${ctrlY} ${to.x} ${to.y}`
    return (
      <path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={2.5 * nodeScale}
        strokeDasharray={`${5 * nodeScale} ${9 * nodeScale}`}
        strokeLinecap="round"
      />
    )
  }

  if (isDefeated || isNext) {
    return (
      <FootstepMarks
        from={from} to={to} ctrlX={ctrlX} ctrlY={ctrlY}
        color={TRAVELED_COLOR}
        nodeScale={nodeScale}
        rx={3} ry={4.5}
        opacity={0.75}
        lateralOffset={5}
      />
    )
  }

  // Future unlocked — no path marking, nodes speak for themselves
  return null
}

// ── Footstep marks ────────────────────────────────────────────────────────────

interface FootstepMarksProps {
  from: NodePosition
  to: NodePosition
  ctrlX: number
  ctrlY: number
  color: string
  nodeScale: number
  rx: number
  ry: number
  opacity: number
  lateralOffset: number
}

function FootstepMarks({ from, to, ctrlX, ctrlY, color, nodeScale, rx, ry, opacity, lateralOffset }: FootstepMarksProps) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const stepCount = Math.max(2, Math.round(dist / (20 * nodeScale)))

  const marks: Array<{ x: number; y: number; angle: number }> = []

  for (let i = 1; i <= stepCount; i++) {
    const t = i / (stepCount + 1)
    const mt = 1 - t

    // Point on quadratic bezier
    const x = mt * mt * from.x + 2 * mt * t * ctrlX + t * t * to.x
    const y = mt * mt * from.y + 2 * mt * t * ctrlY + t * t * to.y

    // Tangent at t
    const dx = 2 * (1 - t) * (ctrlX - from.x) + 2 * t * (to.x - ctrlX)
    const dy = 2 * (1 - t) * (ctrlY - from.y) + 2 * t * (to.y - ctrlY)
    const len = Math.hypot(dx, dy) || 1

    // Unit perpendicular (left of travel direction)
    const px = -dy / len
    const py = dx / len

    // Alternate left / right
    const side = i % 2 === 0 ? 1 : -1
    const off = lateralOffset * nodeScale

    marks.push({
      x: x + px * side * off,
      y: y + py * side * off,
      // rotate ellipse to align long axis with travel direction
      angle: Math.atan2(dy, dx) * (180 / Math.PI),
    })
  }

  return (
    <>
      {marks.map((m, i) => (
        <ellipse
          key={i}
          cx={m.x}
          cy={m.y}
          rx={rx * nodeScale}
          ry={ry * nodeScale}
          fill={color}
          opacity={opacity}
          transform={`rotate(${m.angle} ${m.x} ${m.y})`}
        />
      ))}
    </>
  )
}
