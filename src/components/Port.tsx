import { Port, PORT_RADIUS } from '../types/graph'

interface Props {
  port: Port
  x: number
  y: number
  onPointerDown?: (e: React.PointerEvent, port: Port) => void
  onPointerUp?: (e: React.PointerEvent, port: Port) => void
  highlighted?: boolean
}

const labelOffset = PORT_RADIUS + 4

const labelProps: Record<Port['side'], { x: number; y: number; textAnchor: 'start' | 'end' | 'middle' }> = {
  west:  { x:  labelOffset, y: 4,             textAnchor: 'start' },
  east:  { x: -labelOffset, y: 4,             textAnchor: 'end'   },
  north: { x: 0,            y:  labelOffset + 4, textAnchor: 'middle' },
  south: { x: 0,            y: -labelOffset,  textAnchor: 'middle' },
}

export function PortElement({ port, x, y, onPointerDown, onPointerUp, highlighted }: Props) {
  const lp = labelProps[port.side]
  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'crosshair' }}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, port) : undefined}
      onPointerUp={onPointerUp ? (e) => onPointerUp(e, port) : undefined}
    >
      <circle
        r={PORT_RADIUS}
        fill={highlighted ? '#60a5fa' : '#1e293b'}
        stroke={highlighted ? '#93c5fd' : '#64748b'}
        strokeWidth={1.5}
      />
      <text
        x={lp.x}
        y={lp.y}
        fontSize={10}
        fill="#94a3b8"
        textAnchor={lp.textAnchor}
        fontFamily="monospace"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {port.name}
      </text>
    </g>
  )
}
