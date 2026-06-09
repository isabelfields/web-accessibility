'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

interface Props {
  violations: { rule: string; count: number; impact: string }[]
}

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #DDE3EC',
  borderRadius: '8px',
  color: '#0D1B2A',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(10,22,40,0.10)',
  fontFamily: 'Inter, sans-serif',
}

export function TopViolationsChart({ violations }: Props) {
  if (violations.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
        No WCAG errors found
      </div>
    )
  }

  const top = violations.slice(0, 8)
  const maxCount = Math.max(...top.map(v => v.count))

  const data = top.map((v, i) => ({
    rule: v.rule.replace(/-/g, ' '),
    count: v.count,
    impact: v.impact,
    opacity: Math.max(0.4, 1 - (i / top.length) * 0.6),
  }))

  return (
    <ResponsiveContainer width="100%" height={data.length * 42 + 24}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#718096', fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          domain={[0, maxCount * 1.15]}
        />
        <YAxis
          type="category"
          dataKey="rule"
          width={180}
          tick={{ fontSize: 12, fill: '#4A5568', fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'rgba(0,87,184,0.04)' }}
          formatter={(val: any) => [val, 'occurrences']}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={14}>
          {data.map((entry, i) => (
            <Cell key={i} fill="#0057B8" fillOpacity={entry.opacity} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fill: '#4A5568', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
