import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { getWorldMap } from './api'
import { ensureBattlePrepSnapshot } from '@/lib/battlePrep'

export const WORLD_MAP_QUERY_KEY = 'world-map'

export function useWorldMap(battleDate: string | null, timezone: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [WORLD_MAP_QUERY_KEY, user?.id, battleDate],
    enabled: !!user && !!battleDate && !!timezone,
    queryFn: async () => {
      await ensureBattlePrepSnapshot(battleDate!, timezone!)
      return getWorldMap(battleDate!)
    },
  })
}

export function useInvalidateWorldMap() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return (battleDate?: string | null) => {
    const queryKey = battleDate
      ? [WORLD_MAP_QUERY_KEY, user?.id, battleDate]
      : [WORLD_MAP_QUERY_KEY, user?.id]
    queryClient.invalidateQueries({ queryKey })
  }
}
