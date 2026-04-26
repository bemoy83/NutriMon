import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

/** After mutating user products or catalog-backed rows used in meal logging. */
export function useInvalidateProductQueries() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.root() })
    queryClient.invalidateQueries({ queryKey: queryKeys.products.profileProducts() })
    queryClient.invalidateQueries({ queryKey: queryKeys.foodSources.prefix() })
    queryClient.invalidateQueries({ queryKey: queryKeys.myFood.prefix() })
    queryClient.invalidateQueries({ queryKey: ['my-food-product'] })
  }
}

export function useInvalidateMealTemplates() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.mealTemplates() })
}
