import { describe, expect, it } from 'vitest'
import { normalizeFoodCatalogRows } from '../foodCatalog'

describe('normalizeFoodCatalogRows', () => {
  it('skips category rows and produces stable catalog ids', () => {
    const rows = normalizeFoodCatalogRows([
      {
        sourceItemId: '',
        name: 'Meieriprodukter',
        ediblePortionPercent: '',
        calories: '',
        fatG: '',
        carbsG: '',
        proteinG: '',
      },
      {
        sourceItemId: '01.344',
        name: 'Appenzeller, ost',
        ediblePortionPercent: '100',
        calories: '383',
        fatG: '31.7',
        carbsG: '0',
        proteinG: '24.3',
      },
    ])

    expect(rows).toEqual([
      {
        id: 'matvaretabellen_2026:01.344',
        source: 'matvaretabellen_2026',
        source_item_id: '01.344',
        name: 'Appenzeller, ost',
        calories: 383,
        protein_g: 24.3,
        carbs_g: 0,
        fat_g: 31.7,
        default_serving_amount: 100,
        default_serving_unit: 'g',
        edible_portion_percent: 100,
      },
    ])
  })

  it('normalizes decimals and whitespace', () => {
    const rows = normalizeFoodCatalogRows([
      {
        sourceItemId: '02.100',
        name: '  Testmat   med   ekstra mellomrom ',
        ediblePortionPercent: ' 95,5 ',
        calories: ' 250,4 ',
        fatG: '10,1',
        carbsG: '12,6',
        proteinG: '5,2',
      },
    ])

    expect(rows[0]).toMatchObject({
      id: 'matvaretabellen_2026:02.100',
      name: 'Testmat med ekstra mellomrom',
      calories: 250,
      fat_g: 10.1,
      carbs_g: 12.6,
      protein_g: 5.2,
      edible_portion_percent: 95.5,
    })
  })
})
