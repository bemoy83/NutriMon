import { useState } from 'react'
import type { Meal, MealItem } from '@/types/domain'
import { formatTime } from '@/lib/date'
import { getMealTypeTheme, type MealType } from '@/lib/mealType'
import { useInvalidateDailyLog } from './useDailyLog'
import { useInvalidateMealTemplates, useInvalidateProductQueries } from './queryInvalidation'
import { deleteMeal, saveMealAsTemplate } from './api'
import type { DeleteMealResult } from '@/types/database'

const SLOTS: { type: MealType; emoji: string }[] = [
  { type: 'Breakfast', emoji: '🌅' },
  { type: 'Lunch',     emoji: '☀️' },
  { type: 'Dinner',    emoji: '🌙' },
  { type: 'Snack',     emoji: '🍎' },
]

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
  slot: { type: MealType; emoji: string }
  meals: Meal[]
  isFinalized: boolean
  timezone: string
  logDate: string
  onAdd: () => void
  onEditMeal: (meal: Meal) => void
  onDeleteSuccess: (meal: Meal, result: DeleteMealResult) => void
}) {
  const theme = getMealTypeTheme(slot.type)
  const totalCal = meals.reduce((s, m) => s + m.totalCalories, 0)
  const allMacros = meals.reduce(
    (acc, m) => {
      const mac = getMealMacros(m)
      return { protein: acc.protein + mac.protein, carbs: acc.carbs + mac.carbs, fat: acc.fat + mac.fat }
    },
    { protein: 0, carbs: 0, fat: 0 },
  )

  return (
    <div className="app-card overflow-hidden">
      {/* Slot header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div
          className="w-11 h-11 rounded-xl flex-none flex items-center justify-center text-xl"
          style={{ background: theme?.bg ?? 'var(--app-surface-muted)' }}
        >
          {slot.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--app-text-primary)' }}>
            {slot.type}
          </p>
          {meals.length > 0 ? (
            <p className="mt-1 flex items-center gap-x-2 text-[11px] tabular-nums flex-wrap">
              <span className="font-semibold" style={{ color: 'var(--app-macro-protein)' }}>
                P {Math.round(allMacros.protein)}g
              </span>
              <span style={{ color: 'var(--app-text-subtle)' }} aria-hidden>·</span>
              <span className="font-semibold" style={{ color: 'var(--app-macro-carbs)' }}>
                C {Math.round(allMacros.carbs)}g
              </span>
              <span style={{ color: 'var(--app-text-subtle)' }} aria-hidden>·</span>
              <span className="font-semibold" style={{ color: 'var(--app-macro-fat)' }}>
                F {Math.round(allMacros.fat)}g
              </span>
            </p>
          ) : (
            <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-subtle)' }}>
              Nothing logged yet
            </p>
          )}
        </div>

        {totalCal > 0 && (
          <div className="text-right flex-none mr-1">
            <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--app-text-primary)' }}>
              {totalCal}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>kcal</p>
          </div>
        )}

        {!isFinalized && (
          <button
            type="button"
            onClick={onAdd}
            className="w-9 h-9 rounded-xl flex-none flex items-center justify-center transition-opacity hover:opacity-70 active:scale-90"
            style={{ background: theme?.bg ?? 'var(--app-brand-soft)' }}
            aria-label={`Add food to ${slot.type}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 3v10M3 8h10"
                stroke={theme?.text ?? 'var(--app-brand)'}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Logged meal rows */}
      {meals.length > 0 && (
        <div className="border-t" style={{ borderColor: 'var(--app-border-muted)' }}>
          {meals.map((meal, i) => (
            <LoggedMealRow
              key={meal.id}
              meal={meal}
              isFinalized={isFinalized}
              timezone={timezone}
              logDate={logDate}
              hasDivider={i < meals.length - 1}
              onEditMeal={onEditMeal}
              onDeleteSuccess={onDeleteSuccess}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LoggedMealRow({
  meal, isFinalized, timezone, logDate, hasDivider, onEditMeal, onDeleteSuccess,
}: {
  meal: Meal
  isFinalized: boolean
  timezone: string
  logDate: string
  hasDivider: boolean
  onEditMeal: (meal: Meal) => void
  onDeleteSuccess: (meal: Meal, result: DeleteMealResult) => void
}) {
  const [expanded, setExpanded] = useState(false)
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
  const preview = items.slice(0, 3).map(i => i.productNameSnapshot).join(' · ')
  const overflow = items.length > 3 ? ` +${items.length - 3} more` : ''

  return (
    <div className={hasDivider ? 'border-b' : ''} style={{ borderColor: 'var(--app-border-muted)' }}>
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[var(--app-hover-overlay)] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs truncate" style={{ color: 'var(--app-text-secondary)' }}>
            {preview}
            {overflow && <span style={{ color: 'var(--app-text-subtle)' }}>{overflow}</span>}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
            {formatTime(meal.loggedAt, timezone)} · {meal.itemCount} item{meal.itemCount !== 1 ? 's' : ''}
            {meal.mealName ? ` · ${meal.mealName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--app-text-secondary)' }}>
            {meal.totalCalories} kcal
          </span>
          <svg
            className={`w-3.5 h-3.5 flex-none transition-transform ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--app-text-muted)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t" style={{ borderColor: 'var(--app-border-muted)' }}>
          <div className="px-4 py-2 space-y-1.5">
            {items.map(item => <MealItemRow key={item.id} item={item} />)}
          </div>

          {!isFinalized && (
            <>
              <div className="flex border-t" style={{ borderColor: 'var(--app-border-muted)' }}>
                <button
                  onClick={() => onEditMeal(meal)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-[var(--app-brand)] hover:bg-[var(--app-hover-overlay)] transition-colors"
                >
                  <svg className="w-3.5 h-3.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => { setTemplateName(meal.mealName ?? meal.mealType ?? ''); setShowSavePrompt(true) }}
                  disabled={savingTemplate}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-[var(--app-text-secondary)] hover:bg-[var(--app-hover-overlay)] transition-colors disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {savingTemplate ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-[var(--app-danger)] hover:bg-[var(--app-hover-overlay)] transition-colors disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>

              {showSavePrompt && (
                <div className="border-t px-4 py-3 flex gap-2" style={{ borderColor: 'var(--app-border-muted)' }}>
                  <input
                    autoFocus
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="Name this meal…"
                    className="app-input flex-1 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (!templateName.trim()) return
                      handleSaveTemplate(templateName.trim())
                      setShowSavePrompt(false)
                      setTemplateName('')
                    }}
                    disabled={!templateName.trim()}
                    className="app-button-primary px-3 py-2 text-sm disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSavePrompt(false)}
                    className="app-button-secondary px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MealItemRow({ item }: { item: MealItem }) {
  const servingLabel =
    item.servingAmountSnapshot && item.servingUnitSnapshot
      ? `${item.quantity * item.servingAmountSnapshot}${item.servingUnitSnapshot}`
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
