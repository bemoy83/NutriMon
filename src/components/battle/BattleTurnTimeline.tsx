import type { BattleAction, BattleLogEntry, BattleTurnActor } from '@/types/domain'
import type { SpriteDescriptor } from '@/lib/sprites'
import { getBattleTurnTimelineState } from './battleTurnTimelineModel'

const ACTION_CONFIG: Record<BattleAction, { bg: string; glyph: React.ReactNode }> = {
  attack: {
    bg: '#e87268',
    glyph: (
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
        <path d="M11.5 2.5 L13.5 4.5 L8 10 L6 8 Z" fill="#fff" />
        <path d="M6 8 L4.5 11 L2 13.5 L4.5 13.5 L7 12 Z" fill="#fff" />
      </svg>
    ),
  },
  defend: {
    bg: '#3ca8e0',
    glyph: (
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5 L13 3 V8 C13 11 8 14 8 14 C8 14 3 11 3 8 V3 Z" fill="#fff" />
      </svg>
    ),
  },
  focus: {
    bg: '#f0a828',
    glyph: (
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="#fff" strokeWidth="1.6" fill="none" />
        <circle cx="8" cy="8" r="1.8" fill="#fff" />
      </svg>
    ),
  },
  skill: {
    bg: '#b46cff',
    glyph: (
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1 L9.4 6.6 L15 8 L9.4 9.4 L8 15 L6.6 9.4 L1 8 L6.6 6.6 Z"
          fill="#fff"
        />
      </svg>
    ),
  },
}

function ActionBadge({ action }: { action: BattleAction | string | null }) {
  if (!action || !(action in ACTION_CONFIG)) return null
  const cfg = ACTION_CONFIG[action as BattleAction]
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: cfg.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {cfg.glyph}
    </div>
  )
}

function TurnChip({
  label,
  action,
  isActive,
  isSkipped,
  flip,
  descriptor,
}: {
  label: string
  action: BattleAction | string | null
  isActive: boolean
  isSkipped: boolean
  flip?: boolean
  descriptor?: SpriteDescriptor | null
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px 3px 3px',
        borderRadius: 999,
        background: isActive
          ? 'linear-gradient(180deg, rgba(240,192,40,0.18), rgba(240,192,40,0.07))'
          : 'rgba(14,16,24,0.75)',
        border: `1px solid ${isActive ? 'rgba(240,192,40,0.65)' : 'rgba(255,255,255,0.10)'}`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        opacity: isSkipped ? 0.35 : 1,
        transform: isActive ? 'translateY(-3px)' : 'translateY(0)',
        transition:
          'transform 120ms ease-out, border-color 150ms ease, opacity 200ms ease, background 150ms ease',
        flexDirection: flip ? 'row' : 'row-reverse',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          overflow: 'hidden',
          ...(descriptor
            ? {}
            : {
                background:
                  'repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 5px, transparent 5px, transparent 10px)',
                border: '1.5px dashed rgba(255,255,255,0.22)',
              }),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {descriptor ? (
          <img
            src={descriptor.url}
            alt=""
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              imageRendering: descriptor.pixelArt ? 'pixelated' : 'auto',
              transform: descriptor.facing === 'left' && !flip ? 'scaleX(-1)' : undefined,
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 9,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: 0.3,
            }}
          >
            {label}
          </span>
        )}
      </div>
      <ActionBadge action={isActive ? action : null} />
    </div>
  )
}

function Separator() {
  return (
    <span
      style={{
        fontSize: 14,
        lineHeight: 1,
        color: 'rgba(255,255,255,0.22)',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      ·
    </span>
  )
}

function PendingConnector() {
  return (
    <span
      style={{
        fontFamily: 'Nunito, ui-sans-serif, sans-serif',
        fontSize: 13,
        fontWeight: 900,
        color: 'rgba(255,255,255,0.25)',
        lineHeight: 1,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      ?
    </span>
  )
}

function chipLabel(actor: BattleTurnActor, companionName: string, opponentName: string) {
  const name = actor === 'player' ? companionName : opponentName
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function chipAction(
  entry: BattleLogEntry,
  actor: BattleTurnActor,
): BattleAction | string | null {
  return actor === 'player' ? entry.playerAction : entry.opponentAction
}

export function BattleTurnTimeline({
  entries,
  fullLog,
  companionName,
  opponentName,
  playerDescriptor,
  opponentDescriptor,
}: {
  entries: BattleLogEntry[]
  fullLog?: BattleLogEntry[]
  companionName: string
  opponentName: string
  playerDescriptor?: SpriteDescriptor | null
  opponentDescriptor?: SpriteDescriptor | null
}) {
  const { initiative, activeActor, skippedActor } = getBattleTurnTimelineState(entries, fullLog)

  const playerLabel = chipLabel('player', companionName, opponentName)
  const opponentLabel = chipLabel('opponent', companionName, opponentName)
  const labelFor = (actor: BattleTurnActor) => actor === 'player' ? playerLabel : opponentLabel
  const descriptorFor = (actor: BattleTurnActor) =>
    actor === 'player' ? playerDescriptor : opponentDescriptor

  if (!initiative?.firstActor) {
    return (
      <div
        aria-label="Turn order"
        className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5"
      >
        <TurnChip
          label={playerLabel}
          action={null}
          isActive={false}
          isSkipped={false}
          flip
          descriptor={playerDescriptor}
        />
        <PendingConnector />
        <TurnChip
          label={opponentLabel}
          action={null}
          isActive={false}
          isSkipped={false}
          descriptor={opponentDescriptor}
        />
      </div>
    )
  }

  const actors: BattleTurnActor[] =
    initiative.firstActor === 'player' ? ['player', 'opponent'] : ['opponent', 'player']

  return (
    <div
      aria-label="Turn order"
      className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5"
    >
      <TurnChip
        label={labelFor(actors[0])}
        action={chipAction(initiative, actors[0])}
        isActive={activeActor === actors[0]}
        isSkipped={skippedActor === actors[0]}
        flip={actors[0] === 'player'}
        descriptor={descriptorFor(actors[0])}
      />
      <Separator />
      <TurnChip
        label={labelFor(actors[1])}
        action={chipAction(initiative, actors[1])}
        isActive={activeActor === actors[1]}
        isSkipped={skippedActor === actors[1]}
        descriptor={descriptorFor(actors[1])}
      />
    </div>
  )
}
