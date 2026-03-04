import { GraphNode } from '../types/graph'

export function makeNumberConst(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'const/number',
    label: '0',
    x,
    y,
    properties: { value: 0 },
    ports: [{ id: `${id}-out`, name: 'out', side: 'east', type: 'number' }],
  }
}

export function makeBoolConst(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'const/bool',
    label: 'false',
    x,
    y,
    properties: { value: false },
    ports: [{ id: `${id}-out`, name: 'out', side: 'east', type: 'bool' }],
  }
}

export function makeStringConst(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'const/string',
    label: '""',
    x,
    y,
    properties: { value: '' },
    ports: [{ id: `${id}-out`, name: 'out', side: 'east', type: 'string' }],
  }
}
