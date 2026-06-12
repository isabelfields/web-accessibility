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

const LINE_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2']

export function ScoreTrendChart({ trends }: Props) {
  if (trends.length === 0 || trends.every(t => t.scores.length < 2)) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 13, color: '#86868B' }}>Run more scans to see trends</div>
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

  const allScores = trends.flatMap(t => t.scores.map(s => s.score))
  const minScore = Math.max(0, Math.floor(Math.min(...allScores) / 10) * 10 - 10)
  const maxScore = Math.min(100, Math.ceil(Math.max(...allScores) / 10) * 10 + 5)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          domain={[minScore, maxScore]}
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}`}
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
          labelStyle={{ color: '#6B7280', marginBottom: 4 }}
          labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: '#6B7280', paddingTop: 8 }}
          formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>}
        />
        {trends.map((site, i) => (
          <Line
            key={site.name}
            type="monotone"
            dataKey={site.name}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: LINE_COLORS[i % LINE_COLORS.length] }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
