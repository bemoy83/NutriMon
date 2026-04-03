import { mapBattleHub, mapBattleRunSession } from '@/lib/domainMappers'
import { supabase } from '@/lib/supabase'
import type { BattleAction, BattleHub, BattleRunSession } from '@/types/domain'
import type { BattleHubRow, BattleRunSessionRow } from '@/types/database'

export async function getBattleHub(battleDate: string): Promise<BattleHub> {
  const { data, error } = await supabase.rpc('get_battle_hub', { p_battle_date: battleDate })
  if (error) throw error
  return mapBattleHub((data ?? {}) as BattleHubRow)
}

export async function startBattleRun(snapshotId: string, opponentId: string): Promise<BattleRunSession> {
  const { data, error } = await supabase.rpc('start_battle_run', {
    p_snapshot_id: snapshotId,
    p_opponent_id: opponentId,
  })
  if (error) throw error
  return mapBattleRunSession(data as BattleRunSessionRow)
}

export async function getBattleRun(battleRunId: string): Promise<BattleRunSession> {
  const { data, error } = await supabase.rpc('get_battle_run', {
    p_battle_run_id: battleRunId,
  })
  if (error) throw error
  return mapBattleRunSession(data as BattleRunSessionRow)
}

export async function submitBattleAction(battleRunId: string, action: BattleAction): Promise<BattleRunSession> {
  const { data, error } = await supabase.rpc('submit_battle_action', {
    p_battle_run_id: battleRunId,
    p_action: action,
  })
  if (error) throw error
  return mapBattleRunSession(data as BattleRunSessionRow)
}

