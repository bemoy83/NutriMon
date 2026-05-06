import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { useDevMode } from '@/app/providers/DevModeContext'
import { getBattleHub } from './api'
import { ensureBattlePrepSnapshot, ensureDevBattleSnapshot } from '@/lib/battlePrep'

export const BATTLE_HUB_QUERY_KEY = 'battle-hub'

export function useBattleHub(battleDate: string | null, timezone: string | null) {
  const { user } = useAuth()
  const { isDevMode } = useDevMode()

  return useQuery({
    queryKey: [BATTLE_HUB_QUERY_KEY, user?.id, battleDate],
    enabled: !!user && !!battleDate && !!timezone,
    queryFn: async () => {
      if (isDevMode) {
        await ensureDevBattleSnapshot(battleDate!)
      } else {
        await ensureBattlePrepSnapshot(battleDate!, timezone!)
      }
      return getBattleHub(battleDate!)
    },
  })
}

export function useInvalidateBattleHub() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return (battleDate?: string | null) => {
    const queryKey = battleDate
      ? [BATTLE_HUB_QUERY_KEY, user?.id, battleDate]
      : [BATTLE_HUB_QUERY_KEY, user?.id]

    queryClient.invalidateQueries({ queryKey })
  }
}
