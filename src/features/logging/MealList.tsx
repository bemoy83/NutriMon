import { useState } from 'react'
import type { Meal, MealItem } from '@/types/domain'
import { formatTime } from '@/lib/date'
import { getMealTypeTheme } from '@/lib/mealType'
import { useInvalidateDailyLog } from './useDailyLog'
import { useInvalidateMealTemplates, useInvalidateProductQueries } from './queryInvalidation'
import { deleteMeal, saveMealAsTemplate } from './api'
import EmptyState from '@/components/ui/EmptyState'
import type { DeleteMealResult } from '@/types/database'

interface Props {
  meals: Meal[]
  isFinalized: boolean
  timezone: string
  logDate: string
  onEditMeal: (meal: Meal) => void
  onDeleteSuccess: (meal: Meal, result: DeleteMealResult) => void
}

function getMealMacros(meal: Meal) {
  const items = meal.items ?? []
  return {
    protein: items.reduce((s, i) => s + (i.proteinGSnapshot ?? 0) * i.quantity, 0),
    carbs: items.reduce((s, i) => s + (i.carbsGSnapshot ?? 0) * i.quantity, 0),
    fat: items.reduce((s, i) => s + (i.fatGSnapshot ?? 0) * i.quantity, 0),
  }
}

export default function MealList({ meals, isFinalized, timezone, logDate, onEditMeal, onDeleteSuccess }: Props) {
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null)
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const invalidateTemplates = useInvalidateMealTemplates()

  async function handleDelete(meal: Meal) {
    setDeletingId(meal.id)
    try {
      const result = await deleteMeal(meal.id)
      invalidateDailyLog(logDate)
      invalidateProducts()
      onDeleteSuccess(meal, result)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSaveTemplate(meal: Meal, name: string) {
    setSavingTemplateId(meal.id)
    try {
      await saveMealAsTemplate(meal.id, name)
      invalidateTemplates()
    } finally {
      setSavingTemplateId(null)
    }
  }

  if (meals.length === 0) {
    return (
      <EmptyState title="No meals logged yet." description="Tap + to add your first meal." className="py-12" />
    )
  }

  return (
    <>
      <div className="space-y-2">
        {meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            isFinalized={isFinalized}
            timezone={timezone}
            expanded={expandedMealId === meal.id}
            deleting={deletingId === meal.id}
            savingTemplate={savingTemplateId === meal.id}
            onToggle={() =>
              setExpandedMealId((prev) => (prev === meal.id ? null : meal.id))
            }
            onEdit={() => onEditMeal(meal)}
            onDelete={() => handleDelete(meal)}
            onSaveTemplate={(name) => handleSaveTemplate(meal, name)}
          />
        ))}
      </div>
    </>
  )
}

function MealCard({
  meal,
  isFinalized,
  timezone,
  expanded,
  deleting,
  savingTemplate,
  onToggle,
  onEdit,
  onDelete,
  onSaveTemplate,
}: {
  meal: Meal
  isFinalized: boolean
  timezone: string
  expanded: boolean
  deleting: boolean
  savingTemplate: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onSaveTemplate: (name: string) => void
}) {
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const macros = getMealMacros(meal)
  const hasMacros = macros.protein > 0 || macros.carbs > 0 || macros.fat > 0
  const theme = getMealTypeTheme(meal.mealType)

  return (
    <div
      className="app-card overflow-hidden"
      style={theme ? { background: theme.bg, borderLeft: `3px solid ${theme.accent}` } : undefined}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-black/5"
      >
        <div>
          <p className="text-[var(--app-text-primary)] text-sm font-medium">
            {meal.mealName ?? meal.mealType ?? formatTime(meal.loggedAt, timezone)}
          </p>
          <p className="text-[var(--app-text-muted)] text-xs mt-0.5">
            {(meal.mealName || meal.mealType) && (
              <span className="mr-1">{formatTime(meal.loggedAt, timezone)} ·</span>
            )}
            {meal.mealName && meal.mealType && (
              <span className="mr-1">{meal.mealType} ·</span>
            )}
            {meal.itemCount} item{meal.itemCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[var(--app-text-primary)] font-semibold">{meal.totalCalories} kcal</span>
          <svg
            className={`w-4 h-4 text-[var(--app-text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t" style={{ borderColor: theme ? theme.divider : 'var(--app-border)' }}>
          {/* Macro summary strip */}
          {hasMacros && (
            <div
              className="flex items-center justify-around px-4 py-2.5 border-b"
              style={{ borderColor: theme ? theme.divider : 'var(--app-border-muted)' }}
            >
              <MacroStat label="Protein" value={macros.protein} color="var(--app-macro-protein)" />
              <MacroStat label="Carbs" value={macros.carbs} color="var(--app-macro-carbs)" />
              <MacroStat label="Fat" value={macros.fat} color="var(--app-macro-fat)" />
            </div>
          )}

          {/* Items */}
          <div className="px-4 py-2 space-y-1.5">
            {(meal.items ?? []).map((item) => (
              <MealItemRow key={item.id} item={item} />
            ))}
          </div>

          {/* Actions */}
          {!isFinalized && (
            <>
              <div className="flex border-t" style={{ borderColor: theme ? theme.divider : 'var(--app-border)' }}>
                <button
                  onClick={onEdit}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-[var(--app-brand)] transition-colors hover:bg-black/5"
                >
                  <svg className="w-3.5 h-3.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => {
                    setTemplateName(meal.mealName ?? meal.mealType ?? '')
                    setShowSavePrompt(true)
                  }}
                  disabled={savingTemplate}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-[var(--app-text-secondary)] transition-colors hover:bg-black/5 disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {savingTemplate ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={onDelete}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-[var(--app-danger)] transition-colors hover:bg-black/5 disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
              {showSavePrompt && (
                <div className="border-t px-4 py-3 flex gap-2" style={{ borderColor: theme ? theme.divider : 'var(--app-border)' }}>
                  <input
                    autoFocus
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Name this meal…"
                    className="app-input flex-1 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (!templateName.trim()) return
                      onSaveTemplate(templateName.trim())
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

function MacroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-sm font-semibold" style={{ color }}>
        {Math.round(value)}g
      </span>
      <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
        {label}
      </span>
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
        <span className="text-[var(--app-text-primary)] text-sm truncate">{item.productNameSnapshot}</span>
        <span className="text-[var(--app-text-muted)] text-xs flex-none">{servingLabel}</span>
      </div>
      <span className="text-[var(--app-text-secondary)] text-sm flex-none">{item.lineTotalCalories} kcal</span>
    </div>
  )
}
