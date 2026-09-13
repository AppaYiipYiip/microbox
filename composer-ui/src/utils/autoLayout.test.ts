import { describe, it, expect } from 'vitest'
import { computeAutoLayout } from './autoLayout'
import type { ToolNodeType } from '../components/ToolNode'
import type { Edge } from '@xyflow/react'

function node(id: string): ToolNodeType {
  return { id, type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {} } }
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target }
}

describe('computeAutoLayout', () => {
  it('lays out a linear chain in increasing columns', () => {
    const nodes = [node('a'), node('b'), node('c')]
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]
    const positions = computeAutoLayout(nodes, edges)
    expect(positions.a.x).toBeLessThan(positions.b.x)
    expect(positions.b.x).toBeLessThan(positions.c.x)
  })

  it('places a node fed by two branches after the DEEPER of its two ancestors (longest path)', () => {
    // a -> b -> c
    // a -------> c   (c also depends directly on a)
    const nodes = [node('a'), node('b'), node('c')]
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'a', 'c')]
    const positions = computeAutoLayout(nodes, edges)
    // c must land strictly after b, not merely after a, since b->c is the
    // longer of c's two incoming paths.
    expect(positions.c.x).toBeGreaterThan(positions.b.x)
  })

  it('gives every node with no incoming edges the same, first column', () => {
    const nodes = [node('a'), node('b')]
    const positions = computeAutoLayout(nodes, [])
    expect(positions.a.x).toBe(positions.b.x)
    // Distinct rows so they don't render on top of each other.
    expect(positions.a.y).not.toBe(positions.b.y)
  })

  it('does not infinite-loop on a cycle - falls back to placing unresolved nodes in the first column', () => {
    const nodes = [node('a'), node('b')]
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]
    const positions = computeAutoLayout(nodes, edges)
    expect(positions.a).toBeDefined()
    expect(positions.b).toBeDefined()
  })

  it('ignores an edge referencing a node id that is not in the current node list', () => {
    const nodes = [node('a')]
    const edges = [edge('e1', 'a', 'does-not-exist')]
    const positions = computeAutoLayout(nodes, edges)
    expect(positions.a).toEqual({ x: 0, y: 0 })
  })

  it('returns an empty layout for an empty canvas', () => {
    expect(computeAutoLayout([], [])).toEqual({})
  })
})
