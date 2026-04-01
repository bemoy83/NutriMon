import { mapBattleHub, mapBattleRunWithOpponent } from '@/lib/domainMappers'
import { supabase } from '@/lib/supabase'
import type { BattleHub, BattleRun } from '@/types/domain'
import type { BattleHubRow, BattleRunMutationResult } from '@/types/database'

export async function getBattleHub(battleDate: string): Promise<BattleHub> {
  const { data, error } = await supabase.rpc('get_battle_hub', { p_battle_date: battleDate })
  if (error) throw error
  return mapBattleHub((data ?? {}) as BattleHubRow)
}

export async function startBattleRun(snapshotId: string, opponentId: string): Promise<BattleRun> {
  const { data, error } = await supabase.rpc('start_battle_run', {
    p_snapshot_id: snapshotId,
    p_opponent_id: opponentId,
  })
  if (error) throw error
  return mapBattleRunWithOpponent((data as BattleRunMutationResult).battle_run)
}

export async function resolveBattleRun(battleRunId: string): Promise<BattleRun> {
  const { data, error } = await supabase.rpc('resolve_battle_run', {
    p_battle_run_id: battleRunId,
  })
  if (error) throw error
  const result = data as BattleRunMutationResult
  return mapBattleRunWithOpponent({
    ...result.battle_run,
    opponent: result.opponent ?? null,
  })
}
