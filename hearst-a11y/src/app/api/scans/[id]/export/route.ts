import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { auth } from '@/auth'
import type { ViolationPattern, PageScore } from '@/types'

const ADMIN_SECRET = process.env.ADMIN_SECRET

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#111827', backgroundColor: '#ffffff' },
  header: { marginBottom: 24 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#6b7280', marginBottom: 2 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 16 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 12, backgroundColor: '#f9fafb', borderRadius: 6 },
  statLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111827' },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 8, marginTop: 16 },
  table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: 8 },
  tableHeaderCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tableCell: { fontSize: 9, color: '#374151' },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  violationCard: { marginBottom: 8, padding: 10, backgroundColor: '#f9fafb', borderRadius: 4, borderLeftWidth: 3 },
  violationTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 },
  violationMeta: { fontSize: 8, color: '#6b7280', marginBottom: 4 },
  violationDesc: { fontSize: 9, color: '#4b5563' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#9ca3af' },
})

function impactColor(impact: string) {
  switch (impact) {
    case 'critical': return '#ef4444'
    case 'serious': return '#f87171'
    case 'moderate': return '#f59e0b'
    default: return '#93c5fd'
  }
}

function impactBg(impact: string) {
  switch (impact) {
    case 'critical': return '#fef2f2'
    case 'serious': return '#fef2f2'
    case 'moderate': return '#fffbeb'
    default: return '#eff6ff'
  }
}

function scoreColor(score: number) {
  if (score >= 90) return '#16a34a'
  if (score >= 80) return '#65a30d'
  if (score >= 70) return '#ca8a04'
  if (score >= 60) return '#ea580c'
  return '#dc2626'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Admin check: accept valid session OR legacy ADMIN_SECRET header
  const session = await auth()
  const secret = req.headers.get('x-admin-secret') ?? req.nextUrl.searchParams.get('secret')
  const hasValidSecret = ADMIN_SECRET && secret === ADMIN_SECRET
  const hasAdminSession = session?.user?.role === 'admin'
  if (!hasAdminSession && !hasValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const [scan] = await sql`SELECT * FROM scan_jobs WHERE id = ${id}`
  if (!scan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let siteName = scan.root_url
  if (scan.site_id) {
    const [site] = await sql`SELECT name FROM sites WHERE id = ${scan.site_id}`
    if (site) siteName = site.name
  }

  const patterns: ViolationPattern[] = scan.patterns ?? []
  const pageScores: PageScore[] = scan.page_scores ?? []
  const totalViolations = patterns.reduce((s, p) => s + p.occurrences, 0)

  const byImpact: Record<string, ViolationPattern[]> = { critical: [], serious: [], moderate: [], minor: [] }
  for (const p of patterns) {
    if (byImpact[p.impact]) byImpact[p.impact].push(p)
  }

  const formattedDate = new Date(scan.started_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const doc = (
    <Document title={`${siteName} — Accessibility Report`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{siteName}</Text>
          <Text style={styles.subtitle}>{scan.root_url}</Text>
          <Text style={styles.subtitle}>Scanned {formattedDate}</Text>
        </View>

        <View style={styles.divider} />

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Score</Text>
            <Text style={[styles.statValue, { color: scoreColor(scan.score ?? 0) }]}>
              {Math.round(scan.score ?? 0)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Violations</Text>
            <Text style={styles.statValue}>{totalViolations}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Issue Types</Text>
            <Text style={styles.statValue}>{patterns.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pages Scanned</Text>
            <Text style={styles.statValue}>{scan.pages_scanned ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Critical</Text>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>
              {byImpact.critical.reduce((s, p) => s + p.occurrences, 0)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Serious</Text>
            <Text style={[styles.statValue, { color: '#f87171' }]}>
              {byImpact.serious.reduce((s, p) => s + p.occurrences, 0)}
            </Text>
          </View>
        </View>

        {/* Page Scores */}
        {pageScores.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Page Scores</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Page</Text>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>URL</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Score</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Violations</Text>
              </View>
              {pageScores.map((ps, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{ps.label ?? '—'}</Text>
                  <Text style={[styles.tableCell, { flex: 3, color: '#3B7EC8' }]} numberOfLines={1}>{ps.url}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: ps.score != null ? scoreColor(ps.score) : '#9ca3af' }]}>
                    {ps.score != null ? ps.score : 'Failed'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{ps.violationCount ?? '—'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Violations */}
        {patterns.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Issues Found</Text>
            {(['critical', 'serious', 'moderate', 'minor'] as const).map(impact => {
              const group = byImpact[impact]
              if (group.length === 0) return null
              return (
                <View key={impact}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: impactColor(impact), textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 8 }}>
                    {impact} — {group.length} issue type{group.length !== 1 ? 's' : ''}
                  </Text>
                  {group.map((p, i) => (
                    <View key={i} style={[styles.violationCard, { borderLeftColor: impactColor(p.impact) }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <View style={[styles.pill, { backgroundColor: impactBg(p.impact), color: impactColor(p.impact) }]}>
                          <Text style={{ color: impactColor(p.impact), fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{p.impact.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.violationTitle}>{p.rule}</Text>
                        <Text style={{ fontSize: 8, color: '#9ca3af', marginLeft: 'auto' }}>{p.occurrences} occurrence{p.occurrences !== 1 ? 's' : ''} · {p.affectedPages?.length ?? 1} page{(p.affectedPages?.length ?? 1) !== 1 ? 's' : ''}</Text>
                      </View>
                      <Text style={styles.violationDesc}>{p.description}</Text>
                      {p.fixSuggestion && (
                        <Text style={{ fontSize: 8, color: '#1d4ed8', marginTop: 4 }}>Fix: {p.fixSuggestion}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )
            })}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Hearst Accessibility Monitor</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(doc)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="accessibility-report-${id.slice(0, 8)}.pdf"`,
    },
  })
}
