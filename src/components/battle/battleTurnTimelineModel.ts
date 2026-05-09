import type { BattleLogEntry } from '@/types/domain'

export function getBattleTurnTimelineState(entries: BattleLogEntry[]) {
  const latestInitiative = entries.findLast(
    (entry) => entry.phase === 'initiative' && entry.firstActor !== null,
  )
  const latestAction = entries.findLast(
    (entry) => entry.phase === 'action' && (entry.actor === 'player' || entry.actor === 'opponent'),
  )

  return {
    initiative: latestInitiative ?? null,
    activeActor: latestAction?.actor === 'player' || latestAction?.actor === 'opponent'
      ? latestAction.actor
      : null,
  }
}
