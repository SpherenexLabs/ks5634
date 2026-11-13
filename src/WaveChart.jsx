const WIDTH = 300

function buildSmoothPath(points) {
  let path = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    path += ` Q ${x0} ${y0} ${mx} ${my}`
  }
  const last = points[points.length - 1]
  path += ` L ${last[0]} ${last[1]}`
  return path
}

export function WaveChart({ data, id, color = '#4f7cff', height = 70, secondaryData, secondaryColor }) {
  if (!data || data.length < 2) {
    return (
      <div className="wave-empty" style={{ height }}>Collecting live readings…</div>
    )
  }

  const hasSecondary = Array.isArray(secondaryData) && secondaryData.length === data.length

  const min = Math.min(...data, ...(hasSecondary ? secondaryData : []))
  const max = Math.max(...data, ...(hasSecondary ? secondaryData : []))
  const range = max - min || 1
  const padding = 6
  const stepX = WIDTH / (data.length - 1)

  const toPoints = (series) =>
    series.map((v, i) => {
      const x = i * stepX
      const y = height - padding - ((v - min) / range) * (height - padding * 2)
      return [x, y]
    })

  const points = toPoints(data)
  const linePath = buildSmoothPath(points)
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${height} L 0 ${height} Z`
  const gradientId = `wave-fill-${id}`

  const secondaryPoints = hasSecondary ? toPoints(secondaryData) : null
  const secondaryPath = secondaryPoints ? buildSmoothPath(secondaryPoints) : null

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="wave-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      {secondaryPath && (
        <path
          d={secondaryPath}
          fill="none"
          stroke={secondaryColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />
      )}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3.5" fill={color} />
      {secondaryPoints && (
        <circle
          cx={secondaryPoints[secondaryPoints.length - 1][0]}
          cy={secondaryPoints[secondaryPoints.length - 1][1]}
          r="3.5"
          fill={secondaryColor}
        />
      )}
    </svg>
  )
}
