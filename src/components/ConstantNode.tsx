import { GraphNode, Port, PORT_RADIUS } from '../types/graph'
import { getNodeWidth, getNodeHeight, getPortOffset } from './NodeElement'
import { PortElement } from './Port'

interface Props {
  node: GraphNode
  onPointerDown: (e: React.PointerEvent, nodeId: string) => void
  onPortPointerDown: (e: React.PointerEvent, port: Port, nodeId: string) => void
  onPortPointerUp: (e: React.PointerEvent, port: Port, nodeId: string) => void
  pendingFromPortId?: string
}

const typeTheme: Record<string, { body: string; border: string; text: string }> = {
  'const/number': { body: '#061e2a', border: '#0d4a5a', text: '#7dd3d3' },
  'const/bool':   { body: '#061a10', border: '#0d4020', text: '#86efac' },
  'const/string': { body: '#1e1206', border: '#4a3010', text: '#fcd34d' },
}

const boolFalseTheme = { body: '#1a0606', border: '#4a1010', text: '#fca5a5' }

export function ConstantNode({
  node,
  onPointerDown,
  onPortPointerDown,
  onPortPointerUp,
  pendingFromPortId,
}: Props) {
  const width = getNodeWidth(node)
  const height = getNodeHeight(node)

  const isBool = node.type === 'const/bool'
  const boolValue = isBool && node.properties.value === true
  const theme = isBool && !boolValue
    ? boolFalseTheme
    : (typeTheme[node.type] ?? typeTheme['const/number'])

  return (
    <g transform={`translate(${node.x}, ${node.y})`}>
      {/* Shadow */}
      <rect x={2} y={2} width={width} height={height} rx={4} fill="black" opacity={0.3} />

      {/* Body */}
      <rect
        width={width}
        height={height}
        rx={4}
        fill={theme.body}
        stroke={theme.border}
        strokeWidth={1.5}
        style={{ cursor: 'grab' }}
        onPointerDown={(e) => onPointerDown(e, node.id)}
      />

      {/* Boolean indicator dot */}
      {isBool && (
        <circle
          cx={14}
          cy={height / 2}
          r={4}
          fill={boolValue ? '#4ade80' : '#f87171'}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Value label */}
      <text
        x={isBool ? width / 2 + 5 : width / 2}
        y={height / 2 + 4}
        fontSize={11}
        fontWeight="600"
        fontFamily="monospace"
        fill={theme.text}
        textAnchor="middle"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {node.label}
      </text>

      {/* Ports */}
      {node.ports.map((port) => {
        const offset = getPortOffset(node, port)
        return (
          <PortElement
            key={port.id}
            port={port}
            x={offset.x}
            y={offset.y}
            onPointerDown={(e, p) => onPortPointerDown(e, p, node.id)}
            onPointerUp={(e, p) => onPortPointerUp(e, p, node.id)}
            highlighted={pendingFromPortId === port.id}
            hideLabel
          />
        )
      })}
    </g>
  )
}
