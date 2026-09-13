import { describe, it, expect } from 'vitest'
import { normalizeConnection } from './normalizeConnection'

// Regression coverage for a real bug found 2026-09-13 ("the connection
// fails and i need to try so many times"): PipelineCanvas.tsx's loose
// connectionMode lets a drag start from either a target or a source handle,
// so a "reverse" drag (started at the target end) comes back from React
// Flow with source/target swapped relative to our fixed top/left=target,
// right/bottom=source roles - this must be put back or the resulting edge
// never renders (its sourceHandle wouldn't match any of that node's actual
// source-typed handles).
describe('normalizeConnection', () => {
  it('leaves an already-correct connection (source handle is right/bottom) unchanged', () => {
    const connection = { source: 'n1', sourceHandle: 'right', target: 'n2', targetHandle: 'left' }
    expect(normalizeConnection(connection)).toEqual(connection)
  })

  it('swaps a reversed connection (drag started at a target handle) back to the fixed direction', () => {
    // User dragged FROM n1's "top" (a target handle) TO n2's "right" (a
    // source handle). Because the drag started at a target handle, React
    // Flow's own loose-mode connection construction reports n1's "top" as
    // the SOURCE handle and n2's "right" as the target - backwards relative
    // to our fixed roles. This is exactly the case normalizeConnection
    // detects (sourceHandle is a target-role id) and corrects.
    const reversed = { source: 'n1', sourceHandle: 'top', target: 'n2', targetHandle: 'right' }
    expect(normalizeConnection(reversed)).toEqual({ source: 'n2', sourceHandle: 'right', target: 'n1', targetHandle: 'top' })
  })

  it('leaves a connection with no handle info (older export) unchanged', () => {
    const connection = { source: 'n1', sourceHandle: null, target: 'n2', targetHandle: null }
    expect(normalizeConnection(connection)).toEqual(connection)
  })
})
