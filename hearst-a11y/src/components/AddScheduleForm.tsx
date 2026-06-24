'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal } from './Modal'

interface Site { id: string; name: string; division?: string | null; pages: { url: string }[] }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const NO_DIVISION = 'Other'

/** Group sites by division, sorted division → site name ("Other" division last). */
function groupByDivision(sites: Site[]): { division: string; sites: Site[] }[] {
  const byDivision = new Map<string, Site[]>()
  for (const s of sites) {
    const key = s.division || NO_DIVISION
    if (!byDivision.has(key)) byDivision.set(key, [])
    byDivision.get(key)!.push(s)
  }
  return [...byDivision.keys()]
    .sort((a, b) => (a === NO_DIVISION ? 1 : b === NO_DIVISION ? -1 : a.localeCompare(b)))
    .map(division => ({
      division,
      sites: byDivision.get(division)!.slice().sort((x, y) => x.name.localeCompare(y.name)),
    }))
}

interface Props { onClose: () => void }

export function AddScheduleForm({ onClose }: Props) {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const grouped = useMemo(() => groupByDivision(sites), [sites])

  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then((data: Site[]) => {
      setSites(data)
      // Default to the first site in division → name order, matching the dropdown.
      const first = groupByDivision(data)[0]?.sites[0]
      if (first) setSiteId(first.id)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const site = sites.find(s => s.id === siteId)
    if (!site) return

    setSaving(true)
    const body: any = { url: site.pages[0]?.url ?? '', cadence }
    if (cadence === 'weekly') body.dayOfWeek = dayOfWeek
    if (cadence === 'monthly') body.dayOfMonth = dayOfMonth

    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      onClose()
    } else {
      setError('Failed to create schedule.')
    }
  }

  return (
    <Modal title="New Schedule" onClose={onClose} size="md">
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Site</label>
            <select
              value={siteId}
              onChange={e => setSiteId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {grouped.map(g => (
                <optgroup key={g.division} label={g.division}>
                  {g.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cadence</label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setCadence(c)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-colors ${
                    cadence === c
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {cadence === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Day of week</label>
              <select
                value={dayOfWeek}
                onChange={e => setDayOfWeek(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}

          {cadence === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Day of month</label>
              <select
                value={dayOfMonth}
                onChange={e => setDayOfMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || sites.length === 0} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Create schedule'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
