export interface Port {
  id: string
  name: string
  side: 'west' | 'east' | 'north' | 'south'
  type: string
}

export interface GraphNode {
  id: string
  type: string
  label: string
  x: number
  y: number
  ports: Port[]
  properties: Record<string, unknown>
}

export interface Wire {
  id: string
  fromNodeId: string
  fromPortId: string
  toNodeId: string
  toPortId: string
}

export interface GraphState {
  nodes: GraphNode[]
  wires: Wire[]
}

/** The absolute position of a port on the canvas, derived from its node position. */
export interface PortPosition {
  x: number
  y: number
}

export const PORT_HEIGHT = 20
export const PORT_RADIUS = 5
export const NODE_MARGIN = 12
export const NODE_MIN_WIDTH = 100
