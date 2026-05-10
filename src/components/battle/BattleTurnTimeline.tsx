import type { BattleAction, BattleLogEntry, BattleTurnActor } from '@/types/domain'
import type { SpriteDescriptor } from '@/lib/sprites'
import { battleActionFromPayload, battleActionIcon } from './battleActionConfig'
import { getBattleTurnTimelineState } from './battleTurnTimelineModel'

function ActionBadge({ action }: { action: BattleAction | string | null }) {
  if (!action || !(action in battleActionFromPayload)) return null
  const label = battleActionFromPayload[action as BattleAction]
  const icon = battleActionIcon[label]
  return (
    <span style={{
      width: 20,
      height: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      lineHeight: 1,
      flexShrink: 0,
    }}>
      {icon}
    </span>
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
        gap: 3,
        padding: '3px',
        borderRadius: 999,
        background: 'rgba(14,16,24,0.75)',
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
        className="flex items-center gap-1.5"
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
