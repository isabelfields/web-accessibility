'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface TrendPoint {
  bucket: string
  label: string
  [division: string]: string | number
}

interface Props {
  points: TrendPoint[]
  divisions: string[]
}

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#4f46e5', '#be123c']

export function DivisionTrendChart({ points, divisions }: Props) {
  if (points.length === 0 || divisions.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-[#57575A]">No completed scans in this period.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={points} margin={{ top: 8, right: 20, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#57575A' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#57575A' }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #E5E5EA',
            background: '#fff',
            color: '#1C1C1E',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}
          formatter={(value, name) => [value, `${name} issues`]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {divisions.map((division, index) => (
          <Line
            key={division}
            type="monotone"
            dataKey={division}
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
