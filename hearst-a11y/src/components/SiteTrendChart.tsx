'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Props {
  points: { date: string; count: number }[]
}

export function SiteTrendChart({ points }: Props) {
  const counts = points.map(p => p.count)
  const minVal = Math.max(0, Math.floor(Math.min(...counts) / 5) * 5 - 5)
  const maxVal = Math.ceil(Math.max(...counts) / 5) * 5 + 5

  const improving = points.length >= 2 && points[points.length - 1].count <= points[0].count

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#6B6B6B' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          domain={[minVal, maxVal]}
          tick={{ fontSize: 11, fill: '#6B6B6B' }}
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
          labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          formatter={(val) => [val, 'issues']}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke={improving ? '#2563eb' : '#2563eb'}
          strokeWidth={2}
          dot={{ r: 4, strokeWidth: 0, fill: '#2563eb' }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
