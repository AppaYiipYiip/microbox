import type { Edge } from '@xyflow/react'
import type { ToolNodeType } from '../components/ToolNode'

const COLUMN_WIDTH = 260
const ROW_HEIGHT = 120

// Computes a simple left-to-right layered layout - PLAN.md §6.16's canvas
// nice-to-have "auto-layout/auto-arrange." Deliberately hand-rolled instead
// of pulling in a graph-layout library (dagre/elkjs): this toolbox is
// bounded to ~20 nodes (PLAN.md §6.7/§6.10's own framing), and a real
// dependency decision (which library, its bundle-size cost, one more thing
// to keep updated) isn't worth it for a layout this simple. Each node gets
// a "layer" - how many hops it is from a root, via the LONGEST path so a
// node fed by two different-depth branches lands after both, never
// overlapping a predecessor - and layers stack left to right.
//
// A node with no incoming edges is layer 0 - not an error case. Every
// reads-stage in the real pipeline is independently skippable
// (workflows/microbox.nf), so a rootless node is a normal, valid starting
// point on this canvas, not evidence of a malformed graph.
//
// The composer doesn't forbid drawing a cycle, even though
// src/utils/validatePipeline.ts already separately flags it as something
// the real pipeline can't execute - a cycle can't be topologically
// layered by definition. Any node still unresolved after every node whose
// predecessors are already placed has been processed is dropped into
// layer 0 alongside the real roots, rather than looping forever trying to
// resolve an ordering that doesn't exist.
export function computeAutoLayout(nodes: ToolNodeType[], edges: Edge[]): Record<string, { x: number; y: number }> {
  const nodeIds = nodes.map((n) => n.id)
  const incoming = new Map<string, string[]>(nodeIds.map((id) => [id, []]))
  for (const edge of edges) {
    if (incoming.has(edge.target) && incoming.has(edge.source)) {
      incoming.get(edge.target)!.push(edge.source)
    }
  }

  const layer = new Map<string, number>()
  const resolved = new Set<string>()
  let progressed = true
  while (progressed && resolved.size < nodeIds.length) {
    progressed = false
    for (const id of nodeIds) {
      if (resolved.has(id)) continue
      const preds = incoming.get(id)!
      if (preds.every((p) => resolved.has(p))) {
        const predLayer = preds.length === 0 ? -1 : Math.max(...preds.map((p) => layer.get(p)!))
        layer.set(id, predLayer + 1)
        resolved.add(id)
        progressed = true
      }
    }
  }
  for (const id of nodeIds) {
    if (!resolved.has(id)) layer.set(id, 0)
  }

  const byLayer = new Map<number, string[]>()
  for (const id of nodeIds) {
    const l = layer.get(id)!
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l)!.push(id)
  }

  const positions: Record<string, { x: number; y: number }> = {}
  for (const [l, ids] of byLayer) {
    ids.forEach((id, index) => {
      positions[id] = { x: l * COLUMN_WIDTH, y: index * ROW_HEIGHT }
    })
  }
  return positions
}
