import { describe, it, expect } from 'vitest'
import { Position } from '@xyflow/react'
import { defaultNodeHandles } from './nodeDefaults'

describe('defaultNodeHandles', () => {
  it('returns exactly the 4 sides ToolNode.tsx renders, target on top/left and source on right/bottom', () => {
    const handles = defaultNodeHandles(180, 68)
    expect(handles).toHaveLength(4)

    const byId = Object.fromEntries(handles.map((h) => [h.id, h]))
    expect(byId.top).toMatchObject({ type: 'target', position: Position.Top })
    expect(byId.left).toMatchObject({ type: 'target', position: Position.Left })
    expect(byId.right).toMatchObject({ type: 'source', position: Position.Right })
    expect(byId.bottom).toMatchObject({ type: 'source', position: Position.Bottom })
  })

  it('positions handles relative to the given width/height, not a hardcoded size', () => {
    const small = defaultNodeHandles(100, 50)
    const large = defaultNodeHandles(200, 100)
    // The right/bottom handles should sit further from the origin on a
    // bigger node - a hardcoded-size regression would make these equal.
    expect(large.find((h) => h.id === 'right')!.x).toBeGreaterThan(small.find((h) => h.id === 'right')!.x)
    expect(large.find((h) => h.id === 'bottom')!.y).toBeGreaterThan(small.find((h) => h.id === 'bottom')!.y)
  })
})
