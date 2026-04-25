import type { MealType } from '@/lib/mealType'

export const SLOTS: { type: MealType }[] = [
  { type: 'Breakfast' },
  { type: 'Lunch' },
  { type: 'Dinner' },
  { type: 'Snack' },
]

/**
 * Slot header icon set: meal vectors rasterize to this square inside the w-10 tile.
 * Mixed artboards (24 / 32 / 1024) are center-scaled so optical weight matches (~18–20u “body” vs view edge).
 * `stroke` on MealSlotGlyph is the theme ink (fill for meals, stroke for the rare default fallback).
 */
export const MEAL_SLOT_GLYPH_PX = 20
/** Add (+) control: 16px coord space, stroke aligns with default stroked glyph below. */
export const MEAL_SLOT_PLUS_SVG_PX = 16
export const MEAL_SLOT_ICON_STROKE_WIDTH = 2.2

/** Center-scale per artboard so filled marks read even vs Lunch’s 24×24 “grid”. */
export const MEAL_GLYPH_OPTICAL: Record<'Breakfast' | 'Lunch' | 'Dinner' | 'Snack', number> = {
  Breakfast: 0.88,
  Lunch: 0.9,
  Dinner: 0.76,
  Snack: 0.88,
}
