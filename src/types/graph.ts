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

export type SegEndpoint =
  | { kind: 'port'; nodeId: string; portId: string }
  | { kind: 'junction'; junctionId: string }

export interface Segment {
  id: string
  from: SegEndpoint
  to: SegEndpoint
}

export interface Junction {
  id: string
  x: number
  y: number
}

export interface Net {
  id: string
  portRefs: Array<{ nodeId: string; portId: string }>
  junctions: Junction[]
  segments: Segment[]
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
