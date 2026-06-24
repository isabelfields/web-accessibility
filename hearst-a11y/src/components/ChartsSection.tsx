'use client'

import dynamic from 'next/dynamic'

const SeverityDonut = dynamic(() => import('./SeverityDonut').then(m => m.SeverityDonut), { ssr: false })
const ScoreTrendChart = dynamic(() => import('./ScoreTrendChart').then(m => m.ScoreTrendChart), { ssr: false })
const TopViolationsChart = dynamic(() => import('./TopViolationsChart').then(m => m.TopViolationsChart), { ssr: false })

interface SiteTrend {
  name: string
  scores: { date: string; score: number }[]
}

interface Props {
  severityCounts: { critical: number; serious: number; moderate: number; minor: number }
  topViolations: { rule: string; count: number; impact: string }[]
  scoreTrends: SiteTrend[]
}

export function ChartsSection({ severityCounts, topViolations, scoreTrends }: Props) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Issue Count Over Time</div>
          <div style={{ fontSize: 11, color: '#57575A', marginBottom: 12 }}>Total failing elements per site across scans</div>
          <ScoreTrendChart trends={scoreTrends} />
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Issues by Tier</div>
          <div style={{ fontSize: 11, color: '#57575A', marginBottom: 12 }}>Total failing elements grouped by tier</div>
          <SeverityDonut counts={severityCounts} />
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Top WCAG Errors Across All Sites</div>
        <TopViolationsChart violations={topViolations} />
      </div>
    </>
  )
}
