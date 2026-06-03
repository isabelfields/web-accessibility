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
  previousScore: number | null
  latestScan: {
    score: number
    status: string
    started_at: string
    unique_pattern_count: number
    raw_violation_count: number
  } | null
}

function scoreColor(score: number) {
  if (score >= 90) return 'text-green-600'
  if (score >= 80) return 'text-lime-600'
  if (score >= 70) return 'text-yellow-600'
  if (score >= 60) return 'text-orange-500'
  return 'text-red-500'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ScoreDelta({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null) return null
  const delta = Math.round(current) - Math.round(previous)
  if (delta === 0) return null
  const up = delta > 0
  return (
    <span
      className="text-[11px] font-semibold tabular-nums"
      style={{ color: up ? '#00c853' : '#ff1744' }}
    >
      {up ? '+' : ''}{delta}
    </span>
  )
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
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Sites</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage your monitored web properties</p>
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
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Division</span>
              <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All</option>
                {activeDivisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {activeRegions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Region</span>
              <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All</option>
                {activeRegions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-gray-400">Loading...</div>
      ) : sites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <div className="text-gray-400 text-lg mb-3">No sites configured yet</div>
          <p className="text-gray-400 text-sm mb-6">Add your first site to start monitoring accessibility.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-blue-600"
          >
            + Add Site
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Site</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Division</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Brand</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pages</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Score</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Last Scan</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(site => (
                <tr key={site.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/sites/${site.id}`} className="font-medium text-brand-500 hover:text-blue-700">
                      {site.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {site.division
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{site.division}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {site.brand
                      ? <span className="text-gray-600 text-sm">{site.brand}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {site.pages?.length ?? 0} page{(site.pages?.length ?? 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {site.latestScan ? (
                      <span className="inline-flex items-center justify-end gap-0.5">
                        <span className={`font-semibold tabular-nums ${scoreColor(site.latestScan.score)}`}>
                          {Math.round(site.latestScan.score)}
                        </span>
                        <ScoreDelta current={site.latestScan.score} previous={site.previousScore} />
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {site.latestScan ? formatDate(site.latestScan.started_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {formatDate(site.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditingSite(site)}
                        className="text-brand-500 hover:text-blue-700 text-xs font-medium"
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
