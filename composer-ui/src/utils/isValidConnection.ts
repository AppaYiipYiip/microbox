import type { Connection, Edge } from '@xyflow/react'

// A node can't connect to itself - owner feedback, 2026-09-13. Passed as
// React Flow's own `isValidConnection` prop (called before a connection is
// even proposed) rather than filtering it out after the fact in onConnect.
// Kept in its own module (not alongside PipelineCanvas's component export)
// so oxlint's react-refresh rule doesn't flag mixing a component export
// with a plain function export in the same file.
export function isValidConnection(connection: Connection | Edge): boolean {
  return connection.source !== connection.target
}
