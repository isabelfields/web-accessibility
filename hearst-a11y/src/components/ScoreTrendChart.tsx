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

const LINE_COLORS = ['#3B7EC8', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

export function ScoreTrendChart({ trends }: Props) {
  if (trends.length === 0 || trends.every(t => t.scores.length < 2)) {
    return <div className="flex items-center justify-center h-40 text-sm text-gray-300">Run more scans to see trends</div>
  }

  // Build unified date axis from all score entries
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
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        />
        {trends.length > 1 && (
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => <span style={{ color: '#6b7280' }}>{value}</span>}
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
            activeDot={{ r: 3, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
