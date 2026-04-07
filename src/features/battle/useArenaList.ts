import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { getArenaList } from './api'
import { ensureBattlePrepSnapshot } from '@/lib/battlePrep'

export const ARENA_LIST_QUERY_KEY = 'arena-list'

export function useArenaList(battleDate: string | null, timezone: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [ARENA_LIST_QUERY_KEY, user?.id, battleDate],
    enabled: !!user && !!battleDate && !!timezone,
    queryFn: async () => {
      await ensureBattlePrepSnapshot(battleDate!, timezone!)
      return getArenaList(battleDate!)
    },
  })
}

export function useInvalidateArenaList() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return (battleDate?: string | null) => {
    const queryKey = battleDate
      ? [ARENA_LIST_QUERY_KEY, user?.id, battleDate]
      : [ARENA_LIST_QUERY_KEY, user?.id]
    queryClient.invalidateQueries({ queryKey })
  }
}
