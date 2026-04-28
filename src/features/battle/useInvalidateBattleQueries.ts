import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { BATTLE_HUB_QUERY_KEY } from '@/features/creature/useBattleHub'
import { ARENA_LIST_QUERY_KEY } from './useArenaList'
import { ARENA_DETAIL_QUERY_KEY } from './useArenaDetail'
import { WORLD_MAP_QUERY_KEY } from './useWorldMap'

/**
 * Invalidates all battle-related queries: arena-list, arena-detail, battle-hub, and world-map.
 * Call after startBattleRun or after a battle outcome is recorded.
 */
export function useInvalidateBattleQueries() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return () => {
    queryClient.invalidateQueries({ queryKey: [ARENA_LIST_QUERY_KEY, user?.id] })
    queryClient.invalidateQueries({ queryKey: [ARENA_DETAIL_QUERY_KEY, user?.id] })
    queryClient.invalidateQueries({ queryKey: [BATTLE_HUB_QUERY_KEY, user?.id] })
    queryClient.invalidateQueries({ queryKey: [WORLD_MAP_QUERY_KEY, user?.id] })
  }
}
