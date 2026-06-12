'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AddSiteForm } from '@/components/AddSiteForm'
import { EditSiteForm } from '@/components/EditSiteForm'
import type { SitePage } from '@/types'

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

const selectStyle: React.CSSProperties = {
  fontSize: 13,
  border: '1px solid #E5E5EA',
  borderRadius: 8,
  padding: '6px 12px',
  background: '#fff',
  color: '#1D1D1F',
  outline: 'none',
  cursor: 'pointer',
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
    <div style={{ minHeight: '100vh', background: '#F5F5F7', padding: '24px 32px' }}>
      {showForm && <AddSiteForm onClose={() => { setShowForm(false); load() }} />}
      {editingSite && <EditSiteForm site={editingSite} onClose={() => { setEditingSite(null); load() }} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1D1D1F', margin: 0, letterSpacing: '-0.01em' }}>Sites</h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '4px 0 0' }}>Manage your monitored web properties</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, background: '#007AFF', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Site
        </button>
      </div>

      {/* Filters */}
      {(activeDivisions.length > 0 || activeRegions.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
          {activeDivisions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Division</span>
              <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)} style={selectStyle}>
                <option value="">All</option>
                {activeDivisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {activeRegions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Region</span>
              <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={selectStyle}>
                <option value="">All</option>
                {activeRegions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: '#6B6B6B', fontSize: 14 }}>Loading…</div>
      ) : sites.length === 0 ? (
        <div style={{ borderRadius: 12, border: '1.5px dashed #D1D1D6', padding: '64px 32px', textAlign: 'center', background: '#fff' }}>
          <div style={{ fontSize: 16, color: '#1D1D1F', fontWeight: 600, marginBottom: 8 }}>No sites configured yet</div>
          <p style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 20 }}>Add your first site to start monitoring accessibility.</p>
          <button
            onClick={() => setShowForm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            + Add Site
          </button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9F9FB', borderBottom: '1px solid #E5E5EA' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Site</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Division</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Brand</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pages</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>WCAG Errors</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Scan</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Added</th>
                <th style={{ padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((site, i) => (
                <tr key={site.id} style={{ borderTop: i > 0 ? '1px solid #F0F0F0' : undefined }}
                  className="hover:bg-[#F5F5F7] transition-colors">
                  <td style={{ padding: '13px 16px' }}>
                    <Link href={`/sites/${site.id}`} style={{ fontWeight: 600, color: '#007AFF', textDecoration: 'none' }}>
                      {site.name}
                    </Link>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    {site.division
                      ? <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8' }}>{site.division}</span>
                      : <span style={{ color: '#6B6B6B' }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', color: '#3A3A3C' }}>
                    {site.brand ?? <span style={{ color: '#6B6B6B' }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', color: '#3A3A3C' }}>
                    {site.pages?.length ?? 0} page{(site.pages?.length ?? 0) !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 600, color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>
                    {site.latestScan ? site.latestScan.raw_violation_count : <span style={{ color: '#6B6B6B', fontWeight: 400 }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', color: '#6B6B6B' }}>
                    {site.latestScan ? formatDate(site.latestScan.started_at) : '—'}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', color: '#6B6B6B' }}>
                    {formatDate(site.created_at)}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                      <button onClick={() => setEditingSite(site)} style={{ fontSize: 12, fontWeight: 600, color: '#007AFF', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => deleteSite(site.id, site.name)} style={{ fontSize: 12, fontWeight: 600, color: '#FF3B30', background: 'none', border: 'none', cursor: 'pointer' }}>
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
