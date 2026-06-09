'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

interface SiteTrend {
  name: string
  scores: { date: string; score: number }[]
}

const LINE_COLORS = ['#0057B8', '#1A6FD4', '#3B82F6', '#6366F1', '#8B5CF6', '#0891B2']

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #DDE3EC',
  borderRadius: '8px',
  color: '#0D1B2A',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(10,22,40,0.10)',
  fontFamily: 'Inter, sans-serif',
}

export function ScoreTrendChart({ trends }: { trends: SiteTrend[] }) {
  if (trends.length === 0 || trends.every(t => t.scores.length < 2)) {
    return (
      <div className="flex items-center justify-center h-40 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
        Run more scans to see trends
      </div>
    )
  }

  const allDates = [...new Set(
    trends.flatMap(t => t.scores.map(s => s.date))
  )].sort()

  const data = allDates.map(date => {
    const row: Record<string, any> = { date }
    for (const site of trends) {
      const entry = site.scores.find(s => s.date === date)
      if (entry) row[site.name] = entry.score
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 16 }}>
        <CartesianGrid
          strokeDasharray="0"
          stroke="rgba(10,22,40,0.08)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#718096', fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#718096', fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          formatter={(val: any, name: string) => [val, name]}
        />
        {trends.length > 1 && (
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span style={{ color: '#4A5568' }}>{value}</span>}
          />
        )}
        {trends.map((site, i) => (
          <Line
            key={site.name}
            type="monotone"
            dataKey={site.name}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
