import { useRef, useState, useCallback } from 'react'
import { useGraphStore } from '../store/graphStore'
import { GraphNode, Port, Wire, PortPosition } from '../types/graph'
import { NodeElement, getPortOffset } from './NodeElement'
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

export function SchematicCanvas() {
  const { nodes, wires, addNode, moveNode, addWire, removeWire } = useGraphStore()
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [pending, setPending] = useState<PendingWire | null>(null)
  const [contextMenu, setContextMenu] = useState<{ screenX: number; screenY: number; canvasX: number; canvasY: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingNode = useRef<{ nodeId: string; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const isPanning = useRef(false)
  const lastPan = useRef({ x: 0, y: 0 })

  const toCanvas = useCallback((sx: number, sy: number) => ({
    x: (sx - transform.x) / transform.scale,
    y: (sy - transform.y) / transform.scale,
  }), [transform])

  const onSvgPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.target !== svgRef.current && !(e.target as Element).classList.contains('pan-target')) return
    isPanning.current = true
    lastPan.current = { x: e.clientX, y: e.clientY }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }, [])

  const onSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPan.current.x
      const dy = e.clientY - lastPan.current.y
      lastPan.current = { x: e.clientX, y: e.clientY }
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
    }

    if (draggingNode.current) {
      const { nodeId, startX, startY, originX, originY } = draggingNode.current
      const canvas = toCanvas(e.clientX, e.clientY)
      moveNode(nodeId, originX + (canvas.x - startX), originY + (canvas.y - startY))
    }

    if (pending) {
      const rect = svgRef.current!.getBoundingClientRect()
      setPending((p) => p && { ...p, mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top })
    }
  }, [pending, toCanvas, moveNode])

  const onSvgPointerUp = useCallback(() => {
    isPanning.current = false
    draggingNode.current = null
    setPending(null)
  }, [])

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

  const onContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault()
    const rect = svgRef.current!.getBoundingClientRect()
    const pos = toCanvas(e.clientX - rect.left, e.clientY - rect.top)
    setContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: pos.x, canvasY: pos.y })
  }, [toCanvas])

  const onNodeTypeSelect = useCallback((type: string) => {
    if (!contextMenu) return
    const entry = nodeRegistry[type]
    if (!entry) return
    addNode(entry.factory(uid(), contextMenu.canvasX - 50, contextMenu.canvasY - 20))
  }, [contextMenu, addNode])

  const onNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation()
    const rect = svgRef.current!.getBoundingClientRect()
    const canvas = toCanvas(e.clientX - rect.left, e.clientY - rect.top)
    const node = nodes.find((n) => n.id === nodeId)!
    draggingNode.current = { nodeId, startX: canvas.x, startY: canvas.y, originX: node.x, originY: node.y }
    svgRef.current!.setPointerCapture(e.pointerId)
  }, [nodes, toCanvas])

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

  const onPortPointerUp = useCallback((e: React.PointerEvent, port: Port, nodeId: string) => {
    e.stopPropagation()
    if (!pending) return
    if (pending.fromNodeId === nodeId) return

    addWire({ id: uid(), fromNodeId: pending.fromNodeId, fromPortId: pending.fromPortId, toNodeId: nodeId, toPortId: port.id })
    setPending(null)
  }, [pending, addWire])

  function wireEndpoints(wire: Wire) {
    const fromNode = nodes.find((n) => n.id === wire.fromNodeId)
    const toNode = nodes.find((n) => n.id === wire.toNodeId)
    if (!fromNode || !toNode) return null
    return {
      from: getPortPosition(fromNode, wire.fromPortId),
      to: getPortPosition(toNode, wire.toPortId),
    }
  }

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
        <pattern id="grid" width={20 * transform.scale} height={20 * transform.scale} patternUnits="userSpaceOnUse" x={transform.x % (20 * transform.scale)} y={transform.y % (20 * transform.scale)}>
          <path d={`M ${20 * transform.scale} 0 L 0 0 0 ${20 * transform.scale}`} fill="none" stroke="#1e293b" strokeWidth={0.5} />
        </pattern>
      </defs>
      <rect className="pan-target" width="100%" height="100%" fill="url(#grid)" />

      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
        {wires.map((wire) => {
          const ep = wireEndpoints(wire)
          if (!ep) return null
          return (
            <WireElement
              key={wire.id}
              id={wire.id}
              x1={ep.from.x} y1={ep.from.y}
              x2={ep.to.x} y2={ep.to.y}
              onDoubleClick={removeWire}
            />
          )
        })}

        {nodes.map((node) => (
          <NodeElement
            key={node.id}
            node={node}
            onPointerDown={onNodePointerDown}
            onPortPointerDown={onPortPointerDown}
            onPortPointerUp={onPortPointerUp}
          />
        ))}
      </g>

      {pw && (
        <path
          d={pending?.fromSide === 'north' || pending?.fromSide === 'south'
            ? `M ${pw.from.x} ${pw.from.y} C ${pw.from.x} ${pw.from.y + 60}, ${pw.to.x} ${pw.to.y - 60}, ${pw.to.x} ${pw.to.y}`
            : `M ${pw.from.x} ${pw.from.y} C ${pw.from.x + 60} ${pw.from.y}, ${pw.to.x - 60} ${pw.to.y}, ${pw.to.x} ${pw.to.y}`}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
    </>
  )
}
