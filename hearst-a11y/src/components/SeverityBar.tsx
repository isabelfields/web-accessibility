'use client'

const SEGMENTS = [
  { key: 'critical', label: 'Critical', color: 'bg-red-500',    hex: '#ef4444' },
  { key: 'serious',  label: 'Serious',  color: 'bg-red-400',    hex: '#f87171' },
  { key: 'moderate', label: 'Moderate', color: 'bg-amber-400',  hex: '#fbbf24' },
  { key: 'minor',    label: 'Minor',    color: 'bg-blue-300',   hex: '#93c5fd' },
] as const

interface SeverityBarProps {
  counts: { critical: number; serious: number; moderate: number; minor: number }
  showLegend?: boolean
  height?: string
}

export function SeverityBar({ counts, showLegend = true, height = 'h-3' }: SeverityBarProps) {
  const total = counts.critical + counts.serious + counts.moderate + counts.minor
  if (total === 0) return null

  return (
    <div>
      <div className={`flex w-full rounded-full overflow-hidden ${height} bg-gray-100`}>
        {SEGMENTS.map(({ key, color }) => {
          const pct = (counts[key] / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={key}
              className={`${color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${key}: ${counts[key]} (${Math.round(pct)}%)`}
            />
          )
        })}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
          {SEGMENTS.map(({ key, label, hex }) => {
            const count = counts[key]
            if (count === 0) return null
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: hex }} />
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs font-semibold text-gray-700">{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
