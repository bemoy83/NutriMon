import { getArenaTerrain, getOpponentSpriteDescriptor } from '@/lib/sprites'
import type { WorldMapOpponentNode } from '@/types/domain'
import type { NodePosition } from './worldMapGeometry'
import { ARENA_LABEL_FONT_SIZE, ARENA_META_FONT_SIZE } from './worldMapLayout'

const NODE_R = 32

interface WorldMapOpponentNodeProps {
  node: WorldMapOpponentNode
  position: NodePosition
  isCurrent: boolean
  nodeScale: number
  onClick?: () => void
}

export function WorldMapOpponentNodeComponent({
  node,
  position,
  isCurrent,
  nodeScale,
  onClick,
}: WorldMapOpponentNodeProps) {
  const terrain = getArenaTerrain(node.arenaId)
  const accent = terrain.accentColor ?? '#6b7280'
  const sprite = getOpponentSpriteDescriptor(node.name)
  const isLocked = !node.isChallengeable
  const isDefeated = node.isDefeated
  const nodeR = NODE_R * nodeScale
  const spriteSize = nodeR * 2
  const glowColor = toGlowHex(accent)
  const glowShadow = `drop-shadow(0 0 ${8 * nodeScale}px ${glowColor}) drop-shadow(0 0 ${22 * nodeScale}px ${glowColor})`

  return (
    <g
      transform={`translate(${position.x - nodeR} ${position.y - nodeR})`}
      style={{ cursor: isLocked ? 'default' : 'pointer' }}
      role={isLocked ? undefined : 'button'}
      aria-label={isLocked ? `${node.name} — locked` : node.name}
      onClick={isLocked ? undefined : onClick}
    >
      {/* Sprite-shaped glow for current node */}
      {/* Glow layer — CSS drop-shadow follows sprite alpha, pulsed via opacity */}
      {isCurrent && !isLocked && sprite && (
        <image
          href={sprite.url}
          x={0}
          y={0}
          width={spriteSize}
          height={spriteSize}
          style={{
            imageRendering: 'pixelated',
            filter: glowShadow,
            animation: 'worldmap-glow-pulse 2.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Sprite */}
      {sprite ? (
        <image
          href={sprite.url}
          x={0}
          y={0}
          width={spriteSize}
          height={spriteSize}
          style={{
            imageRendering: 'pixelated',
            filter: isLocked ? 'brightness(0)' : undefined,
          }}
          opacity={isLocked ? 0.72 : isDefeated ? 0.55 : 1}
        />
      ) : (
        <text
          x={nodeR}
          y={nodeR}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11 * nodeScale}
          fontWeight={700}
          fill={isLocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)'}
          style={{ fontFamily: 'inherit' }}
        >
          {node.name.charAt(0)}
        </text>
      )}

      {/* Lock icon */}
      {isLocked && (
        <g transform={`translate(${nodeR - 8 * nodeScale} ${nodeR - 9 * nodeScale}) scale(${nodeScale})`}>
          <path
            d="M8 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 21 11.5v7A1.5 1.5 0 0 1 19.5 20h-13A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10H8zm2 0h6V7a3 3 0 0 0-6 0v3z"
            fill="rgba(255,255,255,0.55)"
            transform="scale(0.72)"
          />
        </g>
      )}

      {/* Defeated checkmark badge */}
      {isDefeated && (
        <g transform={`translate(${nodeR * 2 - 14 * nodeScale} ${-4 * nodeScale})`}>
          <circle cx={7 * nodeScale} cy={7 * nodeScale} r={7 * nodeScale} fill="#22c55e" />
          <text
            x={7 * nodeScale}
            y={7 * nodeScale}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8 * nodeScale}
            fill="white"
          >✓</text>
        </g>
      )}

      {/* Boss star badge */}
      {isArenaBoss(node) && !isDefeated && !isLocked && (
        <g transform={`translate(${nodeR * 2 - 14 * nodeScale} ${-4 * nodeScale})`}>
          <circle cx={7 * nodeScale} cy={7 * nodeScale} r={7 * nodeScale} fill={accent} />
          <text
            x={7 * nodeScale}
            y={7 * nodeScale}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8 * nodeScale}
            fill="white"
          >★</text>
        </g>
      )}

      {/* Name label */}
      <text
        x={nodeR}
        y={nodeR * 2 + 12 * nodeScale}
        textAnchor="middle"
        fontSize={ARENA_LABEL_FONT_SIZE * nodeScale}
        fontWeight={isCurrent ? 700 : 500}
        fill={isLocked ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.88)'}
        style={{ fontFamily: 'inherit', letterSpacing: '0.02em' }}
      >
        {node.name}
      </text>

      {/* Lock hint */}
      {isLocked && node.lockReason && (
        <text
          x={nodeR}
          y={nodeR * 2 + 25 * nodeScale}
          textAnchor="middle"
          fontSize={ARENA_META_FONT_SIZE * nodeScale}
          fill="rgba(255,255,255,0.22)"
          style={{ fontFamily: 'inherit' }}
        >
          {node.lockReason}
        </text>
      )}
    </g>
  )
}

function isArenaBoss(node: WorldMapOpponentNode): boolean {
  return node.isArenaBoss
}

// Normalize accent color so brightest channel = 255, ensuring the glow
// is always visible regardless of how dark the raw accent is.
function toGlowHex(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return '#ffffff'
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const max = Math.max(r, g, b, 1)
  const scale = 255 / max
  const toHex = (v: number) => Math.round(v * scale).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
