'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface TrendPoint {
  date: string
  errors: number
  score: number | null
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

export function SiteTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
        Run more scans to see trends
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="0" stroke="rgba(10,22,40,0.08)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#718096', fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: '#718096', fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          formatter={(val: any, name: any) => [val, name === 'errors' ? 'WCAG Errors' : 'Score']}
        />
        <Line
          type="monotone"
          dataKey="errors"
          stroke="#C8002A"
          strokeWidth={2}
          dot={{ r: 3, fill: '#C8002A', strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
          connectNulls
          name="errors"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
