import type { ArenaListArena } from '@/types/domain'

export interface NodePosition {
  x: number
  y: number
}

interface WorldMapPathSegmentProps {
  from: NodePosition
  to: NodePosition
  /** True when the destination arena is unlocked */
  isUnlocked: boolean
  accentColor: string
}

export function WorldMapPathSegment({ from, to, isUnlocked, accentColor }: WorldMapPathSegmentProps) {
  // Control point: vertical midpoint, pushed horizontally toward the canvas centre
  // so the curve bows gently inward rather than cutting straight across.
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  // Bow the control point 28px toward canvas centre (180px) to create S-feel
  const ctrlX = midX + (180 - midX) * 0.28
  const ctrlY = midY

  const d = `M ${from.x} ${from.y} Q ${ctrlX} ${ctrlY} ${to.x} ${to.y}`

  if (!isUnlocked) {
    return (
      <path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={2.5}
        strokeDasharray="5 7"
        strokeLinecap="round"
      />
    )
  }

  return (
    <>
      {/* Glow under-layer */}
      <path
        d={d}
        fill="none"
        stroke={accentColor}
        strokeWidth={7}
        strokeLinecap="round"
        opacity={0.18}
      />
      {/* Solid path */}
      <path
        d={d}
        fill="none"
        stroke={accentColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.75}
      />
      {/* Footstep dots */}
      <FootstepDots d={d} accentColor={accentColor} />
    </>
  )
}

// Evenly-spaced dots along the bezier — pure geometry, no canvas sampling.
// We approximate point-at-length with lerp along the quadratic bezier formula.
function FootstepDots({ d, accentColor }: { d: string; accentColor: string }) {
  const points = sampleBezier(d, 5)
  // Skip the first and last points (those are the node centres)
  const mid = points.slice(1, -1)
  return (
    <>
      {mid.map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={2.2}
          fill={accentColor}
          opacity={0.55}
        />
      ))}
    </>
  )
}

// Parse a quadratic bezier path "M x0 y0 Q cx cy x1 y1" and sample N evenly-spaced points.
function sampleBezier(d: string, count: number): NodePosition[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)
  if (!nums || nums.length < 6) return []
  const [x0, y0, cx, cy, x1, y1] = nums.map(Number)
  const pts: NodePosition[] = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const mt = 1 - t
    pts.push({
      x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
      y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
    })
  }
  return pts
}

// ── Position helpers exported for WorldMapCanvas ──────────────────────────────

const MAP_CANVAS_W = 360
const MAP_CANVAS_H = 520

/** Zigzag x-fractions for up to 6 arenas. Extend if more are added. */
const X_PATTERN = [0.50, 0.28, 0.72, 0.50, 0.28, 0.72]

export function resolveNodePosition(
  arena: ArenaListArena,
  index: number,
  total: number,
): NodePosition {
  if (arena.mapX !== null && arena.mapY !== null) {
    return { x: arena.mapX * MAP_CANVAS_W, y: arena.mapY * MAP_CANVAS_H }
  }
  const margin = MAP_CANVAS_H * 0.10
  const span = MAP_CANVAS_H - margin * 2
  // index 0 = bottom, index N-1 = top
  const y = MAP_CANVAS_H - margin - (index / Math.max(total - 1, 1)) * span
  const x = MAP_CANVAS_W * (X_PATTERN[index % X_PATTERN.length] ?? 0.5)
  return { x, y }
}

export { MAP_CANVAS_W, MAP_CANVAS_H }
