'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = {
  critical: '#002D82',
  serious:  '#005AC8',
  moderate: '#007AFF',
  minor:    '#5AC8FA',
}

interface Props {
  counts: { critical: number; serious: number; moderate: number; minor: number }
}

export function SeverityDonut({ counts }: Props) {
  const data = [
    { name: 'T1 Critical', value: counts.critical, color: COLORS.critical },
    { name: 'T2 Serious',  value: counts.serious,  color: COLORS.serious },
    { name: 'T3 Moderate', value: counts.moderate, color: COLORS.moderate },
    { name: 'T4 Minor',    value: counts.minor,    color: COLORS.minor },
  ].filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', fontSize: '14px', color: '#86868B' }}>No data yet</div>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={76}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} fillOpacity={0.9} />
          ))}
        </Pie>
        <Tooltip
          formatter={(val) => { const n = Number(val); return [`${n} (${Math.round(n/total*100)}%)`] }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #E0E0E0',
            background: '#FFFFFF',
            color: '#1D1D1F',
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={6}
          wrapperStyle={{ fontSize: 10 }}
          formatter={(value) => <span style={{ color: '#3A3A3C' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
