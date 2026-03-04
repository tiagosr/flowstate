import { GraphNode } from '../types/graph'
import { makeAndGate, makeSignalIn, makeSignalOut } from './logic'
import { makeModuleInstance } from './module'

export interface NodeTypeEntry {
  label: string
  factory: (id: string, x: number, y: number) => GraphNode
}

// Keys are "category/type" — the slash is used to group into directories
export const nodeRegistry: Record<string, NodeTypeEntry> = {
  'logic/and':        { label: 'AND Gate',    factory: makeAndGate },
  'logic/signal-in':  { label: 'Wire In',     factory: makeSignalIn },
  'logic/signal-out': { label: 'Wire Out',    factory: makeSignalOut },
  'module/instance':  { label: 'Instance',    factory: makeModuleInstance },
}

/** Returns the registry grouped by category. */
export function groupedRegistry(): Record<string, Array<{ type: string } & NodeTypeEntry>> {
  const groups: Record<string, Array<{ type: string } & NodeTypeEntry>> = {}
  for (const [type, entry] of Object.entries(nodeRegistry)) {
    const category = type.split('/')[0]
    ;(groups[category] ??= []).push({ type, ...entry })
  }
  return groups
}
