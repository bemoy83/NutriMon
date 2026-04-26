import { supabase } from '@/lib/supabase'
import { mapProduct } from '@/lib/domainMappers'
import type {
  CompositeIngredientInput,
  CompositeProductResult,
  ProductRow,
} from '@/types/database'
import type { CompositeProduct, Product, RecipeIngredient } from '@/types/domain'

/** Narrow list for `mapProduct` — keep in sync with products table. */
export const PRODUCT_LIST_SELECT = [
  'id',
  'user_id',
  'name',
  'calories',
  'protein_g',
  'carbs_g',
  'fat_g',
  'label_portion_grams',
  'default_serving_amount',
  'default_serving_unit',
  'use_count',
  'last_used_at',
  'created_at',
  'updated_at',
  'kind',
  'total_mass_g',
  'calories_per_100g',
  'protein_per_100g',
  'carbs_per_100g',
  'fat_per_100g',
  'piece_count',
  'piece_label',
].join(', ')

export interface UpsertCompositeProductParams {
  productId: string | null
  name: string
  totalMassG: number
  pieceCount: number | null
  pieceLabel: string | null
  ingredients: CompositeIngredientInput[]
}

function mapCompositeResult(result: CompositeProductResult): CompositeProduct {
  const product = mapProduct(result.product)
  const ingredients: RecipeIngredient[] = result.ingredients.map((ing) => ({
    id: ing.id,
    sourceType: ing.ingredient_product_id ? 'product' : 'catalog',
    sourceId: (ing.ingredient_product_id ?? ing.ingredient_catalog_item_id)!,
    name: ing.name,
    massG: ing.mass_g,
    sortOrder: ing.sort_order,
    caloriesPer100g: ing.calories_per_100g,
    proteinPer100g: ing.protein_per_100g,
    carbsPer100g: ing.carbs_per_100g,
    fatPer100g: ing.fat_per_100g,
  }))

  return {
    ...product,
    kind: 'composite' as const,
    totalMassG: product.totalMassG!,
    caloriesPer100g: product.caloriesPer100g!,
    proteinPer100g: product.proteinPer100g,
    carbsPer100g: product.carbsPer100g,
    fatPer100g: product.fatPer100g,
    pieceCount: product.pieceCount,
    pieceLabel: product.pieceLabel,
    ingredients,
  }
}

export async function upsertCompositeProduct(
  params: UpsertCompositeProductParams,
): Promise<CompositeProduct> {
  const { data, error } = await supabase.rpc('upsert_composite_product', {
    p_product_id: params.productId,
    p_name: params.name,
    p_total_mass_g: params.totalMassG,
    p_piece_count: params.pieceCount,
    p_piece_label: params.pieceLabel,
    p_ingredients: params.ingredients,
  })

  if (error) throw error
  return mapCompositeResult(data as unknown as CompositeProductResult)
}

export async function getCompositeProduct(
  productId: string,
): Promise<CompositeProduct | null> {
  const { data, error } = await supabase.rpc('get_composite_product', {
    p_product_id: productId,
  })

  if (error) throw error
  if (!data) return null
  return mapCompositeResult(data as unknown as CompositeProductResult)
}

/** All composites in one RPC (see `get_composite_products_batch`). */
export async function getCompositeProductsBatch(
  productIds: string[],
): Promise<Map<string, CompositeProduct>> {
  const out = new Map<string, CompositeProduct>()
  if (productIds.length === 0) return out

  const { data, error } = await supabase.rpc('get_composite_products_batch', {
    p_product_ids: productIds,
  })
  if (error) throw error

  const raw = data as unknown
  if (!Array.isArray(raw)) return out
  for (const el of raw) {
    if (!el) continue
    const cp = mapCompositeResult(el as unknown as CompositeProductResult)
    out.set(cp.id, cp)
  }
  return out
}

export async function getProductByIdForUser(
  userId: string,
  productId: string,
): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_LIST_SELECT)
    .eq('user_id', userId)
    .eq('id', productId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapProduct(data as unknown as ProductRow)
}

export interface ListUserProductsPageParams {
  userId: string
  offset: number
  limit: number
  kind: 'all' | 'simple' | 'recipe'
  query: string
}

export interface ListUserProductsPageResult {
  products: Product[]
  hasMore: boolean
  total: number
}

/**
 * Paged, server-filtered my-food list. Uses {@link kind} and optional {@link query} (ILIKE).
 * Full-library exports can still use {@link getUserProducts}.
 */
export async function listUserProductsPage(
  params: ListUserProductsPageParams,
): Promise<ListUserProductsPageResult> {
  const { userId, offset, limit, kind, query } = params
  const q = query.trim()
  let req = supabase
    .from('products')
    .select(PRODUCT_LIST_SELECT, { count: 'exact' })
    .eq('user_id', userId)
  if (kind === 'simple') {
    req = req.eq('kind', 'simple')
  } else if (kind === 'recipe') {
    req = req.eq('kind', 'composite')
  }
  if (q) {
    req = req.ilike('name', `%${q}%`)
  }
  const { data, error, count } = await req
    .order('use_count', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  const rows = (data as unknown as ProductRow[] | null) ?? []
  const products = rows.map(mapProduct)
  const total = count ?? 0
  const hasMore = offset + products.length < total
  return { products, hasMore, total }
}

export async function getUserProducts(userId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_LIST_SELECT)
    .eq('user_id', userId)
    .order('use_count', { ascending: false })

  if (error) throw error
  return (data as unknown as ProductRow[]).map(mapProduct)
}

export interface InsertSimpleProductParams {
  userId: string
  name: string
  caloriesPer100g: number
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  labelPortionGrams: number | null
}

export async function insertSimpleProduct(params: InsertSimpleProductParams): Promise<string> {
  const cal = Math.round(params.caloriesPer100g)
  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: params.userId,
      name: params.name,
      kind: 'simple',
      calories: cal,
      protein_g: params.proteinPer100g,
      carbs_g: params.carbsPer100g,
      fat_g: params.fatPer100g,
      calories_per_100g: params.caloriesPer100g,
      protein_per_100g: params.proteinPer100g,
      carbs_per_100g: params.carbsPer100g,
      fat_per_100g: params.fatPer100g,
      label_portion_grams: params.labelPortionGrams,
      default_serving_amount: 100,
      default_serving_unit: 'g',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)

  if (error) {
    if (error.message?.includes('used as an ingredient')) {
      throw new Error(error.message)
    }
    throw error
  }
}
