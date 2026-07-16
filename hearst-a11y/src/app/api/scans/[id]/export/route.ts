import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'
import { safeEqual } from '@/lib/security'
import type { ViolationPattern, PageScore } from '@/types'
import { countIssueTypes, countOccurrences, isWcagPattern } from '@/lib/metrics'
// @ts-ignore — pdfkit has @types/pdfkit but the default export path differs
import PDFDocument from 'pdfkit'

const ADMIN_SECRET = process.env.ADMIN_SECRET

const TIER_COLOR: Record<string, string> = {
  tier1: '#ef4444',
  tier2: '#f97316',
  tier3: '#f59e0b',
  tier4: '#60a5fa',
}

function impactToTierKey(impact: string): string {
  if (impact === 'critical') return 'tier1'
  if (impact === 'serious')  return 'tier2'
  if (impact === 'moderate') return 'tier3'
  return 'tier4'
}
function impactTierLabel(impact: string): string {
  if (impact === 'critical') return 'Tier 1'
  if (impact === 'serious')  return 'Tier 2'
  if (impact === 'moderate') return 'Tier 3'
  return 'Tier 4'
}

function hexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

async function buildPdf(params: {
  siteName: string
  rootUrl: string
  formattedDate: string
  pagesScanned: number
  totalViolations: number
  issueTypes: number
  byTier: Record<string, ViolationPattern[]>
  pageScores: PageScore[]
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const { siteName, rootUrl, formattedDate, pagesScanned, totalViolations, issueTypes, byTier, pageScores } = params
    const W = doc.page.width - 80 // usable width (margin 40 each side)

    // ── Header ────────────────────────────────────────────────────────────────
    doc.fontSize(20).fillColor('#111827').font('Helvetica-Bold').text(siteName, 40, 40)
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica').text(rootUrl, 40, doc.y + 2)
    doc.text(`Scanned ${formattedDate}`, 40, doc.y + 2)

    // Divider
    doc.moveDown(0.6)
    doc.moveTo(40, doc.y).lineTo(40 + W, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke()
    doc.moveDown(0.6)

    // ── Stats row ─────────────────────────────────────────────────────────────
    const stats = [
      { label: 'COMPONENT ISSUES', value: String(totalViolations), color: '#111827' },
      { label: 'ISSUE TYPES',       value: String(issueTypes),      color: '#111827' },
      { label: 'PAGES SCANNED',     value: String(pagesScanned),    color: '#111827' },
      { label: 'TIER 1',            value: String(countOccurrences(byTier.tier1)), color: TIER_COLOR.tier1 },
      { label: 'TIER 2',            value: String(countOccurrences(byTier.tier2)), color: TIER_COLOR.tier2 },
    ]
    const cardW = (W - 8 * (stats.length - 1)) / stats.length
    let sx = 40
    const sy = doc.y
    for (const s of stats) {
      doc.roundedRect(sx, sy, cardW, 44, 4).fillColor('#f9fafb').fill()
      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text(s.label, sx + 8, sy + 8, { width: cardW - 16 })
      doc.fontSize(16).fillColor(s.color).font('Helvetica-Bold').text(s.value, sx + 8, sy + 20, { width: cardW - 16 })
      sx += cardW + 8
    }
    doc.y = sy + 44 + 16

    // ── Page Issues table ──────────────────────────────────────────────────────
    if (pageScores.length > 0) {
      doc.fontSize(10).fillColor('#374151').font('Helvetica-Bold').text('Page Issues', 40, doc.y)
      doc.moveDown(0.4)

      const cols = { page: 0.2, url: 0.5, viol: 0.15, status: 0.15 }
      const colW = { page: W * cols.page, url: W * cols.url, viol: W * cols.viol, status: W * cols.status }

      // Header row
      const thY = doc.y
      doc.rect(40, thY, W, 18).fillColor('#f3f4f6').fill()
      doc.fontSize(7).fillColor('#6b7280').font('Helvetica-Bold')
      doc.text('PAGE',      40,                thY + 5, { width: colW.page })
      doc.text('URL',       40 + colW.page,    thY + 5, { width: colW.url })
      doc.text('VIOLATIONS',40 + colW.page + colW.url, thY + 5, { width: colW.viol, align: 'right' })
      doc.text('STATUS',    40 + colW.page + colW.url + colW.viol, thY + 5, { width: colW.status, align: 'right' })
      doc.y = thY + 20

      for (const ps of pageScores.slice(0, 50)) {
        const rowY = doc.y
        doc.fontSize(8).fillColor('#374151').font('Helvetica')
        doc.text(ps.label ?? '—', 40, rowY, { width: colW.page - 4, ellipsis: true })
        const urlText = ps.url.length > 70 ? ps.url.slice(0, 70) + '…' : ps.url
        doc.fillColor('#3B7EC8').text(urlText, 40 + colW.page, rowY, { width: colW.url - 4, ellipsis: true })
        doc.fillColor('#374151').text(String(ps.violationCount ?? '—'), 40 + colW.page + colW.url, rowY, { width: colW.viol, align: 'right' })
        const failed = ps.score == null
        doc.fillColor(failed ? '#ef4444' : '#9ca3af').text(failed ? 'Failed' : 'Scanned', 40 + colW.page + colW.url + colW.viol, rowY, { width: colW.status, align: 'right' })
        doc.y = rowY + 14
        doc.moveTo(40, doc.y).lineTo(40 + W, doc.y).strokeColor('#f3f4f6').lineWidth(0.5).stroke()
        doc.y += 1
      }
      doc.moveDown(0.8)
    }

    // ── Violations by tier ────────────────────────────────────────────────────
    const tierKeys = ['tier1', 'tier2', 'tier3', 'tier4'] as const
    const hasAny = tierKeys.some(t => byTier[t].length > 0)
    if (hasAny) {
      doc.fontSize(10).fillColor('#374151').font('Helvetica-Bold').text('Issues Found', 40, doc.y)
      doc.moveDown(0.4)

      for (const tier of tierKeys) {
        const group = byTier[tier]
        if (group.length === 0) continue
        const color = TIER_COLOR[tier]
        const [cr, cg, cb] = hexToRGB(color)
        const label = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3', tier4: 'Tier 4' }[tier]

        doc.moveDown(0.3)
        doc.fontSize(8).fillColor(color).font('Helvetica-Bold')
          .text(`${label.toUpperCase()} — ${group.length} issue type${group.length !== 1 ? 's' : ''}`, 40, doc.y)
        doc.moveDown(0.3)

        for (const p of group) {
          if (doc.y > doc.page.height - 120) doc.addPage()
          const cardY = doc.y
          // left accent bar
          doc.rect(40, cardY, 3, 1).fillColor(color).fill() // placeholder; we'll draw it after height is known

          // Pill
          doc.roundedRect(46, cardY + 2, 34, 12, 3).fillColor(`rgba(${cr},${cg},${cb},0.12)`).fill()
          doc.fontSize(7).fillColor(color).font('Helvetica-Bold').text(impactTierLabel(p.impact), 48, cardY + 5, { width: 30 })

          // Rule name
          doc.fontSize(9).fillColor('#111827').font('Helvetica-Bold').text(p.rule, 85, cardY + 3, { width: W - 140, continued: false })

          // Occurrences / pages
          const meta = `${p.occurrences} occurrence${p.occurrences !== 1 ? 's' : ''} · ${p.affectedPages?.length ?? 1} page${(p.affectedPages?.length ?? 1) !== 1 ? 's' : ''}`
          doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text(meta, 40 + W - 100, cardY + 4, { width: 100, align: 'right' })

          // Description
          doc.fontSize(8).fillColor('#4b5563').font('Helvetica').text(p.description, 46, doc.y + 2, { width: W - 46 })

          // Fix suggestion
          if (p.fixSuggestion) {
            doc.fontSize(7).fillColor('#1d4ed8').font('Helvetica').text(`Fix: ${p.fixSuggestion}`, 46, doc.y + 2, { width: W - 46 })
          }

          const cardH = doc.y - cardY + 6
          // draw left accent bar with correct height
          doc.rect(40, cardY, 3, cardH).fillColor(color).fill()
          doc.rect(43, cardY, W - 3, cardH).fillColor('#f9fafb').fill()
          // re-draw text on top (pdfkit stacking)
          doc.roundedRect(46, cardY + 2, 34, 12, 3).fillColor(`rgba(${cr},${cg},${cb},0.12)`).fill()
          doc.fontSize(7).fillColor(color).font('Helvetica-Bold').text(impactTierLabel(p.impact), 48, cardY + 5, { width: 30 })
          doc.fontSize(9).fillColor('#111827').font('Helvetica-Bold').text(p.rule, 85, cardY + 3, { width: W - 140 })
          doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text(meta, 40 + W - 100, cardY + 4, { width: 100, align: 'right' })
          doc.y = cardY + 18
          doc.fontSize(8).fillColor('#4b5563').font('Helvetica').text(p.description, 46, doc.y + 2, { width: W - 46 })
          if (p.fixSuggestion) {
            doc.fontSize(7).fillColor('#1d4ed8').font('Helvetica').text(`Fix: ${p.fixSuggestion}`, 46, doc.y + 2, { width: W - 46 })
          }
          doc.moveDown(0.5)
        }
      }
    }

    // ── Footer on every page ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i)
      const fY = doc.page.height - 30
      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
        .text('Hearst Accessibility Monitor', 40, fY)
        .text(`Page ${i + 1} of ${range.count}`, 40, fY, { width: W, align: 'right' })
    }

    doc.end()
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const hasAdminSession = !!(await requireAdmin())
    const hasValidSecret = !!ADMIN_SECRET && safeEqual(req.headers.get('x-admin-secret'), ADMIN_SECRET)
    if (!hasAdminSession && !hasValidSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const [scan] = await sql`SELECT * FROM scan_jobs WHERE id = ${id}`
    if (!scan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let siteName: string = scan.root_url
    if (scan.site_id) {
      const [site] = await sql`SELECT name FROM sites WHERE id = ${scan.site_id}`
      if (site) siteName = site.name
    }

    const patterns: ViolationPattern[] = scan.patterns ?? []
    const wcagPatterns = patterns.filter(isWcagPattern)
    const pageScores: PageScore[] = scan.page_scores ?? []

    const byTier: Record<string, ViolationPattern[]> = { tier1: [], tier2: [], tier3: [], tier4: [] }
    for (const p of wcagPatterns) {
      byTier[impactToTierKey(p.impact)].push(p)
    }

    const formattedDate = new Date(scan.started_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    const buffer = await buildPdf({
      siteName,
      rootUrl: scan.root_url,
      formattedDate,
      pagesScanned: scan.pages_scanned ?? 0,
      totalViolations: countOccurrences(wcagPatterns),
      issueTypes: countIssueTypes(wcagPatterns),
      byTier,
      pageScores,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="accessibility-report-${id.slice(0, 8)}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('[export/pdf] error:', err)
    return NextResponse.json({ error: err?.message ?? 'export error' }, { status: 500 })
  }
}
