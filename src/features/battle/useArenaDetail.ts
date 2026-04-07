import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { getArenaDetail } from './api'
import { ensureBattlePrepSnapshot } from '@/lib/battlePrep'

export const ARENA_DETAIL_QUERY_KEY = 'arena-detail'

export function useArenaDetail(
  arenaId: string | null,
  battleDate: string | null,
  timezone: string | null,
) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [ARENA_DETAIL_QUERY_KEY, user?.id, arenaId, battleDate],
    enabled: !!user && !!arenaId && !!battleDate && !!timezone,
    queryFn: async () => {
      await ensureBattlePrepSnapshot(battleDate!, timezone!)
      return getArenaDetail(arenaId!, battleDate!)
    },
  })
}

export function useInvalidateArenaDetail() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return (arenaId?: string | null, battleDate?: string | null) => {
    const queryKey =
      arenaId && battleDate
        ? [ARENA_DETAIL_QUERY_KEY, user?.id, arenaId, battleDate]
        : arenaId
          ? [ARENA_DETAIL_QUERY_KEY, user?.id, arenaId]
          : [ARENA_DETAIL_QUERY_KEY, user?.id]
    queryClient.invalidateQueries({ queryKey })
  }
}
