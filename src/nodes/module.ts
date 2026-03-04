import { GraphNode } from '../types/graph'

export function makeModuleInstance(id: string, x: number, y: number, instanceName = 'Unnamed'): GraphNode {
  return {
    id,
    type: 'module/instance',
    label: instanceName,
    x,
    y,
    properties: { instanceName },
    ports: [],
  }
}
