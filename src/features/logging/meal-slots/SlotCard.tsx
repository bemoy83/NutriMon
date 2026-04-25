import { useState, useRef, useEffect } from 'react'
import type { Meal } from '@/types/domain'
import { MacroPills } from '@/components/ui/MacroPills'
import { getMealTypeTheme, type MealType } from '@/lib/mealType'
import { useInvalidateDailyLog } from '../useDailyLog'
import { useInvalidateMealTemplates, useInvalidateProductQueries } from '../queryInvalidation'
import { deleteMeal, saveMealAsTemplate } from '../api'
import type { DeleteMealResult, MealMutationResult } from '@/types/database'
import { MealSlotGlyph } from './MealSlotGlyph'
import { getMealMacros } from './mealSlotMacros'
import { MEAL_SLOT_ICON_STROKE_WIDTH, MEAL_SLOT_PLUS_SVG_PX } from './constants'
import { LoggedMealRow } from './LoggedMealRow'

export function SlotCard({
  slot, meals, isFinalized, timezone, logDate, onAdd, onUpdateSuccess, onDeleteSuccess,
}: {
  slot: { type: MealType }
  meals: Meal[]
  isFinalized: boolean
  timezone: string
  logDate: string
  onAdd: () => void
  onUpdateSuccess: (result: MealMutationResult) => void
  onDeleteSuccess: (meal: Meal, result: DeleteMealResult) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const menuContainerRef = useRef<HTMLDivElement>(null)

  const theme = getMealTypeTheme(slot.type)
  const invalidateDailyLog = useInvalidateDailyLog()
  const invalidateProducts = useInvalidateProductQueries()
  const invalidateTemplates = useInvalidateMealTemplates()

  const totalCal = meals.reduce((s, m) => s + m.totalCalories, 0)
  const allMacros = meals.reduce(
    (acc, m) => {
      const mac = getMealMacros(m)
      return { protein: acc.protein + mac.protein, carbs: acc.carbs + mac.carbs, fat: acc.fat + mac.fat }
    },
    { protein: 0, carbs: 0, fat: 0 },
  )
  const allItems = meals.flatMap(m => m.items ?? [])
  const hasMeals = allItems.length > 0
  const itemPreview = allItems.slice(0, 3).map(i => i.productNameSnapshot).join(' · ')
  const itemOverflowCount = allItems.length > 3 ? allItems.length - 3 : 0

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  async function handleClearAll() {
    setMenuOpen(false)
    setDeleting(true)
    try {
      for (const meal of meals) {
        const result = await deleteMeal(meal.id)
        onDeleteSuccess(meal, result)
      }
      invalidateDailyLog(logDate)
      invalidateProducts()
      setExpanded(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleSaveTemplate(name: string) {
    if (meals.length === 0) return
    setSavingTemplate(true)
    try {
      await saveMealAsTemplate(meals[0].id, name)
      invalidateTemplates()
    } finally {
      setSavingTemplate(false)
    }
  }

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
                <MacroPills className="mt-1" showZeroValues chips={{ p: allMacros.protein, c: allMacros.carbs, f: allMacros.fat }} />
              ) : (
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

        {/* Morphing button — [+] collapsed/empty → add food; [···] expanded → overflow menu */}
        <div className="relative flex-none" ref={menuContainerRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (hasMeals && expanded) setMenuOpen(m => !m)
              else onAdd()
            }}
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center active:scale-90 transition-all duration-200"
            style={{
              background: (hasMeals && expanded) ? 'var(--app-surface-muted)' : (theme?.text ?? 'var(--app-brand)'),
              boxShadow: (hasMeals && expanded) ? 'none' : `0 2px 8px ${theme?.buttonShadow ?? 'rgba(124,58,237,0.35)'}`,
              border: 'none',
            }}
            aria-label={(hasMeals && expanded) ? `${slot.type} options` : `Add food to ${slot.type}`}
          >
            {hasMeals && expanded ? (
              <svg width={16} height={4} viewBox="0 0 16 4" fill="none" aria-hidden>
                <circle cx="2" cy="2" r="1.6" fill="var(--app-text-muted)" />
                <circle cx="8" cy="2" r="1.6" fill="var(--app-text-muted)" />
                <circle cx="14" cy="2" r="1.6" fill="var(--app-text-muted)" />
              </svg>
            ) : (
              <svg width={MEAL_SLOT_PLUS_SVG_PX} height={MEAL_SLOT_PLUS_SVG_PX} viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 3v10M3 8h10" stroke="#fff" strokeWidth={MEAL_SLOT_ICON_STROKE_WIDTH} strokeLinecap="round" />
              </svg>
            )}
          </button>

          {/* Overflow popover */}
          {menuOpen && (
            <div
              className="absolute right-0 z-[500] overflow-hidden"
              style={{
                top: 42,
                width: 224,
                borderRadius: 16,
                background: 'var(--app-surface)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
                animation: 'popIn 0.15s ease-out',
              }}
            >
              {/* Save as template */}
              <button
                type="button"
                disabled={savingTemplate}
                onClick={() => {
                  setMenuOpen(false)
                  setTemplateName(meals[0]?.mealName ?? slot.type)
                  setShowSavePrompt(true)
                }}
                className="w-full flex items-center gap-3 text-left transition-colors hover:bg-[var(--app-surface-muted)] disabled:opacity-40"
                style={{ padding: '13px 16px' }}
              >
                <div
                  className="flex items-center justify-center shrink-0 rounded-[9px]"
                  style={{ width: 30, height: 30, background: theme?.bg ?? 'var(--app-brand-soft)' }}
                >
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={theme?.text ?? 'var(--app-brand)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>Save as template</p>
                  <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>Reuse this meal anytime</p>
                </div>
              </button>

              <div style={{ height: 1, margin: '0 14px', background: 'var(--app-border-muted)' }} />

              {/* Clear all items */}
              <button
                type="button"
                disabled={deleting}
                onClick={handleClearAll}
                className="w-full flex items-center gap-3 text-left transition-colors hover:bg-[var(--app-surface-muted)] disabled:opacity-40"
                style={{ padding: '13px 16px' }}
              >
                <div
                  className="flex items-center justify-center shrink-0 rounded-[9px]"
                  style={{ width: 30, height: 30, background: '#FFF0EE' }}
                >
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </div>
                <p className="text-sm font-semibold" style={{ color: '#FF3B30' }}>
                  {deleting ? 'Clearing…' : 'Clear all items'}
                </p>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded: meal rows + optional save prompt or dashed add footer */}
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
              onUpdateSuccess={onUpdateSuccess}
            />
          ))}
          {!isFinalized && (
            <div className="px-4 py-3">
              {showSavePrompt ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && templateName.trim()) {
                        handleSaveTemplate(templateName.trim())
                        setShowSavePrompt(false)
                        setTemplateName('')
                      } else if (e.key === 'Escape') {
                        setShowSavePrompt(false)
                        setTemplateName('')
                      }
                    }}
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
                    disabled={!templateName.trim() || savingTemplate}
                    className="app-button-primary px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowSavePrompt(false); setTemplateName('') }}
                    className="app-button-secondary px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
