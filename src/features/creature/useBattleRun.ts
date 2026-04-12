import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useInvalidateBattleQueries } from '@/features/battle/useInvalidateBattleQueries'
import { getBattleRun, submitBattleAction } from './api'
import type { BattleAction } from '@/types/domain'

export const BATTLE_RUN_QUERY_KEY = 'battle-run'

export function useBattleRun(battleRunId: string | undefined) {
  return useQuery({
    queryKey: [BATTLE_RUN_QUERY_KEY, battleRunId],
    enabled: !!battleRunId,
    queryFn: () => getBattleRun(battleRunId!),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useSubmitBattleAction() {
  const queryClient = useQueryClient()
  const invalidateBattleQueries = useInvalidateBattleQueries()

  return useMutation({
    mutationFn: ({ battleRunId, action }: { battleRunId: string; action: BattleAction }) =>
      submitBattleAction(battleRunId, action),
    onSuccess: (session) => {
      queryClient.setQueryData([BATTLE_RUN_QUERY_KEY, session.id], session)
      // Arena detail/list cache `activeBattleRun` for up to the global staleTime (1m).
      // Without this, opponents can stay on "Resume" after the run completes until refetch.
      if (session.status === 'completed') {
        invalidateBattleQueries()
      }
    },
  })
}
