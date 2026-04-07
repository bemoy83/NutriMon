import { mapArenaList, mapBattleHub } from '@/lib/domainMappers'
import { supabase } from '@/lib/supabase'
import type { ArenaList, BattleHub } from '@/types/domain'
import type { ArenaListRow, BattleHubRow } from '@/types/database'

export async function getArenaList(battleDate: string): Promise<ArenaList> {
  const { data, error } = await supabase.rpc('get_arena_list', { p_battle_date: battleDate })
  if (error) throw error
  return mapArenaList((data ?? {}) as ArenaListRow)
}

export async function getArenaDetail(arenaId: string, battleDate: string): Promise<BattleHub> {
  const { data, error } = await supabase.rpc('get_arena_detail', {
    p_arena_id: arenaId,
    p_battle_date: battleDate,
  })
  if (error) throw error
  return mapBattleHub((data ?? {}) as BattleHubRow)
}
