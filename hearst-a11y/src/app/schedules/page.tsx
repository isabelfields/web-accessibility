'use client'

import { useState, useEffect, useCallback } from 'react'
import { AddScheduleForm } from '@/components/AddScheduleForm'

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/schedules')
    setSchedules(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteSchedule(id: string) {
    if (!confirm('Delete this schedule?')) return
    await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="px-8 py-6">
      {showForm && <AddScheduleForm onClose={() => { setShowForm(false); load() }} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Schedules</h1>
          <p className="text-gray-400 text-sm mt-0.5">Automated accessibility scan schedules</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Schedule
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-gray-400">Loading…</div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <div className="text-gray-400 text-lg mb-3">No schedules yet</div>
          <p className="text-gray-400 text-sm mb-6">Schedules automatically run accessibility scans on a recurring basis.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            + Add Schedule
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">URL</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cadence</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Last Run</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Next Run</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schedules.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 truncate max-w-xs">{s.root_url}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                      {s.cadence}
                    </span>
                    {s.cadence === 'weekly' && s.day_of_week != null && (
                      <span className="ml-2 text-xs text-gray-400">{DAYS[s.day_of_week]}</span>
                    )}
                    {s.cadence === 'monthly' && s.day_of_month != null && (
                      <span className="ml-2 text-xs text-gray-400">day {s.day_of_month}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {s.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">{formatDate(s.last_run_at)}</td>
                  <td className="px-4 py-3 text-right text-gray-600 text-xs">{formatDate(s.next_run_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteSchedule(s.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
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
