import { LiteGraph, LGraphCanvas, LGraphNode } from 'litegraph.js'
import { type NodePanel, type LGraphCanvasExt } from '../graphProperties'

class AndGate extends LGraphNode {
  static title = 'AND'
  static desc = 'Logic AND gate'

  properties: { bits: number; label: string }

  constructor() {
    super();
    this.addInput('a', 'bit')
    this.addInput('b', 'bit')
    this.addOutput('out', 'bit')
    this.properties = { bits: 1, label: 'AND' }
  }

  onExecute() {
    const a = this.getInputData(0)
    const b = this.getInputData(1)
    this.setOutputData(0, a & b)
  }

  onDblClick(_e: MouseEvent, _pos: [number, number], graphCanvas: LGraphCanvas) {
    showNodePanel(this, graphCanvas)
  }
}


function showNodePanel(node: LGraphNode & { properties: Record<string, unknown> }, graphCanvas: LGraphCanvas) {
  const gc = graphCanvas as LGraphCanvasExt
  const canvas = gc.canvas
  const existing = canvas.parentNode?.querySelector('.node-properties-panel')
  if (existing) (existing as NodePanel).close()

  const panel = gc.createPanel('Node Properties', { closable: true, width: 300 })

  panel.classList.add('node-properties-panel')

  function refresh() {
    panel.clear()

    for (const [key, value] of Object.entries(node.properties)) {
      const row = panel.addHTML(
        `<span class="name">${key}</span>
         <input class="value" value="${value}" />`,
        'property-row',
      )

      const input = row.querySelector<HTMLInputElement>('.value')!
      input.addEventListener('change', () => {
        // Coerce back to original type
        const original = node.properties[key]
        node.properties[key] = typeof original === 'number' ? Number(input.value) : input.value
        graphCanvas.setDirty(true, true)
      })
    }
  }

  panel.addButton('Close', () => panel.close())

  refresh()
  canvas.parentNode!.appendChild(panel)
}


export function setupLogicNodes() {
    LiteGraph.registerNodeType('hdl/and', AndGate)
}
