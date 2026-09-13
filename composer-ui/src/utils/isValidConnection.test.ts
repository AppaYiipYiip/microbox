import { describe, it, expect } from 'vitest'
import { isValidConnection } from './isValidConnection'

// Owner feedback, 2026-09-13: "make sure a node cant connect to itself."
describe('isValidConnection', () => {
  it('rejects a connection where source and target are the same node', () => {
    expect(isValidConnection({ source: 'n1', target: 'n1', sourceHandle: 'right', targetHandle: 'left' })).toBe(false)
  })

  it('accepts a connection between two different nodes', () => {
    expect(isValidConnection({ source: 'n1', target: 'n2', sourceHandle: 'right', targetHandle: 'left' })).toBe(true)
  })

  // Regression coverage for a real bug found 2026-09-13 ("the connection
  // fails and i need to try so many times"): PipelineCanvas.tsx's loose
  // connectionMode lets a drag start from either handle role, but two
  // handles of the SAME role have no sensible resulting direction and must
  // still be rejected - otherwise addEdge() creates an edge that silently
  // never renders (its sourceHandle wouldn't match any real source-typed
  // handle on that node).
  it('rejects a target-to-target connection', () => {
    expect(isValidConnection({ source: 'n1', target: 'n2', sourceHandle: 'top', targetHandle: 'left' })).toBe(false)
  })

  it('rejects a source-to-source connection', () => {
    expect(isValidConnection({ source: 'n1', target: 'n2', sourceHandle: 'right', targetHandle: 'bottom' })).toBe(false)
  })

  it('accepts a mixed pair dragged in the reverse direction (started at the target handle)', () => {
    expect(isValidConnection({ source: 'n1', target: 'n2', sourceHandle: 'top', targetHandle: 'right' })).toBe(true)
  })

  it('accepts a connection with no handle info (older export, role unknown)', () => {
    expect(isValidConnection({ source: 'n1', target: 'n2', sourceHandle: null, targetHandle: null })).toBe(true)
  })
})
