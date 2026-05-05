import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeeklySpendPoint } from '../lib/api'
import { formatCost } from '../lib/format'

type Props = {
  data: WeeklySpendPoint[]
  loading?: boolean
}

export function SpendChart({ data, loading }: Props) {
  if (loading) {
    return <div className="h-72 animate-pulse rounded border border-[#1e1e1e] bg-[#111111]" aria-label="Loading chart" />
  }

  const chartData = data.map((w) => ({
    label: w.weekLabel,
    spendCents: w.spendCents,
    weekStart: w.weekStart,
  }))

  return (
    <div
      className="h-72 rounded border border-[#1e1e1e] bg-[#111111] p-4"
      role="img"
      aria-label="Weekly CI spend"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#1e1e1e" vertical={false} />
          <XAxis dataKey="label" stroke="#6b6b6b" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis
            stroke="#6b6b6b"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCost(Number(v), true)}
            width={56}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(74, 222, 128, 0.08)' }}
            contentStyle={{
              background: '#111111',
              border: '1px solid #1e1e1e',
              borderRadius: 4,
              color: '#e8e8e8',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            formatter={(value) => [formatCost(Number(value ?? 0)), 'Spend']}
            labelFormatter={(_, payload) => {
              const p = payload[0]?.payload as { weekStart?: string } | undefined
              return p?.weekStart ? new Date(p.weekStart).toLocaleDateString() : ''
            }}
          />
          <Bar dataKey="spendCents" fill="#4ade80" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
