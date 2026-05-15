import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupBarcode } from '../kassalapp'

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

const eanProduct = {
  id: 1,
  name: 'Test yogurt',
  vendor: null,
  brand: 'Brand',
  description: null,
  url: null,
  image: null,
  category: null,
  allergens: null,
  nutrition: [],
  weight: 150,
  weight_unit: 'g',
  store: null,
}

describe('lookupBarcode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_KASSALAPP_TOKEN', 'token')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns null kcal when nutrition enrichment is missing', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({ data: { products: [eanProduct] } }))
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ ...eanProduct, ean: '7038011234567', nutrition: [] }] })))

    await expect(lookupBarcode('7038011234567')).resolves.toMatchObject({
      ean: '7038011234567',
      name: 'Test yogurt',
      caloriesPer100g: null,
      labelPortionGrams: 150,
    })
  })

  it('maps energi_kcal when enrichment returns nutrition', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({ data: { products: [eanProduct] } }))
      .mockResolvedValueOnce(mockJsonResponse({
        data: [{
          ...eanProduct,
          ean: '7038011234567',
          nutrition: [{ code: 'energi_kcal', amount: 92, unit: 'kcal', display_value: '92 kcal' }],
        }],
      })))

    await expect(lookupBarcode('7038011234567')).resolves.toMatchObject({
      caloriesPer100g: 92,
    })
  })
})
