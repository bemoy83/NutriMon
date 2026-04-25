import { useState, type ReactNode } from 'react'
import type { Meal, MealItem } from '@/types/domain'
import { MacroPills } from '@/components/ui/MacroPills'
import { formatTime } from '@/lib/date'
import { getMealTypeTheme, type MealType } from '@/lib/mealType'
import { useInvalidateDailyLog } from './useDailyLog'
import { useInvalidateMealTemplates, useInvalidateProductQueries } from './queryInvalidation'
import { deleteMeal, saveMealAsTemplate } from './api'
import type { DeleteMealResult } from '@/types/database'

const SLOTS: { type: MealType }[] = [
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
const MEAL_SLOT_GLYPH_PX = 20
/** Add (+) control: 16px coord space, stroke aligns with default stroked glyph below. */
const MEAL_SLOT_PLUS_SVG_PX = 16
const MEAL_SLOT_ICON_STROKE_WIDTH = 2.2

/** Center-scale per artboard so filled marks read even vs Lunch’s 24×24 “grid”. */
const MEAL_GLYPH_OPTICAL: Record<'Breakfast' | 'Lunch' | 'Dinner' | 'Snack', number> = {
  Breakfast: 0.88,
  Lunch: 0.9,
  Dinner: 0.76,
  Snack: 0.88,
}

function MealGlyphOpticalFit({
  viewCx,
  viewCy,
  scale,
  children,
}: {
  viewCx: number
  viewCy: number
  scale: number
  children: ReactNode
}) {
  return (
    <g transform={`translate(${viewCx} ${viewCy}) scale(${scale}) translate(${-viewCx} ${-viewCy})`}>
      {children}
    </g>
  )
}

/** Meal slot glyphs (Breakfast–Snack): filled paths, theme color from `stroke` prop. */
function MealSlotGlyph({ type, stroke }: { type: MealType; stroke: string }) {
  const box = {
    width: MEAL_SLOT_GLYPH_PX,
    height: MEAL_SLOT_GLYPH_PX,
    viewBox: '0 0 16 16',
    fill: 'none' as const,
    'aria-hidden': true as const,
  }

  switch (type) {
    case 'Breakfast':
      return (
        <svg width={MEAL_SLOT_GLYPH_PX} height={MEAL_SLOT_GLYPH_PX} viewBox="0 0 1024 1024" fill="none" aria-hidden>
          <MealGlyphOpticalFit viewCx={512} viewCy={512} scale={MEAL_GLYPH_OPTICAL.Breakfast}>
            <path
              fill={stroke}
              d="M32 768h960a32 32 0 1 1 0 64H32a32 32 0 1 1 0-64zm129.408-96a352 352 0 0 1 701.184 0h-64.32a288 288 0 0 0-572.544 0h-64.32zM512 128a32 32 0 0 1 32 32v96a32 32 0 0 1-64 0v-96a32 32 0 0 1 32-32zm407.296 168.704a32 32 0 0 1 0 45.248l-67.84 67.84a32 32 0 1 1-45.248-45.248l67.84-67.84a32 32 0 0 1 45.248 0zm-814.592 0a32 32 0 0 1 45.248 0l67.84 67.84a32 32 0 1 1-45.248 45.248l-67.84-67.84a32 32 0 0 1 0-45.248z"
            />
          </MealGlyphOpticalFit>
        </svg>
      )
    case 'Lunch':
      return (
        <svg width={MEAL_SLOT_GLYPH_PX} height={MEAL_SLOT_GLYPH_PX} viewBox="0 0 24 24" fill="none" aria-hidden>
          <MealGlyphOpticalFit viewCx={12} viewCy={12} scale={MEAL_GLYPH_OPTICAL.Lunch}>
            <path
              fill={stroke}
              d="M12 17.75C10.8628 17.75 9.75106 17.4128 8.80547 16.781C7.85989 16.1491 7.1229 15.2511 6.6877 14.2004C6.25249 13.1498 6.13862 11.9936 6.36049 10.8782C6.58235 9.76284 7.12999 8.73829 7.93414 7.93414C8.73829 7.12999 9.76284 6.58235 10.8782 6.36049C11.9936 6.13862 13.1498 6.25249 14.2004 6.6877C15.2511 7.1229 16.1491 7.85989 16.781 8.80547C17.4128 9.75106 17.75 10.8628 17.75 12C17.7474 13.5242 17.1407 14.9852 16.0629 16.0629C14.9852 17.1407 13.5242 17.7474 12 17.75ZM12 7.75C11.1594 7.75 10.3377 7.99926 9.63883 8.46626C8.93992 8.93325 8.39519 9.59701 8.07351 10.3736C7.75184 11.1502 7.66768 12.0047 7.83167 12.8291C7.99565 13.6536 8.40043 14.4108 8.9948 15.0052C9.58917 15.5996 10.3464 16.0044 11.1709 16.1683C11.9953 16.3323 12.8498 16.2482 13.6264 15.9265C14.403 15.6048 15.0668 15.0601 15.5337 14.3612C16.0007 13.6623 16.25 12.8406 16.25 12C16.2474 10.8736 15.7987 9.79417 15.0023 8.99772C14.2058 8.20126 13.1264 7.75264 12 7.75Z"
            />
            <path
              fill={stroke}
              d="M12 5C11.8019 4.99741 11.6126 4.91756 11.4725 4.77747C11.3324 4.63737 11.2526 4.44811 11.25 4.25V2.75C11.25 2.55109 11.329 2.36032 11.4697 2.21967C11.6103 2.07902 11.8011 2 12 2C12.1989 2 12.3897 2.07902 12.5303 2.21967C12.671 2.36032 12.75 2.55109 12.75 2.75V4.25C12.7474 4.44811 12.6676 4.63737 12.5275 4.77747C12.3874 4.91756 12.1981 4.99741 12 5Z"
            />
            <path
              fill={stroke}
              d="M12 22C11.8019 21.9974 11.6126 21.9176 11.4725 21.7775C11.3324 21.6374 11.2526 21.4481 11.25 21.25V19.75C11.25 19.5511 11.329 19.3603 11.4697 19.2197C11.6103 19.079 11.8011 19 12 19C12.1989 19 12.3897 19.079 12.5303 19.2197C12.671 19.3603 12.75 19.5511 12.75 19.75V21.25C12.7474 21.4481 12.6676 21.6374 12.5275 21.7775C12.3874 21.9176 12.1981 21.9974 12 22Z"
            />
            <path
              fill={stroke}
              d="M21.25 12.75H19.75C19.5511 12.75 19.3603 12.671 19.2197 12.5303C19.079 12.3897 19 12.1989 19 12C19 11.8011 19.079 11.6103 19.2197 11.4697C19.3603 11.329 19.5511 11.25 19.75 11.25H21.25C21.4489 11.25 21.6397 11.329 21.7803 11.4697C21.921 11.6103 22 11.8011 22 12C22 12.1989 21.921 12.3897 21.7803 12.5303C21.6397 12.671 21.4489 12.75 21.25 12.75Z"
            />
            <path
              fill={stroke}
              d="M4.25 12.75H2.75C2.55109 12.75 2.36032 12.671 2.21967 12.5303C2.07902 12.3897 2 12.1989 2 12C2 11.8011 2.07902 11.6103 2.21967 11.4697C2.36032 11.329 2.55109 11.25 2.75 11.25H4.25C4.44891 11.25 4.63968 11.329 4.78033 11.4697C4.92098 11.6103 5 11.8011 5 12C5 12.1989 4.92098 12.3897 4.78033 12.5303C4.63968 12.671 4.44891 12.75 4.25 12.75Z"
            />
            <path
              fill={stroke}
              d="M6.50001 7.24995C6.30707 7.2352 6.12758 7.14545 6.00001 6.99995L4.91001 5.99995C4.83844 5.92838 4.78167 5.84341 4.74293 5.7499C4.7042 5.65639 4.68427 5.55617 4.68427 5.45495C4.68427 5.35373 4.7042 5.25351 4.74293 5.16C4.78167 5.06649 4.83844 4.98152 4.91001 4.90995C4.98158 4.83838 5.06655 4.78161 5.16006 4.74287C5.25357 4.70414 5.3538 4.6842 5.45501 4.6842C5.55623 4.6842 5.65645 4.70414 5.74996 4.74287C5.84347 4.78161 5.92844 4.83838 6.00001 4.90995L7.00001 5.99995C7.123 6.13746 7.19099 6.31547 7.19099 6.49995C7.19099 6.68443 7.123 6.86244 7.00001 6.99995C6.87244 7.14545 6.69295 7.2352 6.50001 7.24995Z"
            />
            <path
              fill={stroke}
              d="M18.56 19.31C18.4615 19.3104 18.3638 19.2912 18.2728 19.2534C18.1818 19.2157 18.0993 19.1601 18.03 19.09L17 18C16.9332 17.86 16.9114 17.7028 16.9376 17.5499C16.9638 17.3971 17.0368 17.2561 17.1465 17.1464C17.2561 17.0368 17.3971 16.9638 17.55 16.9376C17.7028 16.9113 17.8601 16.9331 18 17L19.09 18C19.2305 18.1406 19.3094 18.3312 19.3094 18.53C19.3094 18.7287 19.2305 18.9194 19.09 19.06C19.0233 19.1355 18.9419 19.1967 18.8508 19.2397C18.7597 19.2827 18.6607 19.3066 18.56 19.31Z"
            />
            <path
              fill={stroke}
              d="M17.5 7.24995C17.3071 7.2352 17.1276 7.14545 17 6.99995C16.877 6.86244 16.809 6.68443 16.809 6.49995C16.809 6.31547 16.877 6.13746 17 5.99995L18 4.90995C18.1445 4.76541 18.3406 4.6842 18.545 4.6842C18.7494 4.6842 18.9455 4.76541 19.09 4.90995C19.2345 5.05449 19.3158 5.25054 19.3158 5.45495C19.3158 5.65936 19.2345 5.85541 19.09 5.99995L18 6.99995C17.8724 7.14545 17.6929 7.2352 17.5 7.24995Z"
            />
            <path
              fill={stroke}
              d="M5.44001 19.31C5.34147 19.3104 5.24383 19.2912 5.15282 19.2534C5.06181 19.2157 4.97926 19.1601 4.91001 19.09C4.76956 18.9494 4.69067 18.7587 4.69067 18.56C4.69067 18.3612 4.76956 18.1706 4.91001 18.03L6.00001 17C6.13997 16.9331 6.2972 16.9113 6.45006 16.9376C6.60293 16.9638 6.7439 17.0368 6.85357 17.1464C6.96324 17.2561 7.03621 17.3971 7.06244 17.5499C7.08866 17.7028 7.06685 17.86 7.00001 18L6.00001 19.09C5.92728 19.1638 5.83985 19.2216 5.74338 19.2595C5.64691 19.2974 5.54356 19.3146 5.44001 19.31Z"
            />
          </MealGlyphOpticalFit>
        </svg>
      )
    case 'Dinner':
      return (
        <svg width={MEAL_SLOT_GLYPH_PX} height={MEAL_SLOT_GLYPH_PX} viewBox="0 0 32 32" fill="none" aria-hidden>
          <MealGlyphOpticalFit viewCx={16} viewCy={16} scale={MEAL_GLYPH_OPTICAL.Dinner}>
            <path
              fill={stroke}
              d="M29.223 24.178l-0.021-0.057c-0.116-0.274-0.383-0.463-0.694-0.463-0.104 0-0.202 0.021-0.292 0.059l0.005-0.002c-1.272 0.542-2.752 0.857-4.306 0.857-6.213 0-11.25-5.037-11.25-11.25 0-4.66 2.833-8.658 6.871-10.366l0.074-0.028 0.211-0.089c0.267-0.118 0.45-0.381 0.45-0.687 0-0.375-0.276-0.686-0.635-0.74l-0.004-0.001c-0.653-0.103-1.407-0.161-2.174-0.161-8.145 0-14.748 6.603-14.748 14.748s6.603 14.748 14.748 14.748c4.748 0 8.973-2.244 11.67-5.73l0.025-0.034c0.097-0.125 0.155-0.285 0.155-0.458 0-0.127-0.031-0.246-0.086-0.351l0.002 0.004zM22.518 28.24c-1.497 0.637-3.238 1.007-5.066 1.007-7.317 0-13.249-5.932-13.249-13.249 0-7.074 5.543-12.853 12.523-13.23l0.034-0.001c-3.395 2.326-5.594 6.183-5.594 10.554 0 7.043 5.709 12.752 12.752 12.752 0.85 0 1.681-0.083 2.485-0.242l-0.081 0.013c-1.081 0.976-2.339 1.783-3.716 2.364l-0.087 0.033z"
            />
          </MealGlyphOpticalFit>
        </svg>
      )
    case 'Snack':
      return (
        <svg width={MEAL_SLOT_GLYPH_PX} height={MEAL_SLOT_GLYPH_PX} viewBox="0 0 1024 1024" fill="none" aria-hidden>
          <MealGlyphOpticalFit viewCx={512} viewCy={512} scale={MEAL_GLYPH_OPTICAL.Snack}>
            <path
              fill={stroke}
              d="M599.872 203.776a189.44 189.44 0 0 1 64.384-4.672l2.624.128c31.168 1.024 51.2 4.096 79.488 16.32 37.632 16.128 74.496 45.056 111.488 89.344 96.384 115.264 82.752 372.8-34.752 521.728-7.68 9.728-32 41.6-30.72 39.936a426.624 426.624 0 0 1-30.08 35.776c-31.232 32.576-65.28 49.216-110.08 50.048-31.36.64-53.568-5.312-84.288-18.752l-6.528-2.88c-20.992-9.216-30.592-11.904-47.296-11.904-18.112 0-28.608 2.88-51.136 12.672l-6.464 2.816c-28.416 12.224-48.32 18.048-76.16 19.2-74.112 2.752-116.928-38.08-180.672-132.16-96.64-142.08-132.608-349.312-55.04-486.4 46.272-81.92 129.92-133.632 220.672-135.04 32.832-.576 60.288 6.848 99.648 22.72 27.136 10.88 34.752 13.76 37.376 14.272 16.256-20.16 27.776-36.992 34.56-50.24 13.568-26.304 27.2-59.968 40.704-100.8a32 32 0 1 1 60.8 20.224c-12.608 37.888-25.408 70.4-38.528 97.664zm-51.52 78.08c-14.528 17.792-31.808 37.376-51.904 58.816a32 32 0 1 1-46.72-43.776l12.288-13.248c-28.032-11.2-61.248-26.688-95.68-26.112-70.4 1.088-135.296 41.6-171.648 105.792C121.6 492.608 176 684.16 247.296 788.992c34.816 51.328 76.352 108.992 130.944 106.944 52.48-2.112 72.32-34.688 135.872-34.688 63.552 0 81.28 34.688 136.96 33.536 56.448-1.088 75.776-39.04 126.848-103.872 107.904-136.768 107.904-362.752 35.776-449.088-72.192-86.272-124.672-84.096-151.68-85.12-41.472-4.288-81.6 12.544-113.664 25.152z"
            />
          </MealGlyphOpticalFit>
        </svg>
      )
    default:
      return (
        <svg {...box}>
          <circle cx="8" cy="8" r="4.25" stroke={stroke} strokeWidth={MEAL_SLOT_ICON_STROKE_WIDTH} />
        </svg>
      )
  }
}

function getMealMacros(meal: Meal) {
  const items = meal.items ?? []
  return {
    protein: items.reduce((s, i) => s + (i.proteinGSnapshot ?? 0) * i.quantity, 0),
    carbs:   items.reduce((s, i) => s + (i.carbsGSnapshot ?? 0) * i.quantity, 0),
    fat:     items.reduce((s, i) => s + (i.fatGSnapshot ?? 0) * i.quantity, 0),
  }
}

interface Props {
  meals: Meal[]
  isFinalized: boolean
  timezone: string
  logDate: string
  onAddToSlot: (type: MealType) => void
  onEditMeal: (meal: Meal) => void
  onDeleteSuccess: (meal: Meal, result: DeleteMealResult) => void
}

export default function MealSlots({
  meals, isFinalized, timezone, logDate, onAddToSlot, onEditMeal, onDeleteSuccess,
}: Props) {
  return (
    <div className="space-y-2">
      {SLOTS.map(slot => {
        const slotMeals = meals.filter(m => m.mealType === slot.type)
        return (
          <SlotCard
            key={slot.type}
            slot={slot}
            meals={slotMeals}
            isFinalized={isFinalized}
            timezone={timezone}
            logDate={logDate}
            onAdd={() => onAddToSlot(slot.type)}
            onEditMeal={onEditMeal}
            onDeleteSuccess={onDeleteSuccess}
          />
        )
      })}
    </div>
  )
}

function SlotCard({
  slot, meals, isFinalized, timezone, logDate, onAdd, onEditMeal, onDeleteSuccess,
}: {
  slot: { type: MealType }
  meals: Meal[]
  isFinalized: boolean
  timezone: string
  logDate: string
  onAdd: () => void
  onEditMeal: (meal: Meal) => void
  onDeleteSuccess: (meal: Meal, result: DeleteMealResult) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const theme = getMealTypeTheme(slot.type)
  const totalCal = meals.reduce((s, m) => s + m.totalCalories, 0)
  const allMacros = meals.reduce(
    (acc, m) => {
      const mac = getMealMacros(m)
      return { protein: acc.protein + mac.protein, carbs: acc.carbs + mac.carbs, fat: acc.fat + mac.fat }
    },
    { protein: 0, carbs: 0, fat: 0 },
  )
  const hasMeals = meals.length > 0
  const allItems = meals.flatMap(m => m.items ?? [])
  const itemPreview = allItems.slice(0, 3).map(i => i.productNameSnapshot).join(' · ')
  const itemOverflowCount = allItems.length > 3 ? allItems.length - 3 : 0

  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3.5">

        {/* LEFT ZONE — tappable: expand when collapsed, collapse when expanded, add when empty */}
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none"
          onClick={() => hasMeals ? setExpanded(e => !e) : onAdd()}
        >
          <div
            className="w-10 h-10 rounded-xl flex-none flex items-center justify-center"
            style={{ background: theme?.bg ?? 'var(--app-surface-muted)' }}
            aria-hidden
          >
            <MealSlotGlyph type={slot.type} stroke={theme?.text ?? 'var(--app-text-secondary)'} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: 'var(--app-text-primary)' }}>
              {slot.type}
            </p>
            {hasMeals ? (
              expanded ? (
                /* Expanded subtitle: macros (items are visible below) */
                <MacroPills className="mt-1" showZeroValues chips={{ p: allMacros.protein, c: allMacros.carbs, f: allMacros.fat }} />
              ) : (
                /* Collapsed subtitle: item names (answer "what did I eat?") */
                <p className="text-xs mt-1 truncate" style={{ color: 'var(--app-text-muted)' }}>
                  {itemPreview}
                  {itemOverflowCount > 0 && <span style={{ color: 'var(--app-text-subtle)' }}> +{itemOverflowCount} more</span>}
                </p>
              )
            ) : (
              <p className="text-xs mt-0.5 italic" style={{ color: 'var(--app-text-subtle)' }}>
                Nothing logged yet
              </p>
            )}
          </div>
        </div>

        {/* Kcal badge */}
        {totalCal > 0 && (
          <div className="rounded-[10px] px-2.5 py-1 flex-none" style={{ background: theme?.bg ?? 'var(--app-surface-muted)' }}>
            <span className="text-sm font-bold tabular-nums" style={{ color: theme?.text ?? 'var(--app-text-primary)' }}>
              {totalCal}
            </span>
            <span className="text-[10px] ml-0.5 opacity-70" style={{ color: theme?.text ?? 'var(--app-text-muted)' }}>kcal</span>
          </div>
        )}

        {/* Morphing button — [+] when collapsed/empty → add; [↑] when expanded → collapse */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (expanded) setExpanded(false)
            else onAdd()
          }}
          className="w-[34px] h-[34px] rounded-[10px] flex-none flex items-center justify-center active:scale-90 transition-all duration-200"
          style={{
            background: expanded ? 'var(--app-surface-muted)' : (theme?.text ?? 'var(--app-brand)'),
            boxShadow: expanded ? 'none' : `0 2px 8px ${theme?.buttonShadow ?? 'rgba(124,58,237,0.35)'}`,
            border: 'none',
          }}
          aria-label={expanded ? `Collapse ${slot.type}` : `Add food to ${slot.type}`}
        >
          {expanded ? (
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2.5 9.5l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--app-text-muted)' }} />
            </svg>
          ) : (
            <svg width={MEAL_SLOT_PLUS_SVG_PX} height={MEAL_SLOT_PLUS_SVG_PX} viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="#fff" strokeWidth={MEAL_SLOT_ICON_STROKE_WIDTH} strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Expanded: meal rows + dashed add footer */}
      {expanded && hasMeals && (
        <div>
          <div className="mx-4 h-px" style={{ background: 'var(--app-border-muted)' }} />
          {meals.map((meal, i) => (
            <LoggedMealRow
              key={meal.id}
              meal={meal}
              isFinalized={isFinalized}
              timezone={timezone}
              logDate={logDate}
              hasDivider={i < meals.length - 1}
              showMealLabel={meals.length > 1}
              onEditMeal={onEditMeal}
              onDeleteSuccess={onDeleteSuccess}
            />
          ))}
          {!isFinalized && (
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={onAdd}
                className="w-full h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
                style={{ border: `1.5px dashed ${(theme?.text ?? 'var(--app-brand)') + '50'}`, color: theme?.text ?? 'var(--app-brand)', background: 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = theme?.bg ?? 'var(--app-brand-soft)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <svg width={MEAL_SLOT_PLUS_SVG_PX} height={MEAL_SLOT_PLUS_SVG_PX} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 3v10M3 8h10" stroke={theme?.text ?? 'var(--app-brand)'} strokeWidth={MEAL_SLOT_ICON_STROKE_WIDTH} strokeLinecap="round" />
                </svg>
                Add food
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LoggedMealRow({
  meal, isFinalized, timezone, logDate, hasDivider, showMealLabel, onEditMeal, onDeleteSuccess,
}: {
  meal: Meal
  isFinalized: boolean
  timezone: string
  logDate: string
  hasDivider: boolean
  showMealLabel: boolean
  onEditMeal: (meal: Meal) => void
  onDeleteSuccess: (meal: Meal, result: DeleteMealResult) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const invalidateTemplates = useInvalidateMealTemplates()

  async function handleDelete() {
    setDeleting(true)
    try {
      const result = await deleteMeal(meal.id)
      invalidateDailyLog(logDate)
      invalidateProducts()
      onDeleteSuccess(meal, result)
    } finally {
      setDeleting(false)
    }
  }

  async function handleSaveTemplate(name: string) {
    setSavingTemplate(true)
    try {
      await saveMealAsTemplate(meal.id, name)
      invalidateTemplates()
    } finally {
      setSavingTemplate(false)
    }
  }

  const items = meal.items ?? []

  return (
    <div>
      {/* Meal label — only when multiple meals share the same slot */}
      {showMealLabel && (
        <p className="px-4 pt-2.5 pb-0.5 text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
          {meal.mealName ?? formatTime(meal.loggedAt, timezone)}
        </p>
      )}

      {/* Food items — always visible, no nested expand */}
      <div className="px-4 py-2 space-y-1.5">
        {items.map(item => <MealItemRow key={item.id} item={item} />)}
      </div>

      {/* Actions */}
      {!isFinalized && (
        <div className="px-4 py-2.5 space-y-2">
          <div className="h-px mb-2.5" style={{ background: 'var(--app-border-muted)' }} />
          {showSavePrompt ? (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Name this meal…"
                className="app-input flex-1 px-3 py-1.5 text-sm"
              />
              <button
                onClick={() => {
                  if (!templateName.trim()) return
                  handleSaveTemplate(templateName.trim())
                  setShowSavePrompt(false)
                  setTemplateName('')
                }}
                disabled={!templateName.trim()}
                className="app-button-primary px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Save
              </button>
              <button onClick={() => setShowSavePrompt(false)} className="app-button-secondary px-3 py-1.5 text-sm">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEditMeal(meal)}
                className="flex-1 app-button-secondary px-3 py-1.5 text-sm text-center"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 app-button-danger px-3 py-1.5 text-sm text-center disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => { setTemplateName(meal.mealName ?? meal.mealType ?? ''); setShowSavePrompt(true) }}
                disabled={savingTemplate}
                className="flex items-center gap-1 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] transition-colors disabled:opacity-40 flex-none"
                title="Save as template"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
      {hasDivider && <div className="mx-4 h-px mt-1" style={{ background: 'var(--app-border-muted)' }} />}
    </div>
  )
}

function MealItemRow({ item }: { item: MealItem }) {
  const servingLabel =
    item.servingAmountSnapshot && item.servingUnitSnapshot
      ? `${parseFloat((item.quantity * item.servingAmountSnapshot).toPrecision(6))}${item.servingUnitSnapshot}`
      : `×${item.quantity}`
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-sm truncate" style={{ color: 'var(--app-text-primary)' }}>{item.productNameSnapshot}</span>
        <span className="text-xs flex-none" style={{ color: 'var(--app-text-muted)' }}>{servingLabel}</span>
      </div>
      <span className="text-sm flex-none" style={{ color: 'var(--app-text-secondary)' }}>{item.lineTotalCalories} kcal</span>
    </div>
  )
}
