'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = {
  critical: '#1e40af',
  serious:  '#2563eb',
  moderate: '#60a5fa',
  minor:    '#bfdbfe',
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
  const tooltipStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text)',
    fontSize: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  }

  if (total === 0) return <div className="flex items-center justify-center h-40 text-sm text-[var(--text-muted)]">No data yet</div>

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
          contentStyle={tooltipStyle}
        />
        <Legend
          iconType="circle"
          iconSize={6}
          wrapperStyle={{ fontSize: 10 }}
          formatter={(value) => <span style={{ color: 'var(--text-muted)' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
