import { supabase } from '@/lib/supabase'
import { mapProduct } from '@/lib/domainMappers'
import type {
  CompositeIngredientInput,
  CompositeProductResult,
  ProductRow,
} from '@/types/database'
import type { CompositeProduct, Product, RecipeIngredient } from '@/types/domain'

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
    caloriesPer100g: 0, // Not returned by RPC — resolved client-side if needed
    proteinPer100g: null,
    carbsPer100g: null,
    fatPer100g: null,
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

export async function getUserProducts(userId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .order('use_count', { ascending: false })

  if (error) throw error
  return (data as ProductRow[]).map(mapProduct)
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
