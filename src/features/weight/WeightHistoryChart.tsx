import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface WeightHistoryChartProps {
  data: Array<{
    date: string
    weight: number
  }>
  weightUnit: 'kg' | 'lb'
}

export default function WeightHistoryChart({ data, weightUnit }: WeightHistoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--app-chart-grid)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--app-text-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--app-text-muted)' }}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--app-surface)',
            border: '1px solid var(--app-border)',
            borderRadius: 8,
            color: 'var(--app-text-primary)',
          }}
          formatter={(value) => [`${value ?? ''} ${weightUnit}`, 'Weight']}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="var(--app-chart-line)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
