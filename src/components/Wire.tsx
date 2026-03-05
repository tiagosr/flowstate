interface Props {
  x1: number
  y1: number
  tx1: number  // exit tangent at (x1,y1): unit vector pointing away from this endpoint
  ty1: number
  x2: number
  y2: number
  tx2: number  // exit tangent at (x2,y2): unit vector pointing away from this endpoint
  ty2: number
  netId: string
  segId: string
  selected?: boolean
  onClick?: (netId: string, segId: string) => void
  onDoubleClick?: (netId: string, segId: string) => void
}

export function WireElement({ x1, y1, tx1, ty1, x2, y2, tx2, ty2, netId, segId, selected, onClick, onDoubleClick }: Props) {
  const dist = Math.hypot(x2 - x1, y2 - y1)
  const offset = Math.max(30, dist * 0.4)
  const cx1 = x1 + tx1 * offset
  const cy1 = y1 + ty1 * offset
  const cx2 = x2 + tx2 * offset
  const cy2 = y2 + ty2 * offset
  const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`

  return (
    <g>
      {/* Wide transparent hit area */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: 'pointer' }}
        onClick={onClick ? () => onClick(netId, segId) : undefined}
        onDoubleClick={onDoubleClick ? () => onDoubleClick(netId, segId) : undefined}
      />
      <path
        d={d}
        fill="none"
        stroke={selected ? '#60a5fa' : '#475569'}
        strokeWidth={selected ? 2 : 1.5}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  )
}
