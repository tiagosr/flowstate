import { useRef, useState, useCallback, useEffect } from 'react'
import { useGraphStore } from '../store/graphStore'
import { GraphNode, Net, Segment, SegEndpoint, Port, PortPosition } from '../types/graph'
import { NodeElement, getPortOffset, getNodeWidth, getNodeHeight } from './NodeElement'
import { ConstantNode } from './ConstantNode'
import { WireElement } from './Wire'
import { ContextMenu } from './ContextMenu'
import { nodeRegistry } from '../nodes/registry'

type SelectionItem =
  | { kind: 'node'; nodeId: string }
  | { kind: 'junction'; netId: string; junctionId: string }
  | { kind: 'segment'; netId: string; segId: string }

interface Transform { x: number; y: number; scale: number }

interface PendingWire {
  fromNodeId: string
  fromPortId: string
  fromSide: Port['side']
  mouseX: number
  mouseY: number
}

function uid() { return crypto.randomUUID() }

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

/** Liang-Barsky segment-rect intersection. */
function segmentIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  if (x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) return true
  if (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh) return true
  const dx = x2 - x1, dy = y2 - y1
  const p = [-dx, dx, -dy, dy]
  const q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1]
  let t0 = 0, t1 = 1
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false }
    else {
      const t = q[i] / p[i]
      if (p[i] < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
    }
    if (t0 > t1) return false
  }
  return true
}

function portSideTangent(side: Port['side']): { tx: number; ty: number } {
  switch (side) {
    case 'east':  return { tx:  1, ty:  0 }
    case 'west':  return { tx: -1, ty:  0 }
    case 'north': return { tx:  0, ty: -1 }
    case 'south': return { tx:  0, ty:  1 }
  }
}

function getEndpointTangent(
  ep: SegEndpoint,
  otherPos: { x: number; y: number },
  net: Net,
  nodes: GraphNode[],
): { tx: number; ty: number } {
  if (ep.kind === 'port') {
    const node = nodes.find((n) => n.id === ep.nodeId)
    const port = node?.ports.find((p) => p.id === ep.portId)
    return port ? portSideTangent(port.side) : { tx: 1, ty: 0 }
  }
  const j = net.junctions.find((j) => j.id === ep.junctionId)
  if (!j) return { tx: 1, ty: 0 }
  const dx = otherPos.x - j.x, dy = otherPos.y - j.y
  if (dx === 0 && dy === 0) return { tx: 1, ty: 0 }
  return Math.abs(dx) >= Math.abs(dy)
    ? { tx: dx > 0 ? 1 : -1, ty: 0 }
    : { tx: 0, ty: dy > 0 ? 1 : -1 }
}

