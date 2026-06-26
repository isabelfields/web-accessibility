'use client'

import { formatChartDate, formatChartDay } from '@/lib/format'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  points: { date: string; count: number }[]
}

export function SiteTrendChart({ points }: Props) {
  if (points.length === 0) return null

  const counts = points.map(p => p.count)
  const minVal = Math.max(0, Math.floor(Math.min(...counts) / 5) * 5 - 5)
  const maxVal = Math.ceil(Math.max(...counts) / 5) * 5 + 5

  const improving = points.length >= 2 && points[points.length - 1].count <= points[0].count
  const lineColor = improving ? '#16a34a' : '#dc2626'

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#57575A' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatChartDay(v)}
        />
        <YAxis
          domain={[minVal, maxVal]}
          tick={{ fontSize: 11, fill: '#57575A' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #E5E5EA',
            background: '#fff',
            color: '#1C1C1E',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}
          labelFormatter={(v) => formatChartDate(v)}
          formatter={(val) => [val, 'component issues']}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke={lineColor}
          strokeWidth={2}
          dot={{ r: 4, strokeWidth: 0, fill: lineColor }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
