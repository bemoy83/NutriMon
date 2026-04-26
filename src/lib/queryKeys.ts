/**
 * React Query key factories. Use the same helpers for `useQuery` and `invalidateQueries`
 * (TanStack matches on prefixes by default).
 */
export const queryKeys = {
  profile: {
    summary: (userId: string | undefined) => ['profile', userId] as const,
    full: (userId: string | undefined) => ['profile-full', userId] as const,
  },
  foodSources: {
    prefix: () => ['food-sources'] as const,
    recent: (userId: string | undefined) => ['food-sources', 'recent', userId] as const,
    frequent: (userId: string | undefined) => ['food-sources', 'frequent', userId] as const,
    search: (userId: string | undefined, q: string) => ['food-sources', 'search', userId, q] as const,
    map: (userId: string | undefined, productIds: string[], catalogIds: string[]) =>
      ['food-sources', 'map', userId, productIds, catalogIds] as const,
  },
  myFood: {
    prefix: () => ['my-food-products'] as const,
    product: (userId: string | undefined, id: string | undefined) => ['my-food-product', userId, id] as const,
    products: (userId: string | undefined, filter: string, q: string) =>
      ['my-food-products', userId, filter, q] as const,
    productsPicker: (userId: string | undefined, q: string) =>
      ['my-food-products', userId, 'picker', q] as const,
  },
  mealTemplates: () => ['meal-templates'] as const,
  weight: {
    /** Invalidates all `weight-entries` queries for the user (any range). */
    prefix: (userId: string | undefined) => ['weight-entries', userId] as const,
    entries: (userId: string | undefined, days: number) => ['weight-entries', userId, days] as const,
  },
  creature: {
    statsLatest: (userId: string | undefined) => ['creature-stats', 'latest', userId] as const,
  },
  products: {
    /** Legacy / unused read keys — still invalidated on product writes */
    root: () => ['products'] as const,
    profileProducts: () => ['profile-products'] as const,
  },
  compositeFood: {
    product: (productId: string | undefined) => ['composite-product', productId] as const,
  },
} as const
