'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = {
  critical: '#002D82',
  serious:  '#005AC8',
  moderate: '#007AFF',
  minor:    '#5AC8FA',
}

interface Props {
  counts: { critical: number; serious: number; moderate: number; minor: number }
}

export function SeverityDonut({ counts }: Props) {
  const data = [
    { name: 'T1 Critical', value: counts.critical, color: COLORS.critical },
    { name: 'T2 Serious',  value: counts.serious,  color: COLORS.serious },
    { name: 'T3 Moderate', value: counts.moderate, color: COLORS.moderate },
    { name: 'T4 Minor',    value: counts.minor,    color: COLORS.minor },
  ].filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return (
    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#86868B' }}>
      No data yet
    </div>
  )

  return (
    <div style={{ width: '100%', height: '220px', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={data}
            cx="50%"
            cy="48%"
            innerRadius={52}
            outerRadius={76}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.9} />
            ))}
          </Pie>
          <Tooltip
            formatter={(val) => { const n = Number(val); return [`${n} (${Math.round(n/total*100)}%)`] }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #E0E0E0',
              background: '#FFFFFF',
              color: '#1D1D1F',
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            }}
          />
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: 10 }}
            formatter={(value) => <span style={{ color: '#3A3A3C' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label — positioned over the donut hole */}
      <div style={{
        position: 'absolute',
        top: '48%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        lineHeight: 1,
      }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
          {total.toLocaleString()}
        </div>
        <div style={{ fontSize: '9px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '3px' }}>
          TOTAL
        </div>
      </div>
    </div>
  )
}
