import { useQuery } from '@tanstack/react-query'
import { getMealTemplates } from './api'

export function useMealTemplates() {
  return useQuery({
    queryKey: ['meal-templates'],
    queryFn: getMealTemplates,
  })
}
