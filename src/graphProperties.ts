import { LGraph, LGraphCanvas } from 'litegraph.js'

export type NodePanel = HTMLElement & {
  clear(): void
  addHTML(html: string, className?: string, onFooter?: boolean): HTMLElement
  addButton(label: string, callback: () => void): HTMLElement
  close(): void
}

export type LGraphCanvasExt = LGraphCanvas & {
  createPanel(title: string, options?: { closable?: boolean; width?: number }): NodePanel
}

export function showGraphPropertiesPanel(graph: LGraph, graphCanvas: LGraphCanvas) {
  const gc = graphCanvas as LGraphCanvasExt
  const canvas = gc.canvas

  const existing = canvas.parentNode?.querySelector('.graph-properties-panel')
  if (existing) {
    ;(existing as NodePanel).close()
    return
  }

  const config = graph.config as Record<string, unknown>

  const panel = gc.createPanel('Graph Properties', { closable: true, width: 340 })
  panel.classList.add('graph-properties-panel')

  function refresh() {
    panel.clear()

    if (Object.keys(config).length === 0) {
      panel.addHTML('<em style="opacity:0.5">No properties defined.</em>', 'property-row')
    }

    for (const [key, value] of Object.entries(config)) {
      const row = panel.addHTML(
        `<span class="name">${key}</span><input class="value" value="${value}" />`,
        'property-row',
      )
      const input = row.querySelector<HTMLInputElement>('.value')!
      input.addEventListener('change', () => {
        const original = config[key]
        config[key] = typeof original === 'number' ? Number(input.value) : input.value
      })
    }

    // Add new property
    const addRow = panel.addHTML(
      `<input class="new-key" placeholder="name" />
       <input class="new-value" placeholder="value" />`,
      'property-row',
    )
    addRow.querySelector<HTMLInputElement>('.new-key')!.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      const key = addRow.querySelector<HTMLInputElement>('.new-key')!.value.trim()
      const val = addRow.querySelector<HTMLInputElement>('.new-value')!.value
      if (!key || key in config) return
      config[key] = isNaN(Number(val)) ? val : Number(val)
      refresh()
    })
  }

  refresh()
  canvas.parentNode!.appendChild(panel)
}
