import type { Connection, Edge } from '@xyflow/react'
import { handleRole } from './handleRole'

// A node can't connect to itself - owner feedback, 2026-09-13. Passed as
// React Flow's own `isValidConnection` prop (called before a connection is
// even proposed) rather than filtering it out after the fact in onConnect.
// Kept in its own module (not alongside PipelineCanvas's component export)
// so oxlint's react-refresh rule doesn't flag mixing a component export
// with a plain function export in the same file.
//
// Also rejects target-to-target and source-to-source drags - found
// 2026-09-13 investigating "the connection fails and i need to try so many
// times": PipelineCanvas.tsx uses `connectionMode="loose"` so a drag can
// START from either a target or a source handle (needed so grabbing the
// "wrong" one by habit doesn't just silently do nothing - React Flow's
// default `strict` mode's failure mode), but two handles of the SAME role
// have no sensible resulting direction (there's no way to tell which one
// was "supposed" to be the source) - this must still be rejected, or
// addEdge() creates an edge whose sourceHandle doesn't match any of that
// node's actual source-typed handles and it silently never renders
// (error008, same failure class as the 2026-09-13 import bug, different
// cause). A mixed pair (one target, one source, in either drag direction)
// is fine and gets corrected to the right direction by
// src/utils/normalizeConnection.ts in ComposerPage.tsx's onConnect.
export function isValidConnection(connection: Connection | Edge): boolean {
  if (connection.source === connection.target) return false
  const sourceRole = handleRole(connection.sourceHandle)
  const targetRole = handleRole(connection.targetHandle)
  return !(sourceRole && targetRole && sourceRole === targetRole)
}
