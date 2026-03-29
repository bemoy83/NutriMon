import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { getTodayInTimezone, guessTimezone, formatShortDate } from '@/lib/date'
import { lbToKg, kgToLb } from '@/lib/tdee'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { subDays, format } from 'date-fns'

const schema = z.object({
  entryDate: z.string().min(1),
  weightValue: z.number({ error: 'Enter weight' }).positive('Enter a positive value'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function useWeightEntries(days: 30 | 90) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['weight-entries', user?.id, days],
    enabled: !!user,
    queryFn: async () => {
      const since = format(subDays(new Date(), days), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user!.id)
        .gte('entry_date', since)
        .order('entry_date', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

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

  // Prepare chart data
  const chartData = (entriesQuery.data ?? []).map((e) => ({
    date: formatShortDate(e.entry_date),
    weight: weightUnit === 'lb' ? parseFloat(kgToLb(e.weight_kg).toFixed(1)) : parseFloat(e.weight_kg.toFixed(1)),
  }))

  return (
    <div className="min-h-full bg-slate-950 px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-white mb-6">Weight</h1>

      {/* Entry form */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <h2 className="text-white font-medium mb-4">Log weight</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="entryDate" className="block text-xs text-slate-400 mb-1">
                Date
              </label>
              <input
                id="entryDate"
                type="date"
                max={today}
                {...register('entryDate')}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="weightValue" className="text-xs text-slate-400">
                  Weight
                </label>
                <div className="flex gap-1">
                  {(['kg', 'lb'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setWeightUnit(u)}
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        weightUnit === u ? 'bg-indigo-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="weightValue"
                type="number"
                step="0.1"
                {...register('weightValue', { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={weightUnit === 'kg' ? '75.0' : '165.3'}
              />
              {errors.weightValue && (
                <p className="text-red-400 text-xs mt-1">{errors.weightValue.message}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-xs text-slate-400 mb-1">
              Notes (optional)
            </label>
            <input
              id="notes"
              type="text"
              {...register('notes')}
              className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Morning, after workout…"
            />
          </div>

          {serverError && <p className="text-red-400 text-xs">{serverError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>

      {/* Chart */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-medium">History</h2>
          <div className="flex gap-2">
            {([30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setChartDays(d)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  chartDays === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {chartData.length < 2 ? (
          <div className="h-40 flex items-center justify-center">
            <p className="text-slate-500 text-sm">Log at least 2 entries to see the chart.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#f1f5f9',
                }}
                formatter={(v) => [`${v ?? ''} ${weightUnit}`, 'Weight']}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
