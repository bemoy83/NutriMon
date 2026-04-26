import { getArenaTerrain } from '@/lib/sprites'
import { deriveTerrainGradient } from '@/lib/arenaTheme'
import type { ArenaListArena } from '@/types/domain'
import type { NodePosition } from './worldMapGeometry'

// Tap-target radius — still used for companion positioning and path anchoring
export const NODE_R = 32

// Hub platforms use the battle registry as source of truth, then scale down for map density.
const HUB_PLATFORM_SCALE = 0.64
const FALLBACK_PLATFORM_W = 136
const ARENA_LABEL_FONT_SIZE = 12
const ARENA_META_FONT_SIZE = 10

interface WorldMapArenaNodeProps {
  arena: ArenaListArena
  position: NodePosition
  isCurrent: boolean
  nodeScale: number
  onClick?: () => void
}

export function WorldMapArenaNode({
  arena,
  position,
  isCurrent,
  nodeScale,
  onClick,
}: WorldMapArenaNodeProps) {
  const terrain = getArenaTerrain(arena.id)
  const accent = terrain.accentColor ?? '#6b7280'
  const platformUrl = terrain.opponentPlatformUrl
  const isLocked = !arena.isUnlocked
  const isComplete = !isLocked && arena.opponentCount > 0 && arena.defeatedCount >= arena.opponentCount
  const nodeR = NODE_R * nodeScale
  const platformBaseW = terrain.opponentPlatformWidth
    ? terrain.opponentPlatformWidth * HUB_PLATFORM_SCALE
    : FALLBACK_PLATFORM_W
  const platformW = platformBaseW * nodeScale
  const platformNativeH = terrain.opponentCalibration?.nativeH ?? 240
  const platformH = Math.round(platformW * platformNativeH / 512)

  // Platform top-left relative to the node's local coordinate origin (nodeR, nodeR)
  const px = nodeR - platformW / 2
  const py = nodeR - platformH / 2
  const filterId = `arena-glow-${arena.id}`

  return (
    <g
      transform={`translate(${position.x - nodeR} ${position.y - nodeR})`}
      style={{ cursor: isLocked ? 'default' : 'pointer' }}
      role={isLocked ? undefined : 'button'}
      aria-label={isLocked ? `${arena.name} — locked` : arena.name}
      onClick={isLocked ? undefined : onClick}
    >
      {isCurrent && !isLocked && (
        <defs>
          <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation={8 * nodeScale} floodColor={accent} floodOpacity="0.75" />
          </filter>
        </defs>
      )}

      {platformUrl ? (
        <>
          {/* Platform image */}
          <image
            href={platformUrl}
            x={px}
            y={py}
            width={platformW}
            height={platformH}
            style={{ imageRendering: 'pixelated' }}
            filter={isCurrent && !isLocked ? `url(#${filterId})` : undefined}
            opacity={isLocked ? 0.28 : 1}
          />

          {/* Lock overlay */}
          {isLocked && (
            <g transform={`translate(${nodeR - 8 * nodeScale} ${nodeR - 9 * nodeScale}) scale(${nodeScale})`}>
              <path
                d="M8 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 21 11.5v7A1.5 1.5 0 0 1 19.5 20h-13A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10H8zm2 0h6V7a3 3 0 0 0-6 0v3z"
                fill="rgba(255,255,255,0.45)"
                transform="scale(0.72)"
              />
            </g>
          )}

          {/* Complete star badge — sits above top-right of platform */}
          {isComplete && (
            <g transform={`translate(${px + platformW - 6 * nodeScale} ${py - 10 * nodeScale})`}>
              <circle cx={8 * nodeScale} cy={8 * nodeScale} r={8 * nodeScale} fill="#f59e0b" />
              <text
                x={8 * nodeScale} y={8 * nodeScale}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10 * nodeScale}
                fill="white"
              >★</text>
            </g>
          )}

          {/* Active run pulse — top-right corner of platform */}
          {arena.hasActiveRun && !isLocked && (
            <circle
              cx={px + platformW}
              cy={py}
              r={4.5 * nodeScale}
              fill="#f59e0b"
              style={{ animation: 'worldmap-pulse 1.4s ease-in-out infinite' }}
            />
          )}
        </>
      ) : (
        /* ── Fallback circle (no platform art registered) ── */
        <>
          {isCurrent && !isLocked && (
            <circle
              cx={nodeR} cy={nodeR} r={nodeR + 6 * nodeScale}
              fill="none"
              stroke={accent}
              strokeWidth={2 * nodeScale}
              opacity={0.45}
              style={{ animation: 'worldmap-pulse 2s ease-in-out infinite' }}
            />
          )}
          <foreignObject x={0} y={0} width={nodeR * 2} height={nodeR * 2}>
            <div
              style={{
                width: nodeR * 2, height: nodeR * 2,
                borderRadius: '50%',
                background: isLocked ? '#1a2420' : deriveTerrainGradient(accent),
                opacity: isLocked ? 0.55 : 1,
              }}
            />
          </foreignObject>
          <circle
            cx={nodeR} cy={nodeR} r={nodeR - nodeScale}
            fill="none"
            stroke={isLocked ? 'rgba(255,255,255,0.12)' : accent}
            strokeWidth={1.5 * nodeScale}
            opacity={isLocked ? 0.4 : 0.85}
          />
          {isLocked && (
            <g transform={`translate(${nodeR - 8 * nodeScale} ${nodeR - 9 * nodeScale}) scale(${nodeScale})`}>
              <path
                d="M8 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 21 11.5v7A1.5 1.5 0 0 1 19.5 20h-13A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10H8zm2 0h6V7a3 3 0 0 0-6 0v3z"
                fill="rgba(255,255,255,0.38)"
                transform="scale(0.72)"
              />
            </g>
          )}
          {!isLocked && !isComplete && arena.opponentCount > 0 && (
            <text
              x={nodeR} y={nodeR + nodeScale}
              textAnchor="middle" dominantBaseline="central"
              fontSize={11 * nodeScale} fontWeight={700} fill="rgba(255,255,255,0.90)"
              style={{ fontFamily: 'inherit' }}
            >
              {arena.defeatedCount}/{arena.opponentCount}
            </text>
          )}
        </>
      )}

      {/* ── Labels (shared by both platform and fallback) ── */}
      <text
        x={nodeR}
        y={nodeR + platformH / 2 + 14 * nodeScale}
        textAnchor="middle"
        fontSize={ARENA_LABEL_FONT_SIZE * nodeScale}
        fontWeight={isCurrent ? 700 : 500}
        fill={isLocked ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.88)'}
        style={{ fontFamily: 'inherit', letterSpacing: '0.02em' }}
      >
        {arena.name}
      </text>

      {!isLocked && !isComplete && arena.opponentCount > 0 && (
        <text
          x={nodeR}
          y={nodeR + platformH / 2 + 29 * nodeScale}
          textAnchor="middle"
          fontSize={ARENA_META_FONT_SIZE * nodeScale}
          fill="rgba(255,255,255,0.45)"
          style={{ fontFamily: 'inherit' }}
        >
          {arena.defeatedCount}/{arena.opponentCount} defeated
        </text>
      )}

      {isLocked && arena.unlockBossName && (
        <text
          x={nodeR}
          y={nodeR + platformH / 2 + 29 * nodeScale}
          textAnchor="middle"
          fontSize={ARENA_META_FONT_SIZE * nodeScale}
          fill="rgba(255,255,255,0.22)"
          style={{ fontFamily: 'inherit' }}
        >
          Defeat {arena.unlockBossName}
        </text>
      )}
    </g>
  )
}
