'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface CostData {
  totals: { total_cost: number; total_calls: number; total_scans: number }
  monthly: { month: string; cost: number; calls: number; scans: number }[]
  bySite: { site_name: string | null; division: string | null; cost: number; calls: number; scans: number }[]
  byDivision: { division: string; cost: number; calls: number; scans: number }[]
}

function fmt$(n: number) {
  return n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

const statStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E5E5EA',
  borderRadius: 12,
  padding: '20px 24px',
  flex: 1,
  minWidth: 160,
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E5E5EA',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
}

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'site' | 'division'>('division')

  useEffect(() => {
    fetch('/api/admin/costs')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: '#86868B', fontSize: 14 }}>
      Loading…
    </div>
  )
  if (!data) return null

  const { totals, monthly, bySite, byDivision } = data

  return (
    <div style={{ padding: '24px 32px', background: '#F5F5F7', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1D1D1F', margin: 0, letterSpacing: '-0.01em' }}>Usage & Cost</h1>
        <p style={{ fontSize: 13, color: '#86868B', marginTop: 4, marginBottom: 0 }}>Claude API usage across all scans</p>
      </div>

      {/* Top stat cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={statStyle}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Total spend</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>{fmt$(Number(totals.total_cost))}</div>
          <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>all time</div>
        </div>
        <div style={statStyle}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Claude calls</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>{Number(totals.total_calls).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>all time</div>
        </div>
        <div style={statStyle}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Scans completed</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>{Number(totals.total_scans).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>all time</div>
        </div>
        <div style={statStyle}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Avg cost / scan</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
            {totals.total_scans > 0 ? fmt$(Number(totals.total_cost) / Number(totals.total_scans)) : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>per completed scan</div>
        </div>
      </div>

      {/* Monthly chart */}
      {monthly.length > 0 && (
        <div style={{ ...cardStyle, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 16 }}>Monthly spend</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly.map(m => ({ ...m, month: fmtMonth(m.month), cost: Number(m.cost) }))} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#86868B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#86868B' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E5EA', background: '#fff', color: '#1D1D1F', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                formatter={(v: any) => [`$${Number(v).toFixed(4)}`, 'Cost']}
              />
              <Bar dataKey="cost" fill="#007AFF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By site / by division table */}
      <div style={cardStyle}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F0F0', padding: '0 20px' }}>
          {(['division', 'site'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '12px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: tab === t ? '#007AFF' : '#86868B',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${tab === t ? '#007AFF' : 'transparent'}`,
                cursor: 'pointer',
                marginBottom: -1,
                textTransform: 'capitalize',
              }}
            >
              By {t}
            </button>
          ))}
        </div>

        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F5F5F7' }}>
              <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {tab === 'site' ? 'Site' : 'Division'}
              </th>
              {tab === 'site' && (
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Division</th>
              )}
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Spend</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Calls</th>
              <th style={{ textAlign: 'right', padding: '10px 20px', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scans</th>
            </tr>
          </thead>
          <tbody>
            {(tab === 'division' ? byDivision : bySite).map((row: any, i: number, arr: any[]) => (
              <tr key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid #F5F5F7' : 'none' }}>
                <td style={{ padding: '11px 20px', fontWeight: 500, color: '#1D1D1F' }}>
                  {tab === 'site' ? (row.site_name ?? <span style={{ color: '#86868B' }}>Unknown</span>) : row.division}
                </td>
                {tab === 'site' && (
                  <td style={{ padding: '11px 16px', color: '#86868B', fontSize: 12 }}>{row.division ?? '—'}</td>
                )}
                <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: '#1D1D1F' }}>{fmt$(Number(row.cost))}</td>
                <td style={{ padding: '11px 16px', textAlign: 'right', color: '#86868B' }}>{Number(row.calls).toLocaleString()}</td>
                <td style={{ padding: '11px 20px', textAlign: 'right', color: '#86868B' }}>{Number(row.scans).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
