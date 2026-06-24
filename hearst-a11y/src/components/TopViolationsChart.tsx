'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  violations: { rule: string; count: number; impact: string }[]
}

const IMPACT_COLOR: Record<string, string> = {
  critical: '#1d4ed8',
  serious:  '#3b82f6',
  moderate: '#60a5fa',
  minor:    '#93c5fd',
}

export function TopViolationsChart({ violations }: Props) {
  if (violations.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 13, color: '#57575A' }}>No WCAG errors found</div>
  }

  const data = violations.slice(0, 8).map(v => ({
    rule: v.rule.replace(/-/g, ' '),
    count: v.count,
    impact: v.impact,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#57575A' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="rule"
          width={140}
          tick={{ fontSize: 11, fill: '#374151' }}
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
          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          formatter={(val) => [val, 'occurrences']}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={12}>
          {data.map((entry, i) => (
            <Cell key={i} fill={IMPACT_COLOR[entry.impact] ?? '#94a3b8'} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
