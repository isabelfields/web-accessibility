'use client'

import { useState, useEffect } from 'react'

interface Site { id: string; name: string; pages: { url: string }[] }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props { onClose: () => void }

const inputCls = "w-full bg-[#0c0c10] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4a4a6a]"
const labelCls = "block text-sm font-medium text-white/70 mb-1.5"

export function AddScheduleForm({ onClose }: Props) {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then((data: Site[]) => {
      setSites(data)
      if (data.length > 0) setSiteId(data[0].id)
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-[#13131c] border border-[#2a2a3a] rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">New Schedule</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Site</label>
            <select value={siteId} onChange={e => setSiteId(e.target.value)} required className={inputCls}>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Cadence</label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setCadence(c)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-colors ${
                    cadence === c
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-transparent text-white/70 border-[#2a2a3a] hover:border-blue-500 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {cadence === 'weekly' && (
            <div>
              <label className={labelCls}>Day of week</label>
              <select value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))} className={inputCls}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}

          {cadence === 'monthly' && (
            <div>
              <label className={labelCls}>Day of month</label>
              <select value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} className={inputCls}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-[#2a2a3a] text-sm font-medium text-white/70 hover:bg-[#1e1e2a] hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || sites.length === 0} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Create schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
