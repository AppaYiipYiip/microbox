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
})
