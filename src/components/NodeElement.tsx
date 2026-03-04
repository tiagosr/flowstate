import { GraphNode, Port, PORT_HEIGHT, PORT_RADIUS, NODE_MARGIN, NODE_MIN_WIDTH } from '../types/graph'
import { PortElement } from './Port'

interface Props {
  node: GraphNode
  onPointerDown: (e: React.PointerEvent, nodeId: string) => void
  onPortPointerDown: (e: React.PointerEvent, port: Port, nodeId: string) => void
  onPortPointerUp: (e: React.PointerEvent, port: Port, nodeId: string) => void
  pendingFromPortId?: string
}

// Approximate character widths for monospace fonts
const PORT_LABEL_CHAR_WIDTH = 6   // 10px font
const NODE_LABEL_CHAR_WIDTH = 7   // 11px bold font
const PORT_LABEL_HEIGHT = 10      // 10px font size

function getTopMargin(node: GraphNode): number {
  const northCount = node.ports.filter((p) => p.side === 'north').length
  return northCount > 0 ? PORT_RADIUS + 4 + PORT_LABEL_HEIGHT : NODE_MARGIN
}

function getBottomMargin(node: GraphNode): number {
  const southCount = node.ports.filter((p) => p.side === 'south').length
  return southCount > 0 ? PORT_RADIUS + 4 + PORT_LABEL_HEIGHT : NODE_MARGIN
}

export function getNodeWidth(node: GraphNode): number {
  const inset = PORT_RADIUS + 4
  const westMax = Math.max(0, ...node.ports.filter((p) => p.side === 'west').map((p) => p.name.length * PORT_LABEL_CHAR_WIDTH))
  const eastMax = Math.max(0, ...node.ports.filter((p) => p.side === 'east').map((p) => p.name.length * PORT_LABEL_CHAR_WIDTH))
  const horizontalMax = Math.max(westMax, eastMax)
  const northCount = node.ports.filter((p) => p.side === 'north').length
  const southCount = node.ports.filter((p) => p.side === 'south').length

  const fromOpposingPorts = 2 * inset + 2 * horizontalMax + NODE_MARGIN
  const fromLabel = node.label.length * NODE_LABEL_CHAR_WIDTH + 2 * horizontalMax + 2 * NODE_MARGIN
  const fromNorthSouth = NODE_MARGIN + Math.max(northCount, southCount) * PORT_HEIGHT

  return Math.max(fromOpposingPorts, fromLabel, fromNorthSouth, NODE_MIN_WIDTH)
}

export function getNodeHeight(node: GraphNode): number {
  const westCount = node.ports.filter((p) => p.side === 'west').length
  const eastCount = node.ports.filter((p) => p.side === 'east').length
  return getTopMargin(node) + Math.max(westCount, eastCount, 1) * PORT_HEIGHT + getBottomMargin(node)
}

/** Returns the port's position relative to the node's origin. */
export function getPortOffset(node: GraphNode, port: Port): { x: number; y: number } {
  const sidePorts = node.ports.filter((p) => p.side === port.side)
  const index = sidePorts.findIndex((p) => p.id === port.id)
  const width = getNodeWidth(node)
  const height = getNodeHeight(node)
  const top = getTopMargin(node)

  switch (port.side) {
    case 'west':  return { x: 0,     y: top + index * PORT_HEIGHT + PORT_HEIGHT / 2 }
    case 'east':  return { x: width, y: top + index * PORT_HEIGHT + PORT_HEIGHT / 2 }
    case 'north': return { x: NODE_MARGIN + index * PORT_HEIGHT + PORT_HEIGHT / 2, y: 0 }
    case 'south': return { x: NODE_MARGIN + index * PORT_HEIGHT + PORT_HEIGHT / 2, y: height }
  }
}

export function NodeElement({ node, onPointerDown, onPortPointerDown, onPortPointerUp, pendingFromPortId }: Props) {
  const width = getNodeWidth(node)
  const height = getNodeHeight(node)

  return (
    <g transform={`translate(${node.x}, ${node.y})`}>
      {/* Shadow */}
      <rect x={2} y={2} width={width} height={height} rx={3} fill="black" opacity={0.25} />

      {/* Body */}
      <rect
        width={width}
        height={height}
        rx={3}
        fill="#0f172a"
        stroke="#334155"
        strokeWidth={1}
        style={{ cursor: 'grab' }}
        onPointerDown={(e) => onPointerDown(e, node.id)}
      />

      {/* Label centered in node body */}
      <text
        x={width / 2}
        y={height / 2 + 4}
        fontSize={11}
        fontWeight="600"
        fill="#e2e8f0"
        textAnchor="middle"
        fontFamily="monospace"
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
          />
        )
      })}
    </g>
  )
}
