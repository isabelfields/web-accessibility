'use client'

export function TrendSparkline({
  scores,
  width = 200,
  height = 60,
}: {
  scores: number[]
  width?: number
  height?: number
}) {
  if (scores.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ width, height }}
      >
        Not enough data
      </div>
    )
  }

  const latest = scores[scores.length - 1]
  const color =
    latest >= 90 ? '#22c55e' :
    latest >= 80 ? '#84cc16' :
    latest >= 70 ? '#eab308' :
    latest >= 60 ? '#f97316' : '#ef4444'

  const pad = 6
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  const minScore = Math.max(0, Math.min(...scores) - 5)
  const maxScore = Math.min(100, Math.max(...scores) + 5)
  const range = maxScore - minScore || 1

  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * innerW
    const y = pad + innerH - ((s - minScore) / range) * innerH
    return { x, y, s }
  })

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
      ))}
    </svg>
  )
}
