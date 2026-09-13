import { describe, it, expect } from 'vitest'
import { updateNodeParam } from './updateNodeParam'
import type { ToolNodeType } from '../components/ToolNode'

const nodes: ToolNodeType[] = [
  { id: 'a', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'kraken2', params: {} } },
  { id: 'b', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'kraken2', params: { kraken2_db: '/old' } } },
]

describe('updateNodeParam', () => {
  it('sets a new param on the target node without touching other nodes', () => {
    const result = updateNodeParam(nodes, 'a', 'kraken2_db', '/data/kraken2-db')
    expect(result.find((n) => n.id === 'a')?.data.params).toEqual({ kraken2_db: '/data/kraken2-db' })
    expect(result.find((n) => n.id === 'b')?.data.params).toEqual({ kraken2_db: '/old' })
  })

  it('overwrites an existing param value on the target node, preserving other params', () => {
    const result = updateNodeParam(nodes, 'b', 'kraken2_db', '/new')
    expect(result.find((n) => n.id === 'b')?.data.params).toEqual({ kraken2_db: '/new' })
  })

  it('is a no-op (returns an equal-shaped array) when the node id does not exist', () => {
    const result = updateNodeParam(nodes, 'does-not-exist', 'kraken2_db', '/x')
    expect(result.map((n) => n.data.params)).toEqual(nodes.map((n) => n.data.params))
  })
})
