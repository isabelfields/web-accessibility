'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  violations: { rule: string; count: number; impact: string }[]
}

const IMPACT_COLOR: Record<string, string> = {
  critical: '#ef4444',  // tier1
  serious:  '#f97316',  // tier2
  moderate: '#f59e0b',  // tier3
  minor:    '#60a5fa',  // tier4
}

export function TopViolationsChart({ violations }: Props) {
  if (violations.length === 0) {
    return <div className="flex items-center justify-center h-40 text-sm text-gray-300">No violations found</div>
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
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="rule"
          width={120}
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          formatter={(val: number) => [val, 'occurrences']}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={16}>
          {data.map((entry, i) => (
            <Cell key={i} fill={IMPACT_COLOR[entry.impact] ?? '#93c5fd'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
