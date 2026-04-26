import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { queryKeys } from '@/lib/queryKeys'

/** After mutating the saved user food library. */
export function useInvalidateUserFoodLibrary() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.root() })
    queryClient.invalidateQueries({ queryKey: queryKeys.products.profileProducts() })
    queryClient.invalidateQueries({ queryKey: queryKeys.myFood.prefix() })
    queryClient.invalidateQueries({ queryKey: ['my-food-product'] })
  }
}

/**
 * After a meal write changes food usage stats or a product write changes rows
 * visible in logging lists. Search invalidation is only needed for product
 * create/update/delete where cached query results may contain stale names.
 */
export function useInvalidateFoodSourceLists() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return ({ includeSearch = false }: { includeSearch?: boolean } = {}) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.foodSources.recentPrefix(user?.id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.foodSources.frequentPrefix(user?.id) })
    if (includeSearch) {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodSources.searchPrefix(user?.id) })
    }
  }
}

export function useInvalidateMealTemplates() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.mealTemplates() })
}
