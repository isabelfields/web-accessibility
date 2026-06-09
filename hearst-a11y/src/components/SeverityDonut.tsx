'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const TIER_COLORS = {
  critical: '#C8002A',
  serious:  '#D4600A',
  moderate: '#B08400',
  minor:    '#3A7D44',
}

const TIER_LABELS = {
  critical: 'T1 Critical',
  serious:  'T2 Serious',
  moderate: 'T3 Moderate',
  minor:    'T4 Minor',
}

interface Props {
  counts: { critical: number; serious: number; moderate: number; minor: number }
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

export function SeverityDonut({ counts }: Props) {
  const data = (Object.entries(counts) as [keyof typeof counts, number][])
    .map(([key, value]) => ({
      name: TIER_LABELS[key],
      value,
      color: TIER_COLORS[key],
      key,
    }))
    .filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
        No data yet
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={96}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(val: any, name: any) => {
                const n = Number(val)
                return [`${n} (${Math.round(n / total * 100)}%)`, name]
              }}
              contentStyle={tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="mono font-bold leading-none" style={{ fontSize: '36px', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>{total}</span>
          <span className="font-semibold uppercase tracking-wider mt-1" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>total</span>
        </div>
      </div>

      {/* Legend pills */}
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {data.map(d => (
          <span
            key={d.key}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full"
            style={{
              background: `${d.color}18`,
              color: d.color,
              border: `1px solid ${d.color}40`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.color }} aria-hidden="true" />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  )
}
