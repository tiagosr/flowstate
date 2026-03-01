import 'litegraph.js/css/litegraph.css'
import './style.css'
import { LGraph, LGraphCanvas } from 'litegraph.js'
import { setupLogicNodes } from './nodes/logic'
import { showGraphPropertiesPanel } from './graphProperties'

const canvas = document.createElement('canvas')
canvas.id = 'graph-canvas'
document.body.appendChild(canvas)

const graph = new LGraph()
const graphCanvas = new LGraphCanvas('#graph-canvas', graph)

window.addEventListener('keydown', (e) => {
  if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    showGraphPropertiesPanel(graph, graphCanvas)
  }
})

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  graphCanvas.resize()
}
setupLogicNodes();

resizeCanvas()
window.addEventListener('resize', resizeCanvas)
graph.start()

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
