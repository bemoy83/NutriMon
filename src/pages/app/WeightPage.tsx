import { lazy, Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { getTodayInTimezone, guessTimezone, formatShortDate } from '@/lib/date'
import { lbToKg, kgToLb } from '@/lib/tdee'
import { useWeightEntries } from '@/features/weight/useWeightEntries'
import EmptyState from '@/components/ui/EmptyState'
import { PageTitle, SectionHeader } from '@/components/ui/AppHeadings'
import SegmentedTabs from '@/components/ui/SegmentedTabs'

const schema = z.object({
  entryDate: z.string().min(1),
  weightValue: z.number({ error: 'Enter weight' }).positive('Enter a positive value'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const WeightHistoryChart = lazy(() => import('@/features/weight/WeightHistoryChart'))
const WEIGHT_UNIT_OPTIONS = [
  { label: 'kg', value: 'kg' },
  { label: 'lb', value: 'lb' },
] as const
const CHART_DAYS_OPTIONS = [
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
] as const

export default function WeightPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const timezone = guessTimezone()
  const today = getTodayInTimezone(timezone)

  const [chartDays, setChartDays] = useState<30 | 90>(30)
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg')
  const [serverError, setServerError] = useState<string | null>(null)

  const entriesQuery = useWeightEntries(chartDays)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { entryDate: today },
  })

  async function onSubmit(data: FormData) {
    if (!user) return
    setServerError(null)
    const weightKg = weightUnit === 'lb' ? lbToKg(data.weightValue) : data.weightValue

    const { error } = await supabase
      .from('weight_entries')
      .upsert(
        {
          user_id: user.id,
          entry_date: data.entryDate,
          weight_kg: parseFloat(weightKg.toFixed(4)),
          source_unit: weightUnit,
          source_value: data.weightValue,
          notes: data.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,entry_date' },
      )

    if (error) {
      setServerError(error.message)
      return
    }

    qc.invalidateQueries({ queryKey: ['weight-entries', user.id] })
    reset({ entryDate: today })
  }

  const chartData = (entriesQuery.data ?? []).map((e) => ({
    date: formatShortDate(e.entryDate),
    weight: weightUnit === 'lb' ? parseFloat(kgToLb(e.weightKg).toFixed(1)) : parseFloat(e.weightKg.toFixed(1)),
  }))

  return (
    <div className="app-page min-h-full px-4 py-6 pb-24">
      <PageTitle>Weight</PageTitle>

      {/* Entry form */}
      <SectionHeader>Log weight</SectionHeader>
      <div className="app-card mb-5 p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="weightValue" className="text-xs text-[var(--app-text-muted)]">
                Weight
              </label>
              <SegmentedTabs
                options={WEIGHT_UNIT_OPTIONS}
                value={weightUnit}
                onChange={setWeightUnit}
                className="w-24 !bg-transparent !p-0"
              />
            </div>
            <input
              id="weightValue"
              type="number"
              step="0.1"
              {...register('weightValue', { valueAsNumber: true })}
              className="app-input px-3 py-2 text-sm"
              placeholder={weightUnit === 'kg' ? '75.0' : '165.3'}
            />
            {errors.weightValue && (
              <p className="text-[var(--app-danger)] text-xs mt-1">{errors.weightValue.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="entryDate" className="block text-xs text-[var(--app-text-muted)] mb-1">
              Date
            </label>
            <input
              id="entryDate"
              type="date"
              max={today}
              {...register('entryDate')}
              className="app-input px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-xs text-[var(--app-text-muted)] mb-1">
              Notes (optional)
            </label>
            <input
              id="notes"
              type="text"
              {...register('notes')}
              className="app-input px-3 py-2 text-sm"
              placeholder="Morning, after workout…"
            />
          </div>

          {serverError && <p className="text-[var(--app-danger)] text-xs">{serverError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="app-button-primary w-full py-2.5"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>

      {/* Chart */}
      <SectionHeader>History</SectionHeader>
      <div className="app-card p-4">
        <SegmentedTabs
          options={CHART_DAYS_OPTIONS}
          value={`${chartDays}` as '30' | '90'}
          onChange={(value) => setChartDays(Number(value) as 30 | 90)}
          className="mb-4 !bg-transparent !p-0"
        />

        {chartData.length < 2 ? (
          <div className="h-40 flex items-center justify-center">
            <EmptyState title="Log at least 2 entries to see the chart." className="py-0" />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="h-[200px] flex items-center justify-center text-sm text-[var(--app-text-muted)]">
                Loading chart...
              </div>
            }
          >
            <WeightHistoryChart data={chartData} weightUnit={weightUnit} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
