import { create } from 'zustand'
import { GraphNode, Net, Segment } from '../types/graph'

interface GraphStore {
  nodes: GraphNode[]
  nets: Net[]
  addNode: (node: GraphNode) => void
  removeNode: (nodeId: string) => void
  moveNode: (nodeId: string, x: number, y: number) => void
  updateProperty: (nodeId: string, key: string, value: unknown) => void
  patchNode: (nodeId: string, patch: Partial<GraphNode>) => void
  addNet: (net: Net) => void
  updateNet: (netId: string, updater: (net: Net) => Net) => void
  mergeNets: (netIdA: string, netIdB: string, newSeg: Segment) => void
  moveJunction: (netId: string, junctionId: string, x: number, y: number) => void
  removeNet: (netId: string) => void
  removeSegment: (netId: string, segId: string) => void
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  nets: [],

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),

  removeNode: (nodeId) =>
    set((s) => {
      const updatedNets = s.nets
        .map((net) => {
          const newSegments = net.segments.filter(
            (seg) => ![seg.from, seg.to].some((ep) => ep.kind === 'port' && ep.nodeId === nodeId),
          )
          if (newSegments.length === net.segments.length) return net
          const allEps = newSegments.flatMap((seg) => [seg.from, seg.to])
          return {
            ...net,
            segments: newSegments,
            junctions: net.junctions.filter((j) =>
              allEps.some((ep) => ep.kind === 'junction' && ep.junctionId === j.id),
            ),
            portRefs: net.portRefs.filter(
              (p) =>
                p.nodeId !== nodeId &&
                allEps.some((ep) => ep.kind === 'port' && ep.nodeId === p.nodeId && ep.portId === p.portId),
            ),
          }
        })
        .filter((net) => net.segments.length > 0)
      return { nodes: s.nodes.filter((n) => n.id !== nodeId), nets: updatedNets }
    }),

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

  patchNode: (nodeId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    })),

  addNet: (net) => set((s) => ({ nets: [...s.nets, net] })),

  updateNet: (netId, updater) =>
    set((s) => ({
      nets: s.nets.map((net) => (net.id === netId ? updater(net) : net)),
    })),

  mergeNets: (netIdA, netIdB, newSeg) =>
    set((s) => {
      const netA = s.nets.find((n) => n.id === netIdA)!
      const netB = s.nets.find((n) => n.id === netIdB)!
      const merged: Net = {
        id: netIdA,
        portRefs: [...netA.portRefs, ...netB.portRefs],
        junctions: [...netA.junctions, ...netB.junctions],
        segments: [...netA.segments, ...netB.segments, newSeg],
      }
      return { nets: s.nets.filter((n) => n.id !== netIdA && n.id !== netIdB).concat(merged) }
    }),

  moveJunction: (netId, junctionId, x, y) =>
    set((s) => ({
      nets: s.nets.map((net) =>
        net.id !== netId
          ? net
          : { ...net, junctions: net.junctions.map((j) => (j.id === junctionId ? { ...j, x, y } : j)) },
      ),
    })),

  removeNet: (netId) => set((s) => ({ nets: s.nets.filter((n) => n.id !== netId) })),

  removeSegment: (netId, segId) =>
    set((s) => {
      const net = s.nets.find((n) => n.id === netId)
      if (!net) return s
      const newSegments = net.segments.filter((seg) => seg.id !== segId)
      if (newSegments.length === 0) {
        return { nets: s.nets.filter((n) => n.id !== netId) }
      }
      const allEps = newSegments.flatMap((seg) => [seg.from, seg.to])
      return {
        nets: s.nets.map((n) =>
          n.id !== netId
            ? n
            : {
                ...n,
                segments: newSegments,
                junctions: net.junctions.filter((j) =>
                  allEps.some((ep) => ep.kind === 'junction' && ep.junctionId === j.id),
                ),
                portRefs: net.portRefs.filter((p) =>
                  allEps.some(
                    (ep) => ep.kind === 'port' && ep.nodeId === p.nodeId && ep.portId === p.portId,
                  ),
                ),
              },
        ),
      }
    }),
}))
