import type { UseFormReturn } from 'react-hook-form'
import { selectAllOnFocus } from '@/lib/selectAllOnFocus'
import type { SimpleFoodFormData } from './simpleFoodFormCore'

const MACRO_FIELDS = [
  { label: 'Fat', plainLabel: 'Fat (g / 100g)', field: 'fatPer100g' as const, accent: 'var(--app-macro-fat)' },
  { label: 'Carbs', plainLabel: 'Carbs (g / 100g)', field: 'carbsPer100g' as const, accent: 'var(--app-macro-carbs)' },
  { label: 'Protein', plainLabel: 'Protein (g / 100g)', field: 'proteinPer100g' as const, accent: 'var(--app-macro-protein)' },
] as const

interface SimpleFoodFormFieldsProps {
  form: UseFormReturn<SimpleFoodFormData>
  portionKcalPreview: number | null
  idPrefix?: string
  layout?: 'plain' | 'sectioned'
}

export function SimpleFoodFormFields({
  form,
  portionKcalPreview,
  idPrefix = '',
  layout = 'sectioned',
}: SimpleFoodFormFieldsProps) {
  const {
    register,
    formState: { errors },
  } = form
  const fieldId = (name: string) => idPrefix ? `${idPrefix}-${name}` : name
  const isSectioned = layout === 'sectioned'

  return (
    <>
      <div>
        <label htmlFor={fieldId('name')} className="block text-sm text-[var(--app-text-secondary)] mb-1">
          Name <span className="text-[var(--app-danger)]">*</span>
        </label>
        <input
          id={fieldId('name')}
          type="text"
          autoFocus
          {...register('name')}
          className="app-input px-3 py-2"
          placeholder="e.g. Chicken breast"
        />
        {errors.name && (
          <p className="text-[var(--app-danger)] text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      {isSectioned ? (
        <section aria-labelledby={fieldId('nutrition-heading')} className="space-y-5">
          <h2
            id={fieldId('nutrition-heading')}
            className="text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-subtle)]"
          >
            Nutrition
          </h2>
          <EnergyField form={form} fieldId={fieldId('caloriesPer100g')} sectioned />
          <MacroFields form={form} fieldId={fieldId} sectioned />
        </section>
      ) : (
        <>
          <EnergyField form={form} fieldId={fieldId('caloriesPer100g')} />
          <MacroFields form={form} fieldId={fieldId} />
        </>
      )}

      <div>
        <label
          htmlFor={fieldId('labelPortionGrams')}
          className={`${isSectioned ? 'text-sm' : 'text-xs'} mb-1 block text-[var(--app-text-secondary)]`}
        >
          Serving size (g, optional)
        </label>
        <input
          id={fieldId('labelPortionGrams')}
          type="number"
          step="0.1"
          {...register('labelPortionGrams', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
          className="app-input px-3 py-2 text-sm"
          placeholder="e.g. 30 — define any portion you use"
          onFocus={selectAllOnFocus}
        />
        {portionKcalPreview != null && (
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">
            ≈ {portionKcalPreview} kcal per serving (derived from per 100g values).
          </p>
        )}
      </div>
    </>
  )
}

function EnergyField({
  form,
  fieldId,
  sectioned = false,
}: {
  form: UseFormReturn<SimpleFoodFormData>
  fieldId: string
  sectioned?: boolean
}) {
  const {
    register,
    formState: { errors },
  } = form

  const input = (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-sm text-[var(--app-text-secondary)]">
        {sectioned ? 'Kcal per 100g' : 'Energy (kcal per 100g)'} <span className="text-[var(--app-danger)]">*</span>
      </label>
      <input
        id={fieldId}
        type="number"
        {...register('caloriesPer100g', { valueAsNumber: true })}
        className="app-input px-3 py-2"
        placeholder="e.g. 165"
        onFocus={selectAllOnFocus}
      />
      {errors.caloriesPer100g && (
        <p className="mt-1 text-xs text-[var(--app-danger)]">{errors.caloriesPer100g.message}</p>
      )}
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        Use the values from the &quot;per 100g&quot; column on the nutrition label.
      </p>
    </div>
  )

  if (!sectioned) return input

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
        Energy
      </h3>
      {input}
    </div>
  )
}

function MacroFields({
  form,
  fieldId,
  sectioned = false,
}: {
  form: UseFormReturn<SimpleFoodFormData>
  fieldId: (name: string) => string
  sectioned?: boolean
}) {
  const { register } = form

  const inputs = (
    <div className="grid grid-cols-3 gap-3">
      {MACRO_FIELDS.map(({ label, plainLabel, field, accent }) => (
        <div key={field}>
          <label
            htmlFor={fieldId(field)}
            className={`${sectioned ? 'text-sm font-semibold leading-snug' : 'text-xs text-[var(--app-text-secondary)]'} mb-1 block`}
            style={sectioned ? { color: accent } : undefined}
          >
            {sectioned ? label : plainLabel}
          </label>
          <input
            id={fieldId(field)}
            type="number"
            step="0.1"
            {...register(field, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
            className="app-input px-3 py-2 text-sm"
            placeholder="—"
            onFocus={selectAllOnFocus}
          />
        </div>
      ))}
    </div>
  )

  if (!sectioned) return inputs

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
        Macros
      </h3>
      <p className="text-xs text-[var(--app-text-muted)] -mt-1 mb-1">
        Grams per 100g (optional)
      </p>
      {inputs}
    </div>
  )
}
