'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

interface SiteTrend {
  name: string
  scores: { date: string; score: number }[]
}

interface Props {
  trends: SiteTrend[]
}

const LINE_COLORS = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#bfdbfe']

const tooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text)',
  fontSize: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
}

export function ScoreTrendChart({ trends }: Props) {
  if (trends.length === 0 || trends.every(t => t.scores.length < 2)) {
    return <div className="flex items-center justify-center h-40 text-sm text-[var(--text-muted)]">Run more scans to see trends</div>
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
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        />
        {trends.length > 1 && (
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: 10 }}
            formatter={(value) => <span style={{ color: 'var(--text-muted)' }}>{value}</span>}
          />
        )}
        {trends.map((site, i) => (
          <Line
            key={site.name}
            type="monotone"
            dataKey={site.name}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
