import { describe, it, expect } from 'vitest'
import { toggleNodeEnabled } from './toggleNodeEnabled'
import type { ToolNodeType } from '../components/ToolNode'

describe('toggleNodeEnabled', () => {
  it('disables a node that has never had `enabled` set (defaults to enabled)', () => {
    const nodes: ToolNodeType[] = [{ id: 'a', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {} } }]
    const result = toggleNodeEnabled(nodes, 'a')
    expect(result[0].data.enabled).toBe(false)
  })

  it('disables a node explicitly marked enabled', () => {
    const nodes: ToolNodeType[] = [{ id: 'a', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {}, enabled: true } }]
    expect(toggleNodeEnabled(nodes, 'a')[0].data.enabled).toBe(false)
  })

  it('re-enables a disabled node', () => {
    const nodes: ToolNodeType[] = [{ id: 'a', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {}, enabled: false } }]
    expect(toggleNodeEnabled(nodes, 'a')[0].data.enabled).toBe(true)
  })

  it('does not touch other nodes', () => {
    const nodes: ToolNodeType[] = [
      { id: 'a', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {} } },
      { id: 'b', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'kraken2', params: {}, enabled: true } },
    ]
    const result = toggleNodeEnabled(nodes, 'a')
    expect(result[1]).toBe(nodes[1])
  })

  it('is a no-op when the node id does not exist', () => {
    const nodes: ToolNodeType[] = [{ id: 'a', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {} } }]
    expect(toggleNodeEnabled(nodes, 'missing').map((n) => n.data.enabled)).toEqual([undefined])
  })
})
