import type { BattleLogEntry, BattleTurnActor } from '@/types/domain'
import { getBattleTurnTimelineState } from './battleTurnTimelineModel'

function actorLabel(actor: BattleTurnActor, companionName: string, opponentName: string) {
  return actor === 'player' ? companionName : opponentName
}

function actorAction(entry: BattleLogEntry, actor: BattleTurnActor) {
  return actor === 'player' ? entry.playerAction : entry.opponentAction
}

function formatAction(action: string | null) {
  if (!action) return 'Ready'
  if (action === 'skill') return 'Skill'
  if (action === 'special') return 'Special'
  return action.charAt(0).toUpperCase() + action.slice(1)
}

function actorScore(entry: BattleLogEntry, actor: BattleTurnActor) {
  return actor === 'player' ? entry.playerInitiative : entry.opponentInitiative
}

export function BattleTurnTimeline({
  entries,
  companionName,
  opponentName,
}: {
  entries: BattleLogEntry[]
  companionName: string
  opponentName: string
}) {
  const { initiative, activeActor } = getBattleTurnTimelineState(entries)

  if (!initiative?.firstActor) {
    return (
      <div
        aria-label="Turn order"
        className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-white/75 shadow-sm backdrop-blur-md"
      >
        <span className="max-w-24 truncate">Player</span>
        <span className="text-white/45">?</span>
        <span className="max-w-24 truncate">Opponent</span>
      </div>
    )
  }

  const actors: BattleTurnActor[] =
    initiative.firstActor === 'player' ? ['player', 'opponent'] : ['opponent', 'player']

  return (
    <div
      aria-label="Turn order"
      className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-2.5 py-2 text-xs text-white shadow-sm backdrop-blur-md"
    >
      {actors.map((actor, index) => {
        const isActive = activeActor === actor
        return (
          <div key={actor} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-white/45">-&gt;</span> : null}
            <div
              className={`min-w-0 rounded-md border px-2 py-1 ${
                isActive
                  ? 'border-white/60 bg-white/18 text-white'
                  : 'border-white/10 bg-white/8 text-white/78'
              }`}
            >
              <div className="max-w-24 truncate font-semibold leading-tight">
                {actorLabel(actor, companionName, opponentName)}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] leading-none text-white/55">
                <span>{formatAction(actorAction(initiative, actor))}</span>
                <span aria-hidden>|</span>
                <span>{actorScore(initiative, actor) ?? '-'}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