export function SchematicCanvas() {
  const {
    nodes, nets, addNode, moveNode, moveJunction, addNet, updateNet, mergeNets,
    removeNode, removeSegment, removeJunction, patchNode,
  } = useGraphStore()

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [pending, setPending] = useState<PendingWire | null>(null)
  const [selection, setSelection] = useState<SelectionItem[]>([])
  const [dragSelectRect, setDragSelectRect] = useState<{
    x: number; y: number; w: number; h: number
  } | null>(null)
  const [spaceActive, setSpaceActive] = useState(false)
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
  const nodeToSelect = useRef<string | null>(null)
  const junctionToSelect = useRef<{ netId: string; junctionId: string } | null>(null)
  const spaceHeld = useRef(false)
  const isPanning = useRef(false)
  const panDidMove = useRef(false)
  const lastPan = useRef({ x: 0, y: 0 })
  const isDragSelecting = useRef(false)
  const dragSelectStart = useRef({ x: 0, y: 0 })
  const lastNodeClick = useRef<{ nodeId: string; time: number } | null>(null)

  // Spacebar → pan mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      e.preventDefault()
      spaceHeld.current = true
      setSpaceActive(true)
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      spaceHeld.current = false
      setSpaceActive(false)
      isPanning.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Delete / Backspace → remove selected items
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (editingConst) return
      if (selection.length === 0) return
      for (const item of selection) {
        if (item.kind === 'node') removeNode(item.nodeId)
        else if (item.kind === 'junction') removeJunction(item.netId, item.junctionId)
        else if (item.kind === 'segment') removeSegment(item.netId, item.segId)
      }
      setSelection([])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selection, editingConst, removeNode, removeJunction, removeSegment])

  const toCanvas = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - transform.x) / transform.scale,
      y: (sy - transform.y) / transform.scale,
    }),
    [transform],
  )

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

  const onSvgPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.target !== svgRef.current && !(e.target as Element).classList.contains('pan-target')) return
      const svgRect = svgRef.current!.getBoundingClientRect()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      if (spaceHeld.current) {
        isPanning.current = true
        panDidMove.current = false
        lastPan.current = { x: e.clientX, y: e.clientY }
      } else if (!pending) {
        isDragSelecting.current = true
        const { x, y } = toCanvas(e.clientX - svgRect.left, e.clientY - svgRect.top)
        dragSelectStart.current = { x, y }
        setDragSelectRect({ x, y, w: 0, h: 0 })
      }
    },
    [toCanvas, pending],
  )

  const onSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isPanning.current) {
        const dx = e.clientX - lastPan.current.x
        const dy = e.clientY - lastPan.current.y
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panDidMove.current = true
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
        const nx = originX + (canvas.x - startX)
        const ny = originY + (canvas.y - startY)
        if (Math.abs(nx - originX) > 3 || Math.abs(ny - originY) > 3) didDrag.current = true
        moveJunction(netId, junctionId, nx, ny)
      }

      if (isDragSelecting.current) {
        const svgRect = svgRef.current!.getBoundingClientRect()
        const { x, y } = toCanvas(e.clientX - svgRect.left, e.clientY - svgRect.top)
        const sx = dragSelectStart.current.x, sy = dragSelectStart.current.y
        setDragSelectRect({ x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) })
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
      const wasDraggingNode = draggingNode.current
      const wasDraggingJunction = draggingJunction.current
      draggingNode.current = null
      draggingJunction.current = null

      // Bool toggle on click
      if (!didDrag.current && nodeToToggle.current) {
        const id = nodeToToggle.current
        const node = nodes.find((n) => n.id === id)
        if (node?.type === 'const/bool') {
          const next = !node.properties.value
          patchNode(id, { label: String(next), properties: { value: next } })
        }
      }

      // Single-item selection on node/junction click
      if (!didDrag.current && wasDraggingNode && nodeToSelect.current) {
        setSelection([{ kind: 'node', nodeId: nodeToSelect.current }])
      } else if (!didDrag.current && wasDraggingJunction && junctionToSelect.current) {
        setSelection([{ kind: 'junction', ...junctionToSelect.current }])
      }

      didDrag.current = false
      nodeToToggle.current = null
      nodeToSelect.current = null
      junctionToSelect.current = null

      // Finalize drag selection
      if (isDragSelecting.current) {
        isDragSelecting.current = false
        setDragSelectRect(null)
        const svgRect = svgRef.current!.getBoundingClientRect()
        const { x: ex, y: ey } = toCanvas(e.clientX - svgRect.left, e.clientY - svgRect.top)
        const sx = dragSelectStart.current.x, sy = dragSelectStart.current.y
        const rx = Math.min(sx, ex), ry = Math.min(sy, ey)
        const rw = Math.abs(ex - sx), rh = Math.abs(ey - sy)

        if (rw < 3 && rh < 3) {
          setSelection([])
        } else {
          const newSel: SelectionItem[] = []
          for (const node of nodes) {
            const nw = getNodeWidth(node), nh = getNodeHeight(node)
            if (rx < node.x + nw && rx + rw > node.x && ry < node.y + nh && ry + rh > node.y)
              newSel.push({ kind: 'node', nodeId: node.id })
          }
          for (const net of nets) {
            for (const j of net.junctions) {
              if (j.x >= rx && j.x <= rx + rw && j.y >= ry && j.y <= ry + rh)
                newSel.push({ kind: 'junction', netId: net.id, junctionId: j.id })
            }
            for (const seg of net.segments) {
              const from = resolveEndpoint(net, seg.from)
              const to = resolveEndpoint(net, seg.to)
              if (!from || !to) continue
              if (segmentIntersectsRect(from.x, from.y, to.x, to.y, rx, ry, rw, rh))
                newSel.push({ kind: 'segment', netId: net.id, segId: seg.id })
            }
          }
          setSelection(newSel)
        }
        setPending(null)
        return
      }

      if (pending) {
        const rect = svgRef.current!.getBoundingClientRect()
        const { x: cx, y: cy } = toCanvas(e.clientX - rect.left, e.clientY - rect.top)

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

      const now = Date.now()
      const isDoubleClick =
        node.type.startsWith('const/') &&
        node.type !== 'const/bool' &&
        lastNodeClick.current?.nodeId === nodeId &&
        now - lastNodeClick.current.time < 400
      lastNodeClick.current = { nodeId, time: now }

      if (isDoubleClick) {
        setEditingConst({
          nodeId,
          value: String(node.properties.value ?? ''),
          screenX: e.clientX,
          screenY: e.clientY,
        })
        lastNodeClick.current = null
        return
      }

      const rect = svgRef.current!.getBoundingClientRect()
      const canvas = toCanvas(e.clientX - rect.left, e.clientY - rect.top)
      draggingNode.current = { nodeId, startX: canvas.x, startY: canvas.y, originX: node.x, originY: node.y }
      didDrag.current = false
      nodeToSelect.current = nodeId
      if (node.type === 'const/bool') nodeToToggle.current = nodeId
      svgRef.current!.setPointerCapture(e.pointerId)
    },
    [nodes, toCanvas],
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
      didDrag.current = false
      junctionToSelect.current = { netId, junctionId }
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

      setPending(null)
    },
    [pending, nets, addNet, updateNet, mergeNets],
  )

  const onSegmentClick = useCallback((netId: string, segId: string) => {
    setSelection((prev) => {
      const alreadySingle =
        prev.length === 1 && prev[0].kind === 'segment' && prev[0].netId === netId && prev[0].segId === segId
      return alreadySingle ? [] : [{ kind: 'segment', netId, segId }]
    })
  }, [])

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
        style={{ display: 'block', background: '#0a0f1a', cursor: spaceActive ? 'grab' : 'default' }}
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
              const t1 = getEndpointTangent(seg.from, ep.to, net, nodes)
              const t2 = getEndpointTangent(seg.to, ep.from, net, nodes)
              const segSelected = selection.some(
                (s) => s.kind === 'segment' && s.netId === net.id && s.segId === seg.id,
              )
              return (
                <WireElement
                  key={seg.id}
                  netId={net.id}
                  segId={seg.id}
                  x1={ep.from.x} y1={ep.from.y} tx1={t1.tx} ty1={t1.ty}
                  x2={ep.to.x} y2={ep.to.y} tx2={t2.tx} ty2={t2.ty}
                  selected={segSelected}
                  onClick={onSegmentClick}
                  onDoubleClick={removeSegment}
                />
              )
            }),
          )}

          {/* Junction dots */}
          {nets.flatMap((net) =>
            net.junctions.map((j) => {
              const jSelected = selection.some((s) => s.kind === 'junction' && s.junctionId === j.id)
              return (
                <circle
                  key={j.id}
                  cx={j.x} cy={j.y} r={5}
                  fill={jSelected ? '#60a5fa' : '#475569'}
                  stroke={jSelected ? '#93c5fd' : '#64748b'}
                  strokeWidth={1}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onJunctionPointerDown(e, net.id, j.id, j.x, j.y)}
                />
              )
            }),
          )}

          {/* Nodes */}
          {nodes.map((node) => {
            const nodeSelected = selection.some((s) => s.kind === 'node' && s.nodeId === node.id)
            return node.type.startsWith('const/') ? (
              <ConstantNode
                key={node.id}
                node={node}
                onPointerDown={onNodePointerDown}
                onPortPointerDown={onPortPointerDown}
                onPortPointerUp={onPortPointerUp}
                selected={nodeSelected}
              />
            ) : (
              <NodeElement
                key={node.id}
                node={node}
                onPointerDown={onNodePointerDown}
                onPortPointerDown={onPortPointerDown}
                onPortPointerUp={onPortPointerUp}
                selected={nodeSelected}
              />
            )
          })}

          {/* Drag selection rect */}
          {dragSelectRect && (
            <rect
              x={dragSelectRect.x}
              y={dragSelectRect.y}
              width={dragSelectRect.w}
              height={dragSelectRect.h}
              fill="rgba(96, 165, 250, 0.08)"
              stroke="#60a5fa"
              strokeWidth={1 / transform.scale}
              strokeDasharray={`${4 / transform.scale} ${3 / transform.scale}`}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>

        {pw && pending && (() => {
          const { tx, ty } = portSideTangent(pending.fromSide)
          const cx1 = pw.from.x + tx * 60
          const cy1 = pw.from.y + ty * 60
          const cx2 = pw.to.x - tx * 60
          const cy2 = pw.to.y - ty * 60
          return (
            <path
              d={`M ${pw.from.x} ${pw.from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pw.to.x} ${pw.to.y}`}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              style={{ pointerEvents: 'none' }}
            />
          )
        })()}
      </svg>

      {editingConst && (
        <>
          {/* Backdrop: clicking outside the input commits the edit */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onPointerDown={commitConstEdit}
          />
          <input
            autoFocus
            type={nodes.find((n) => n.id === editingConst.nodeId)?.type === 'const/number' ? 'number' : 'text'}
            value={editingConst.value}
            onChange={(e) => setEditingConst((s) => s && { ...s, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitConstEdit()
              if (e.key === 'Escape') setEditingConst(null)
            }}
            style={{
              position: 'fixed',
              left: editingConst.screenX,
              top: editingConst.screenY,
              width: 130,
              background: '#0f172a',
              color: '#e2e8f0',
              border: '2px solid #3b82f6',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: 13,
              fontFamily: 'monospace',
              outline: 'none',
              boxShadow: '0 0 0 3px rgba(59,130,246,0.25)',
              zIndex: 100,
            }}
          />
        </>
      )}
    </>
  )
}
