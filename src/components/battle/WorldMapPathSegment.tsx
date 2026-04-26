import type { NodePosition } from './worldMapGeometry'

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
