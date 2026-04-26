import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { getMealTemplates } from './api'

export function useMealTemplates() {
  return useQuery({
    queryKey: queryKeys.mealTemplates(),
    queryFn: getMealTemplates,
  })
}
