'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  violations: { rule: string; count: number; impact: string }[]
}

const IMPACT_COLOR: Record<string, string> = {
  critical: '#002D82',
  serious:  '#005AC8',
  moderate: '#007AFF',
  minor:    '#5AC8FA',
}

export function TopViolationsChart({ violations }: Props) {
  if (violations.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', fontSize: '14px', color: '#86868B' }}>No WCAG errors found</div>
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
          tick={{ fontSize: 10, fill: '#86868B' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="rule"
          width={120}
          tick={{ fontSize: 10, fill: '#3A3A3C' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #E0E0E0',
            background: '#FFFFFF',
            color: '#1D1D1F',
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          }}
          cursor={{ fill: 'rgba(0,122,255,0.04)' }}
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
