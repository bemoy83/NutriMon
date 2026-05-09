import type { BattleLogEntry, BattleTurnActor } from '@/types/domain'

export function getBattleTurnTimelineState(
  entries: BattleLogEntry[],
  fullLog?: BattleLogEntry[],
) {
  const latestInitiative = entries.findLast(
    (entry) => entry.phase === 'initiative' && entry.firstActor !== null,
  )
  if (!latestInitiative) return { initiative: null, activeActor: null, skippedActor: null }

  const round = latestInitiative.round
  const firstActor = latestInitiative.firstActor as BattleTurnActor
  const secondActor: BattleTurnActor = firstActor === 'player' ? 'opponent' : 'player'

  const currentRoundActions = entries.filter(
    (entry) =>
      entry.phase === 'action' &&
      entry.round === round &&
      (entry.actor === 'player' || entry.actor === 'opponent'),
  )
  const firstActed = currentRoundActions.some((e) => e.actor === firstActor)
  const secondActed = currentRoundActions.some((e) => e.actor === secondActor)

  const logToCheck = fullLog ?? entries
  const secondActorWillAct = logToCheck.some(
    (entry) => entry.phase === 'action' && entry.round === round && entry.actor === secondActor,
  )
  const skippedActor = firstActed && !secondActorWillAct ? secondActor : null

  // Forward-looking: highlight who is yet to act. Once both have acted, go idle.
  let activeActor: BattleTurnActor | null
  if (secondActed) {
    activeActor = null
  } else if (!firstActed) {
    activeActor = firstActor
  } else if (skippedActor === null) {
    activeActor = secondActor
  } else {
    activeActor = null
  }

  return { initiative: latestInitiative, activeActor, skippedActor }
}
