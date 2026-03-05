import { GraphNode } from '../types/graph'

export function makeAndGate(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'logic/and',
    label: 'AND',
    x,
    y,
    properties: { bits: 1 },
    ports: [
      { id: `${id}-a`, name: 'a', side: 'west', type: 'bit' },
      { id: `${id}-b`, name: 'b', side: 'west', type: 'bit' },
      { id: `${id}-out`, name: 'out', side: 'east', type: 'bit' },
    ],
  }
}

export function makeOrGate(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'logic/or',
    label: 'OR',
    x,
    y,
    properties: { bits: 1 },
    ports: [
      { id: `${id}-a`, name: 'a', side: 'west', type: 'bit' },
      { id: `${id}-b`, name: 'b', side: 'west', type: 'bit' },
      { id: `${id}-out`, name: 'out', side: 'east', type: 'bit' },
    ],
  }
}

export function makeNandGate(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'logic/nand',
    label: 'NAND',
    x,
    y,
    properties: { bits: 1 },
    ports: [
      { id: `${id}-a`, name: 'a', side: 'west', type: 'bit' },
      { id: `${id}-b`, name: 'b', side: 'west', type: 'bit' },
      { id: `${id}-out`, name: 'out', side: 'east', type: 'bit' },
    ],
  }
}

export function makeNorGate(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'logic/nor',
    label: 'NOR',
    x,
    y,
    properties: { bits: 1 },
    ports: [
      { id: `${id}-a`, name: 'a', side: 'west', type: 'bit' },
      { id: `${id}-b`, name: 'b', side: 'west', type: 'bit' },
      { id: `${id}-out`, name: 'out', side: 'east', type: 'bit' },
    ],
  }
}

export function makeXorGate(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'logic/xor',
    label: 'XOR',
    x,
    y,
    properties: { bits: 1 },
    ports: [
      { id: `${id}-a`, name: 'a', side: 'west', type: 'bit' },
      { id: `${id}-b`, name: 'b', side: 'west', type: 'bit' },
      { id: `${id}-out`, name: 'out', side: 'east', type: 'bit' },
    ],
  }
}


export function makeSignalIn(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'logic/signal-in',
    label: 'Wire In',
    x,
    y,
    properties: { bits: 1 },
    ports: [
      { id: `${id}-domain`, name: 'domain', side: 'west', type: 'clock' },
      { id: `${id}-set`, name: 'set', side: 'west', type: 'bit' },
    ],
  }
}

export function makeSignalOut(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'logic/signal-out',
    label: 'Wire Out',
    x,
    y,
    properties: { bits: 1 },
    ports: [
      { id: `${id}-state`, name: 'state', side: 'east', type: 'bit' },
    ],
  }
}
