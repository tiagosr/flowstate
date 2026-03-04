interface Props {
  x1: number
  y1: number
  x2: number
  y2: number
  id: string
  onDoubleClick?: (wireId: string) => void
}

export function WireElement({ x1, y1, x2, y2, id, onDoubleClick }: Props) {
  const dx = Math.abs(x2 - x1) * 0.5
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`

  return (
    <g>
      {/* Wide transparent hit area */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: 'pointer' }}
        onDoubleClick={onDoubleClick ? () => onDoubleClick(id) : undefined}
      />
      <path d={d} fill="none" stroke="#475569" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
    </g>
  )
}
