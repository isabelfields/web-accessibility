'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AddSiteForm } from '@/components/AddSiteForm'
import { EditSiteForm } from '@/components/EditSiteForm'
import type { SitePage } from '@/types'
import { HEARST_DIVISIONS } from '@/types'

interface Site {
  id: string
  name: string
  division?: string | null
  brand?: string | null
  region?: string | null
  pages: SitePage[]
  created_at: string
  latestScan: {
    status: string
    started_at: string
    unique_pattern_count: number
    raw_violation_count: number
  } | null
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [divisionFilter, setDivisionFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/sites')
    const data = await res.json()
    setSites(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteSite(id: string, name: string) {
    if (!confirm(`Delete site "${name}"? This cannot be undone.`)) return
    await fetch(`/api/sites/${id}`, { method: 'DELETE' })
    load()
  }

  const activeDivisions = [...new Set(sites.map(s => s.division).filter(Boolean))] as string[]
  const activeRegions = [...new Set(sites.map(s => s.region).filter(Boolean))] as string[]
  const filtered = sites
    .filter(s => !divisionFilter || s.division === divisionFilter)
    .filter(s => !regionFilter || s.region === regionFilter)

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Sites</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">Manage your monitored web properties</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Site
        </button>
      </div>

      {showForm && (
        <AddSiteForm onClose={() => { setShowForm(false); load() }} />
      )}
      {editingSite && (
        <EditSiteForm site={editingSite} onClose={() => { setEditingSite(null); load() }} />
      )}

      {(activeDivisions.length > 0 || activeRegions.length > 0) && (
        <div className="flex items-center gap-4 mb-5">
          {activeDivisions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Division</span>
              <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}
                className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All</option>
                {activeDivisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {activeRegions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Region</span>
              <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All</option>
                {activeRegions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-[var(--text-muted)]">Loading...</div>
      ) : sites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-16 text-center">
          <div className="text-[var(--text-muted)] text-lg mb-3">No sites configured yet</div>
          <p className="text-[var(--text-muted)] text-sm mb-6">Add your first site to start monitoring accessibility.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-blue-600"
          >
            + Add Site
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Site</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Division</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Brand</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Pages</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">WCAG Errors</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Last Scan</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(site => (
                <tr key={site.id} className="hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/sites/${site.id}`} className="font-medium text-[#5b9bd6] hover:text-blue-400">
                      {site.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {site.division
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)]">{site.division}</span>
                      : <span className="text-[var(--text-muted)]">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {site.brand
                      ? <span className="text-[var(--text)] text-sm">{site.brand}</span>
                      : <span className="text-[var(--text-muted)]">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {site.pages?.length ?? 0} page{(site.pages?.length ?? 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text)] tabular-nums">
                    {site.latestScan ? site.latestScan.raw_violation_count : <span className="text-[var(--text-muted)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                    {site.latestScan ? formatDate(site.latestScan.started_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                    {formatDate(site.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditingSite(site)}
                        className="text-[#5b9bd6] hover:text-blue-400 text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSite(site.id, site.name)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
