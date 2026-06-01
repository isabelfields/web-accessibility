'use client'

export function ScoreGauge({ score, size = 160 }: { score: number; size?: number }) {
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
  const color =
    score >= 90 ? '#22c55e' :
    score >= 80 ? '#84cc16' :
    score >= 70 ? '#eab308' :
    score >= 60 ? '#f97316' : '#ef4444'
  const r = size * 0.38
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const totalAngle = 260
  const pct = score / 100
  const trackArc = (totalAngle / 360) * circumference
  const filledArc = pct * trackArc
  const rotation = -220

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="#e5e7eb" strokeWidth={size * 0.08}
          strokeDasharray={`${trackArc} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={color} strokeWidth={size * 0.08}
          strokeDasharray={`${filledArc} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        <text
          x={cx} y={cy - 4}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.22} fontWeight="700" fill="#111827"
        >
          {Math.round(score)}
        </text>
        <text
          x={cx} y={cy + size * 0.14}
          textAnchor="middle"
          fontSize={size * 0.12} fill="#6b7280"
        >
          {grade}
        </text>
      </svg>
    </div>
  )
}
