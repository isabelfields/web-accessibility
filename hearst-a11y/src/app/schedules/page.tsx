import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getSchedules() {
  const schedules = await sql`SELECT * FROM schedules ORDER BY created_at DESC`
  return schedules
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function SchedulesPage() {
  const schedules = await getSchedules()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
          <p className="text-gray-500 text-sm mt-1">Automated accessibility scan schedules</p>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <div className="text-gray-400 text-lg mb-3">No schedules configured</div>
          <p className="text-gray-400 text-sm mb-6">
            Schedules are created through the API. Use the <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">POST /api/schedules</code> endpoint to create recurring scans.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left text-xs font-mono text-gray-600 max-w-md mx-auto">
            {`POST /api/schedules\n{\n  "url": "https://example.com",\n  "cadence": "weekly",\n  "dayOfWeek": 1\n}`}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">URL</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Cadence</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Last Run</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Next Run</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((schedule: any) => (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 truncate max-w-xs">{schedule.root_url}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 capitalize">
                      {schedule.cadence}
                    </span>
                    {schedule.cadence === 'weekly' && schedule.day_of_week !== null && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][schedule.day_of_week]})
                      </span>
                    )}
                    {schedule.cadence === 'monthly' && schedule.day_of_month !== null && (
                      <span className="ml-2 text-xs text-gray-500">
                        (day {schedule.day_of_month})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      schedule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {schedule.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatDate(schedule.last_run_at)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatDate(schedule.next_run_at)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatDate(schedule.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-blue-800 mb-2">API Reference</h2>
        <div className="space-y-2 text-sm text-blue-700">
          <div><code className="bg-blue-100 px-1 rounded">POST /api/schedules</code> — Create a schedule</div>
          <div><code className="bg-blue-100 px-1 rounded">GET /api/schedules</code> — List all schedules</div>
          <div><code className="bg-blue-100 px-1 rounded">DELETE /api/schedules?id=&lt;id&gt;</code> — Delete a schedule</div>
          <div><code className="bg-blue-100 px-1 rounded">GET /api/cron</code> — Vercel cron endpoint (runs due schedules)</div>
        </div>
      </div>
    </div>
  )
}
