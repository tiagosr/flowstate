import { create } from 'zustand'
import { GraphNode, Wire } from '../types/graph'

interface GraphStore {
  nodes: GraphNode[]
  wires: Wire[]
  addNode: (node: GraphNode) => void
  removeNode: (nodeId: string) => void
  moveNode: (nodeId: string, x: number, y: number) => void
  updateProperty: (nodeId: string, key: string, value: unknown) => void
  addWire: (wire: Wire) => void
  removeWire: (wireId: string) => void
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  wires: [],

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),

  removeNode: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      wires: s.wires.filter((w) => w.fromNodeId !== nodeId && w.toNodeId !== nodeId),
    })),

  moveNode: (nodeId, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
    })),

  updateProperty: (nodeId, key, value) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, properties: { ...n.properties, [key]: value } } : n,
      ),
    })),

  addWire: (wire) => set((s) => ({ wires: [...s.wires, wire] })),

  removeWire: (wireId) => set((s) => ({ wires: s.wires.filter((w) => w.id !== wireId) })),
}))
