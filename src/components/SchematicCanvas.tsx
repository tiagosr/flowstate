import { useRef, useState, useCallback } from 'react'
import { useGraphStore } from '../store/graphStore'
import { GraphNode, Net, Segment, SegEndpoint, Port, PortPosition } from '../types/graph'
import { NodeElement, getPortOffset } from './NodeElement'
import { ConstantNode } from './ConstantNode'
import { WireElement } from './Wire'
import { ContextMenu } from './ContextMenu'
import { nodeRegistry } from '../nodes/registry'

interface Transform {
  x: number
  y: number
  scale: number
}

interface PendingWire {
  fromNodeId: string
  fromPortId: string
  fromSide: Port['side']
  mouseX: number
  mouseY: number
}

let nextId = 1
function uid() {
  return String(nextId++)
}

function getPortPosition(node: GraphNode, portId: string): PortPosition {
  const port = node.ports.find((p) => p.id === portId)!
  const offset = getPortOffset(node, port)
  return { x: node.x + offset.x, y: node.y + offset.y }
}

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function closestPointOnSeg(
  px: number, py: number, x1: number, y1: number, x2: number, y2: number,
): { x: number; y: number } {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2))
  return { x: x1 + t * dx, y: y1 + t * dy }
}

export function SchematicCanvas() {
  const { nodes, nets, addNode, moveNode, moveJunction, addNet, updateNet, mergeNets, removeSegment, patchNode } =
    useGraphStore()
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [pending, setPending] = useState<PendingWire | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    screenX: number; screenY: number; canvasX: number; canvasY: number
  } | null>(null)
  const [editingConst, setEditingConst] = useState<{
    nodeId: string; value: string; screenX: number; screenY: number
  } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingNode = useRef<{
    nodeId: string; startX: number; startY: number; originX: number; originY: number
  } | null>(null)
  const draggingJunction = useRef<{
    netId: string; junctionId: string; startX: number; startY: number; originX: number; originY: number
  } | null>(null)
  const didDrag = useRef(false)
  const nodeToToggle = useRef<string | null>(null)
  const isPanning = useRef(false)
  const lastPan = useRef({ x: 0, y: 0 })

  const toCanvas = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - transform.x) / transform.scale,
      y: (sy - transform.y) / transform.scale,
    }),
    [transform],
  )

  // Resolves a SegEndpoint to its absolute canvas position.
  function resolveEndpoint(net: Net, ep: SegEndpoint): PortPosition | null {
    if (ep.kind === 'port') {
      const node = nodes.find((n) => n.id === ep.nodeId)
      if (!node) return null
      return getPortPosition(node, ep.portId)
    }
    const j = net.junctions.find((j) => j.id === ep.junctionId)
    return j ? { x: j.x, y: j.y } : null
  }

  function segmentEndpoints(net: Net, seg: Segment) {
    const from = resolveEndpoint(net, seg.from)
    const to = resolveEndpoint(net, seg.to)
    if (!from || !to) return null
    return { from, to }
  }

  const onSvgPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.target !== svgRef.current && !(e.target as Element).classList.contains('pan-target')) return
    isPanning.current = true
    lastPan.current = { x: e.clientX, y: e.clientY }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }, [])

  const onSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isPanning.current) {
        const dx = e.clientX - lastPan.current.x
        const dy = e.clientY - lastPan.current.y
        lastPan.current = { x: e.clientX, y: e.clientY }
        setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
      }

      if (draggingNode.current) {
        const { nodeId, startX, startY, originX, originY } = draggingNode.current
        const canvas = toCanvas(e.clientX, e.clientY)
        const nx = originX + (canvas.x - startX)
        const ny = originY + (canvas.y - startY)
        if (Math.abs(nx - originX) > 3 || Math.abs(ny - originY) > 3) didDrag.current = true
        moveNode(nodeId, nx, ny)
      }

      if (draggingJunction.current) {
        const { netId, junctionId, startX, startY, originX, originY } = draggingJunction.current
        const canvas = toCanvas(e.clientX, e.clientY)
        moveJunction(netId, junctionId, originX + (canvas.x - startX), originY + (canvas.y - startY))
      }

      if (pending) {
        const rect = svgRef.current!.getBoundingClientRect()
        setPending((p) => p && { ...p, mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top })
      }
    },
    [pending, toCanvas, moveNode, moveJunction],
  )

  const onSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      isPanning.current = false
      draggingNode.current = null
      draggingJunction.current = null

      if (!didDrag.current && nodeToToggle.current) {
        const id = nodeToToggle.current
        const node = nodes.find((n) => n.id === id)
        if (node?.type === 'const/bool') {
          const next = !node.properties.value
          patchNode(id, { label: String(next), properties: { value: next } })
        }
      }
      didDrag.current = false
      nodeToToggle.current = null

      if (pending) {
        const rect = svgRef.current!.getBoundingClientRect()
        const { x: cx, y: cy } = toCanvas(e.clientX - rect.left, e.clientY - rect.top)

        // Check junctions first (higher priority)
        for (const net of nets) {
          for (const j of net.junctions) {
            if (Math.hypot(cx - j.x, cy - j.y) < 8) {
              const portRef = { nodeId: pending.fromNodeId, portId: pending.fromPortId }
              updateNet(net.id, (n) => ({
                ...n,
                portRefs: [...n.portRefs, portRef],
                segments: [
                  ...n.segments,
                  { id: uid(), from: { kind: 'port' as const, ...portRef }, to: { kind: 'junction' as const, junctionId: j.id } },
                ],
              }))
              setPending(null)
              return
            }
          }
        }

        // Check segments (straight-line approximation for hit-testing)
        for (const net of nets) {
          for (const seg of net.segments) {
            const from = resolveEndpoint(net, seg.from)
            const to = resolveEndpoint(net, seg.to)
            if (!from || !to) continue
            if (distToSeg(cx, cy, from.x, from.y, to.x, to.y) < 6) {
              const jPos = closestPointOnSeg(cx, cy, from.x, from.y, to.x, to.y)
              const junctionId = uid()
              const portRef = { nodeId: pending.fromNodeId, portId: pending.fromPortId }
              updateNet(net.id, (n) => ({
                ...n,
                portRefs: [...n.portRefs, portRef],
                junctions: [...n.junctions, { id: junctionId, x: jPos.x, y: jPos.y }],
                segments: [
                  ...n.segments.filter((s) => s.id !== seg.id),
                  { id: uid(), from: seg.from, to: { kind: 'junction' as const, junctionId } },
                  { id: uid(), from: { kind: 'junction' as const, junctionId }, to: seg.to },
                  { id: uid(), from: { kind: 'port' as const, ...portRef }, to: { kind: 'junction' as const, junctionId } },
                ],
              }))
              setPending(null)
              return
            }
          }
        }
      }

      setPending(null)
    },
    [nodes, nets, patchNode, toCanvas, pending, updateNet],
  )

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const rect = svgRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    setTransform((t) => ({
      scale: Math.min(4, Math.max(0.2, t.scale * factor)),
      x: cx - (cx - t.x) * factor,
      y: cy - (cy - t.y) * factor,
    }))
  }, [])

  const onContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault()
      const rect = svgRef.current!.getBoundingClientRect()
      const pos = toCanvas(e.clientX - rect.left, e.clientY - rect.top)
      setContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: pos.x, canvasY: pos.y })
    },
    [toCanvas],
  )

  const onNodeTypeSelect = useCallback(
    (type: string) => {
      if (!contextMenu) return
      const entry = nodeRegistry[type]
      if (!entry) return
      addNode(entry.factory(uid(), contextMenu.canvasX - 50, contextMenu.canvasY - 20))
    },
    [contextMenu, addNode],
  )

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation()
      const node = nodes.find((n) => n.id === nodeId)!

      if (e.detail >= 2 && node.type.startsWith('const/') && node.type !== 'const/bool') {
        setEditingConst({
          nodeId,
          value: String(node.properties.value ?? ''),
          screenX: e.clientX,
          screenY: e.clientY,
        })
        return
      }

      const rect = svgRef.current!.getBoundingClientRect()
      const canvas = toCanvas(e.clientX - rect.left, e.clientY - rect.top)
      draggingNode.current = { nodeId, startX: canvas.x, startY: canvas.y, originX: node.x, originY: node.y }
      didDrag.current = false
      if (node.type === 'const/bool') nodeToToggle.current = nodeId
      svgRef.current!.setPointerCapture(e.pointerId)
    },
    [nodes, toCanvas, setEditingConst],
  )

  const commitConstEdit = useCallback(() => {
    if (!editingConst) return
    const { nodeId, value } = editingConst
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) { setEditingConst(null); return }
    if (node.type === 'const/number') {
      const num = parseFloat(value)
      const v = isNaN(num) ? 0 : num
      patchNode(nodeId, { label: String(v), properties: { value: v } })
    } else {
      patchNode(nodeId, { label: `"${value}"`, properties: { value } })
    }
    setEditingConst(null)
  }, [editingConst, nodes, patchNode])

  const onJunctionPointerDown = useCallback(
    (e: React.PointerEvent, netId: string, junctionId: string, jx: number, jy: number) => {
      e.stopPropagation()
      if (pending) return
      const rect = svgRef.current!.getBoundingClientRect()
      const canvas = toCanvas(e.clientX - rect.left, e.clientY - rect.top)
      draggingJunction.current = { netId, junctionId, startX: canvas.x, startY: canvas.y, originX: jx, originY: jy }
      svgRef.current!.setPointerCapture(e.pointerId)
    },
    [pending, toCanvas],
  )

  const onPortPointerDown = useCallback((e: React.PointerEvent, port: Port, nodeId: string) => {
    e.stopPropagation()
    const rect = svgRef.current!.getBoundingClientRect()
    setPending({
      fromNodeId: nodeId,
      fromPortId: port.id,
      fromSide: port.side,
      mouseX: e.clientX - rect.left,
      mouseY: e.clientY - rect.top,
    })
  }, [])

  const onPortPointerUp = useCallback(
    (e: React.PointerEvent, port: Port, nodeId: string) => {
      e.stopPropagation()
      if (!pending) return
      if (pending.fromNodeId === nodeId) return

      const portA = { nodeId: pending.fromNodeId, portId: pending.fromPortId }
      const portB = { nodeId, portId: port.id }
      const newSeg: Segment = {
        id: uid(),
        from: { kind: 'port', ...portA },
        to: { kind: 'port', ...portB },
      }

      const netA = nets.find((n) => n.portRefs.some((p) => p.nodeId === portA.nodeId && p.portId === portA.portId))
      const netB = nets.find((n) => n.portRefs.some((p) => p.nodeId === portB.nodeId && p.portId === portB.portId))

      if (!netA && !netB) {
        addNet({ id: uid(), portRefs: [portA, portB], junctions: [], segments: [newSeg] })
      } else if (netA && !netB) {
        updateNet(netA.id, (n) => ({ ...n, portRefs: [...n.portRefs, portB], segments: [...n.segments, newSeg] }))
      } else if (!netA && netB) {
        updateNet(netB.id, (n) => ({ ...n, portRefs: [...n.portRefs, portA], segments: [...n.segments, newSeg] }))
      } else if (netA && netB && netA.id !== netB.id) {
        mergeNets(netA.id, netB.id, newSeg)
      }
      // else: both ports already on the same net — skip

      setPending(null)
    },
    [pending, nets, addNet, updateNet, mergeNets],
  )

  function pendingWireEndpoints() {
    if (!pending) return null
    const node = nodes.find((n) => n.id === pending.fromNodeId)
    if (!node) return null
    const from = getPortPosition(node, pending.fromPortId)
    return {
      from: { x: from.x * transform.scale + transform.x, y: from.y * transform.scale + transform.y },
      to: { x: pending.mouseX, y: pending.mouseY },
    }
  }

  const pw = pendingWireEndpoints()

  return (
    <>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.screenX}
          y={contextMenu.screenY}
          onSelect={onNodeTypeSelect}
          onClose={() => setContextMenu(null)}
        />
      )}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: 'block', background: '#0a0f1a' }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
      >
        <defs>
          <pattern
            id="grid"
            width={20 * transform.scale}
            height={20 * transform.scale}
            patternUnits="userSpaceOnUse"
            x={transform.x % (20 * transform.scale)}
            y={transform.y % (20 * transform.scale)}
          >
            <path
              d={`M ${20 * transform.scale} 0 L 0 0 0 ${20 * transform.scale}`}
              fill="none"
              stroke="#1e293b"
              strokeWidth={0.5}
            />
          </pattern>
        </defs>
        <rect className="pan-target" width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Segments */}
          {nets.map((net) =>
            net.segments.map((seg) => {
              const ep = segmentEndpoints(net, seg)
              if (!ep) return null
              return (
                <WireElement
                  key={seg.id}
                  netId={net.id}
                  segId={seg.id}
                  x1={ep.from.x} y1={ep.from.y}
                  x2={ep.to.x} y2={ep.to.y}
                  onDoubleClick={removeSegment}
                />
              )
            }),
          )}

          {/* Junction dots */}
          {nets.flatMap((net) =>
            net.junctions.map((j) => (
              <circle
                key={j.id}
                cx={j.x} cy={j.y} r={5}
                fill="#475569"
                stroke="#64748b"
                strokeWidth={1}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => onJunctionPointerDown(e, net.id, j.id, j.x, j.y)}
              />
            )),
          )}

          {/* Nodes */}
          {nodes.map((node) =>
            node.type.startsWith('const/') ? (
              <ConstantNode
                key={node.id}
                node={node}
                onPointerDown={onNodePointerDown}
                onPortPointerDown={onPortPointerDown}
                onPortPointerUp={onPortPointerUp}
              />
            ) : (
              <NodeElement
                key={node.id}
                node={node}
                onPointerDown={onNodePointerDown}
                onPortPointerDown={onPortPointerDown}
                onPortPointerUp={onPortPointerUp}
              />
            ),
          )}
        </g>

        {pw && (
          <path
            d={
              pending?.fromSide === 'north' || pending?.fromSide === 'south'
                ? `M ${pw.from.x} ${pw.from.y} C ${pw.from.x} ${pw.from.y + 60}, ${pw.to.x} ${pw.to.y - 60}, ${pw.to.x} ${pw.to.y}`
                : `M ${pw.from.x} ${pw.from.y} C ${pw.from.x + 60} ${pw.from.y}, ${pw.to.x - 60} ${pw.to.y}, ${pw.to.x} ${pw.to.y}`
            }
            fill="none"
            stroke="#60a5fa"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>

      {editingConst && (
        <input
          autoFocus
          type={nodes.find((n) => n.id === editingConst.nodeId)?.type === 'const/number' ? 'number' : 'text'}
          value={editingConst.value}
          onChange={(e) => setEditingConst((s) => s && { ...s, value: e.target.value })}
          onBlur={commitConstEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitConstEdit()
            if (e.key === 'Escape') setEditingConst(null)
          }}
          style={{
            position: 'fixed',
            left: editingConst.screenX,
            top: editingConst.screenY,
            width: 120,
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 12,
            fontFamily: 'monospace',
            outline: 'none',
            zIndex: 100,
          }}
        />
      )}
    </>
  )
}
