'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AddSiteForm } from '@/components/AddSiteForm'
import { EditSiteForm } from '@/components/EditSiteForm'
import type { SitePage } from '@/types'

interface Site {
  id: string
  name: string
  pages: SitePage[]
  created_at: string
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

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)

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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your monitored web properties</p>
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

      {loading ? (
        <div className="flex justify-center py-20 text-gray-400">Loading...</div>
      ) : sites.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Site</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Pages</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Latest Score</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Last Scan</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sites.map(site => (
                <tr key={site.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/sites/${site.id}`} className="font-medium text-brand-500 hover:text-blue-700">
                      {site.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {site.pages?.length ?? 0} page{(site.pages?.length ?? 0) !== 1 ? 's' : ''}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${site.latestScan ? scoreColor(site.latestScan.score) : 'text-gray-400'}`}>
                    {site.latestScan ? Math.round(site.latestScan.score) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {site.latestScan ? formatDate(site.latestScan.started_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {formatDate(site.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditingSite(site)}
                        className="text-blue-500 hover:text-blue-700 text-xs font-medium"
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
