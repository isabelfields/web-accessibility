'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HEARST_DIVISIONS, HEARST_BRANDS, HEARST_REGIONS, HearstDivision } from '@/types'
import { normalizeUrl } from '@/lib/format'

interface PageRow {
  url: string
  label: string
  templateType: 'homepage' | 'article' | 'gallery' | 'category' | 'commerce' | 'video' | 'search' | 'other'
}

const emptyPage = (): PageRow => ({ url: '', label: '', templateType: 'other' })

export function AddSiteForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [division, setDivision] = useState<HearstDivision | ''>('')
  const [brand, setBrand] = useState('')
  const [region, setRegion] = useState('')
  const [pages, setPages] = useState<PageRow[]>([emptyPage()])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updatePage(index: number, field: keyof PageRow, value: string) {
    setPages(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function handleUrlBlur(index: number, value: string) {
    updatePage(index, 'url', normalizeUrl(value))
  }

  function addPage() {
    setPages(prev => [...prev, emptyPage()])
  }

  function removePage(index: number) {
    setPages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const normalizedPages = pages.map(p => ({ ...p, url: normalizeUrl(p.url) }))

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, division: division || undefined, brand: brand || undefined, region: region || undefined, pages: normalizedPages }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(JSON.stringify(data.error?.fieldErrors ?? data.error ?? 'Error creating site'))
        return
      }
      router.refresh()
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Add New Site</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="e.g. Elle.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
              <select
                value={division}
                onChange={e => { setDivision(e.target.value as HearstDivision | ''); setBrand('') }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select division…</option>
                {HEARST_DIVISIONS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <select
                value={brand}
                onChange={e => setBrand(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select brand…</option>
                {(division ? HEARST_BRANDS[division as HearstDivision] ?? [] : []).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select region…</option>
                {HEARST_REGIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Pages to Scan</label>
              <button
                type="button"
                onClick={addPage}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Page
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">Add the homepage and one example of each template type (article, gallery, etc.)</p>
            <div className="space-y-3">
              {pages.map((page, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="elle.com/fashion/article"
                      value={page.url}
                      onChange={e => updatePage(i, 'url', e.target.value)}
                      onBlur={e => handleUrlBlur(i, e.target.value)}
                      required
                      className="col-span-3 sm:col-span-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Label (e.g. Homepage)"
                      value={page.label}
                      onChange={e => updatePage(i, 'label', e.target.value)}
                      required
                      className="col-span-3 sm:col-span-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={page.templateType}
                      onChange={e => updatePage(i, 'templateType', e.target.value)}
                      className="col-span-3 sm:col-span-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="homepage">Homepage</option>
                      <option value="article">Article</option>
                      <option value="commerce">Commerce / Product</option>
                      <option value="gallery">Gallery</option>
                      <option value="category">Category</option>
                      <option value="video">Video</option>
                      <option value="search">Search Results</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePage(i)}
                      className="mt-2 text-red-400 hover:text-red-600 text-lg"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
