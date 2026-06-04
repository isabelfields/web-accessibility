'use client'

const SEGMENTS = [
  { key: 'critical', label: 'Critical', color: 'bg-indigo-700', hex: '#4338ca' },
  { key: 'serious',  label: 'Serious',  color: 'bg-blue-600',   hex: '#2563eb' },
  { key: 'moderate', label: 'Moderate', color: 'bg-sky-500',    hex: '#0ea5e9' },
  { key: 'minor',    label: 'Minor',    color: 'bg-cyan-400',   hex: '#22d3ee' },
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
      <div className={`flex w-full rounded-full overflow-hidden ${height} bg-[#252a38]`}>
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
                <span className="text-xs text-white/90">{label}</span>
                <span className="text-xs font-semibold text-white">{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
