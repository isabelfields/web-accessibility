'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PageRow {
  url: string
  label: string
  templateType: 'homepage' | 'article' | 'gallery' | 'category' | 'other'
}

const emptyPage = (): PageRow => ({ url: '', label: '', templateType: 'other' })

export function AddSiteForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pages, setPages] = useState<PageRow[]>([emptyPage()])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updatePage(index: number, field: keyof PageRow, value: string) {
    setPages(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
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

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pages }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(JSON.stringify(data.error?.fieldErrors ?? data.error ?? 'Error creating site'))
        return
      }
      router.refresh()
      onClose()
    } catch (err) {
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Elle.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Pages to Scan</label>
              <button
                type="button"
                onClick={addPage}
                className="text-sm text-brand-500 hover:text-blue-700 font-medium"
              >
                + Add Page
              </button>
            </div>
            <div className="space-y-3">
              {pages.map((page, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={page.url}
                      onChange={e => updatePage(i, 'url', e.target.value)}
                      required
                      className="col-span-3 sm:col-span-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <input
                      type="text"
                      placeholder="Label (e.g. Homepage)"
                      value={page.label}
                      onChange={e => updatePage(i, 'label', e.target.value)}
                      required
                      className="col-span-3 sm:col-span-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <select
                      value={page.templateType}
                      onChange={e => updatePage(i, 'templateType', e.target.value)}
                      className="col-span-3 sm:col-span-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="homepage">Homepage</option>
                      <option value="article">Article</option>
                      <option value="gallery">Gallery</option>
                      <option value="category">Category</option>
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
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
