'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = {
  critical: '#e11d48',
  serious:  '#9333ea',
  moderate: '#0891b2',
  minor:    '#059669',
}

interface Props {
  counts: { critical: number; serious: number; moderate: number; minor: number }
}

export function SeverityDonut({ counts }: Props) {
  const data = [
    { name: 'Critical', value: counts.critical, color: COLORS.critical },
    { name: 'Serious',  value: counts.serious,  color: COLORS.serious },
    { name: 'Moderate', value: counts.moderate, color: COLORS.moderate },
    { name: 'Minor',    value: counts.minor,    color: COLORS.minor },
  ].filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="flex items-center justify-center h-40 text-sm text-gray-300">No data yet</div>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(val) => { const n = Number(val); return [`${n} (${Math.round(n/total*100)}%)`] }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => <span style={{ color: '#6b7280' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
