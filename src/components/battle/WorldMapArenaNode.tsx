import { getArenaTerrain } from '@/lib/sprites'
import { deriveTerrainGradient } from '@/lib/arenaTheme'
import type { ArenaListArena } from '@/types/domain'
import type { NodePosition } from './WorldMapPathSegment'

// Tap-target radius — still used for companion positioning and path anchoring
export const NODE_R = 32

// Platform display size (512×240 native → displayed at PLATFORM_W wide)
const PLATFORM_W = 96
const PLATFORM_H = Math.round(PLATFORM_W * 240 / 512) // 45px

interface WorldMapArenaNodeProps {
  arena: ArenaListArena
  position: NodePosition
  isCurrent: boolean
  onClick?: () => void
}

export function WorldMapArenaNode({ arena, position, isCurrent, onClick }: WorldMapArenaNodeProps) {
  const terrain = getArenaTerrain(arena.id)
  const accent = terrain.accentColor ?? '#6b7280'
  const platformUrl = terrain.opponentPlatformUrl
  const isLocked = !arena.isUnlocked
  const isComplete = !isLocked && arena.opponentCount > 0 && arena.defeatedCount >= arena.opponentCount

  // Platform top-left relative to the node's local coordinate origin (NODE_R, NODE_R)
  const px = NODE_R - PLATFORM_W / 2
  const py = NODE_R - PLATFORM_H / 2
  const filterId = `arena-glow-${arena.id}`

  return (
    <g
      transform={`translate(${position.x - NODE_R} ${position.y - NODE_R})`}
      style={{ cursor: isLocked ? 'default' : 'pointer' }}
      role={isLocked ? undefined : 'button'}
      aria-label={isLocked ? `${arena.name} — locked` : arena.name}
      onClick={isLocked ? undefined : onClick}
    >
      {isCurrent && !isLocked && (
        <defs>
          <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor={accent} floodOpacity="0.75" />
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
            width={PLATFORM_W}
            height={PLATFORM_H}
            style={{ imageRendering: 'pixelated' }}
            filter={isCurrent && !isLocked ? `url(#${filterId})` : undefined}
            opacity={isLocked ? 0.28 : 1}
          />

          {/* Lock overlay */}
          {isLocked && (
            <g transform={`translate(${NODE_R - 8} ${NODE_R - 9})`}>
              <path
                d="M8 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 21 11.5v7A1.5 1.5 0 0 1 19.5 20h-13A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10H8zm2 0h6V7a3 3 0 0 0-6 0v3z"
                fill="rgba(255,255,255,0.45)"
                transform="scale(0.72)"
              />
            </g>
          )}

          {/* Complete star badge — sits above top-right of platform */}
          {isComplete && (
            <g transform={`translate(${px + PLATFORM_W - 6} ${py - 10})`}>
              <circle cx={8} cy={8} r={8} fill="#f59e0b" />
              <text
                x={8} y={8}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fill="white"
              >★</text>
            </g>
          )}

          {/* Active run pulse — top-right corner of platform */}
          {arena.hasActiveRun && !isLocked && (
            <circle
              cx={px + PLATFORM_W}
              cy={py}
              r={4.5}
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
              cx={NODE_R} cy={NODE_R} r={NODE_R + 6}
              fill="none"
              stroke={accent}
              strokeWidth={2}
              opacity={0.45}
              style={{ animation: 'worldmap-pulse 2s ease-in-out infinite' }}
            />
          )}
          <foreignObject x={0} y={0} width={NODE_R * 2} height={NODE_R * 2}>
            <div
              style={{
                width: NODE_R * 2, height: NODE_R * 2,
                borderRadius: '50%',
                background: isLocked ? '#1a2420' : deriveTerrainGradient(accent),
                opacity: isLocked ? 0.55 : 1,
              }}
            />
          </foreignObject>
          <circle
            cx={NODE_R} cy={NODE_R} r={NODE_R - 1}
            fill="none"
            stroke={isLocked ? 'rgba(255,255,255,0.12)' : accent}
            strokeWidth={1.5}
            opacity={isLocked ? 0.4 : 0.85}
          />
          {isLocked && (
            <g transform={`translate(${NODE_R - 8} ${NODE_R - 9})`}>
              <path
                d="M8 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 21 11.5v7A1.5 1.5 0 0 1 19.5 20h-13A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10H8zm2 0h6V7a3 3 0 0 0-6 0v3z"
                fill="rgba(255,255,255,0.38)"
                transform="scale(0.72)"
              />
            </g>
          )}
          {!isLocked && !isComplete && arena.opponentCount > 0 && (
            <text
              x={NODE_R} y={NODE_R + 1}
              textAnchor="middle" dominantBaseline="central"
              fontSize={11} fontWeight={700} fill="rgba(255,255,255,0.90)"
              style={{ fontFamily: 'inherit' }}
            >
              {arena.defeatedCount}/{arena.opponentCount}
            </text>
          )}
        </>
      )}

      {/* ── Labels (shared by both platform and fallback) ── */}
      <text
        x={NODE_R}
        y={NODE_R + PLATFORM_H / 2 + 14}
        textAnchor="middle"
        fontSize={10}
        fontWeight={isCurrent ? 700 : 500}
        fill={isLocked ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.88)'}
        style={{ fontFamily: 'inherit', letterSpacing: '0.02em' }}
      >
        {arena.name}
      </text>

      {!isLocked && !isComplete && arena.opponentCount > 0 && (
        <text
          x={NODE_R}
          y={NODE_R + PLATFORM_H / 2 + 26}
          textAnchor="middle"
          fontSize={8.5}
          fill="rgba(255,255,255,0.45)"
          style={{ fontFamily: 'inherit' }}
        >
          {arena.defeatedCount}/{arena.opponentCount} defeated
        </text>
      )}

      {isLocked && arena.unlockBossName && (
        <text
          x={NODE_R}
          y={NODE_R + PLATFORM_H / 2 + 26}
          textAnchor="middle"
          fontSize={8.5}
          fill="rgba(255,255,255,0.22)"
          style={{ fontFamily: 'inherit' }}
        >
          Defeat {arena.unlockBossName}
        </text>
      )}
    </g>
  )
}
