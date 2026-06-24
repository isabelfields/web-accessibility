'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = {
  critical: '#1e3a8a',
  serious:  '#2563eb',
  moderate: '#60a5fa',
  minor:    '#bfdbfe',
}

interface Props {
  counts: { critical: number; serious: number; moderate: number; minor: number }
}

export function SeverityDonut({ counts }: Props) {
  const data = [
    { name: 'Tier 1', value: counts.critical, color: COLORS.critical },
    { name: 'Tier 2', value: counts.serious,  color: COLORS.serious },
    { name: 'Tier 3', value: counts.moderate, color: COLORS.moderate },
    { name: 'Tier 4', value: counts.minor,    color: COLORS.minor },
  ].filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 13, color: '#57575A' }}>No data yet</div>

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
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
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #E5E5EA',
              background: '#fff',
              color: '#1C1C1E',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#374151', flex: 1 }}>{d.name}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{d.value.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#57575A', width: 36, textAlign: 'right' }}>{Math.round(d.value / total * 100)}%</div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #E5E5EA', marginTop: 2, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, color: '#57575A' }}>Total</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E' }}>{total.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}
