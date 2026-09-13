import { describe, it, expect } from 'vitest'
import { parseCanvasSnapshot } from './importCanvasSnapshot'
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../data/nodeDefaults'

function validSnapshotJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    formatVersion: 1,
    savedAt: '2026-09-13T00:00:00.000Z',
    nodes: [
      { id: 'node-1', type: 'tool', position: { x: 10, y: 20 }, width: 200, height: 80, data: { toolId: 'fastp', params: {}, enabled: true } },
      { id: 'node-2', type: 'tool', position: { x: 30, y: 40 }, data: { toolId: 'bowtie2', params: { host_fasta: '/data/host.fa' }, enabled: false } },
    ],
    edges: [{ id: 'xy-edge__node-1right-node-2left', source: 'node-1', target: 'node-2', sourceHandle: 'right', targetHandle: 'left' }],
    ...overrides,
  })
}

describe('parseCanvasSnapshot', () => {
  it('imports a valid snapshot, preserving position/size/params/enabled and remapping ids', () => {
    const result = parseCanvasSnapshot(validSnapshotJson())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.nodes).toHaveLength(2)
    const fastpNode = result.nodes.find((n) => n.data.toolId === 'fastp')!
    expect(fastpNode.position).toEqual({ x: 10, y: 20 })
    expect(fastpNode.width).toBe(200)
    expect(fastpNode.height).toBe(80)
    expect(fastpNode.data.enabled).toBe(true)

    const bowtie2Node = result.nodes.find((n) => n.data.toolId === 'bowtie2')!
    // Ids are remapped via the same counter for every node, never reused
    // verbatim from the file (avoids collisions with a running session's
    // own counter) - the property that actually matters is that two
    // different imported nodes never collide with each other, not that a
    // remapped id happens to differ from its own original string (which a
    // freshly-reset counter could coincidentally reproduce).
    expect(fastpNode.id).not.toBe(bowtie2Node.id)
    expect(bowtie2Node.data.params).toEqual({ host_fasta: '/data/host.fa' })
    expect(bowtie2Node.data.enabled).toBe(false)
    // No width/height in the file for this one - falls back to the shared
    // defaults, same ones PipelineCanvas.tsx gives a freshly dropped node.
    expect(bowtie2Node.width).toBe(DEFAULT_NODE_WIDTH)
    expect(bowtie2Node.height).toBe(DEFAULT_NODE_HEIGHT)

    expect(result.edges).toHaveLength(1)
    const edge = result.edges[0]
    expect(edge.source).toBe(fastpNode.id)
    expect(edge.target).toBe(bowtie2Node.id)
    expect(edge.sourceHandle).toBe('right')
    expect(edge.targetHandle).toBe('left')
    expect(edge.type).toBe('deletable')
  })

  it('defaults enabled to true and params to {} when the file omits them', () => {
    const json = JSON.stringify({
      formatVersion: 1,
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { toolId: 'fastqc' } }],
      edges: [],
    })
    const result = parseCanvasSnapshot(json)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.nodes[0].data.enabled).toBe(true)
    expect(result.nodes[0].data.params).toEqual({})
  })

  it('falls back to the default handle (React Flow behavior) when sourceHandle/targetHandle are absent - an older export', () => {
    const json = validSnapshotJson({
      edges: [{ id: 'e1', source: 'node-1', target: 'node-2' }],
    })
    const result = parseCanvasSnapshot(json)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // addEdge() (the same utility onConnect uses) deletes a null handle
    // rather than keeping the key - both mean the same "use whichever
    // handle React Flow finds first" fallback to the node.
    expect(result.edges[0].sourceHandle).toBeUndefined()
    expect(result.edges[0].targetHandle).toBeUndefined()
  })

  it('rejects text that is not valid JSON', () => {
    expect(parseCanvasSnapshot('not json{')).toEqual({ ok: false, error: 'invalid-json' })
  })

  it('rejects a file with the wrong formatVersion', () => {
    const result = parseCanvasSnapshot(validSnapshotJson({ formatVersion: 2 }))
    expect(result).toEqual({ ok: false, error: 'unsupported-version' })
  })

  it('rejects a file referencing a tool id that does not exist in the catalog', () => {
    const json = JSON.stringify({
      formatVersion: 1,
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { toolId: 'not-a-real-tool' } }],
      edges: [],
    })
    expect(parseCanvasSnapshot(json)).toEqual({ ok: false, error: 'unknown-tool' })
  })

  it('rejects a node missing a numeric position', () => {
    const json = JSON.stringify({
      formatVersion: 1,
      nodes: [{ id: 'a', position: { x: 'oops', y: 0 }, data: { toolId: 'fastp' } }],
      edges: [],
    })
    expect(parseCanvasSnapshot(json)).toEqual({ ok: false, error: 'malformed' })
  })

  it('rejects an edge referencing a node id that is not in the file', () => {
    const json = validSnapshotJson({ edges: [{ id: 'e1', source: 'node-1', target: 'does-not-exist' }] })
    expect(parseCanvasSnapshot(json)).toEqual({ ok: false, error: 'malformed' })
  })

  it('rejects a top-level value that is not an object', () => {
    expect(parseCanvasSnapshot('42')).toEqual({ ok: false, error: 'malformed' })
  })
})
