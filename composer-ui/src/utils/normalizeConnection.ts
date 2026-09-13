import type { Connection } from '@xyflow/react'
import { handleRole } from './handleRole'

// Every node has exactly one fixed-role handle per id (HANDLE_SIDES in
// nodeDefaults.ts: right/bottom always source, top/left always target), but
// PipelineCanvas.tsx's `connectionMode="loose"` lets a drag START from
// EITHER end - needed so grabbing the "wrong" handle by habit doesn't just
// silently fail (React Flow's default `strict` mode's behavior, found
// 2026-09-13 investigating "the connection fails and i need to try so many
// times"). isValidConnection.ts already rejects a same-role pair (target-to-
// target/source-to-source - genuinely ambiguous, no fix possible), but a
// MIXED pair dragged in the "reverse" direction (started at the target
// handle, ended at the source handle) still comes back from React Flow with
// source/sourceHandle and target/targetHandle swapped relative to our fixed
// roles - which would otherwise silently fail to render (error008: no
// handle named "left" among that node's SOURCE-typed handles). This swaps
// the whole connection back to the correct fixed direction before it's
// added to state, regardless of which end the user actually grabbed first.
export function normalizeConnection(connection: Connection): Connection {
  if (handleRole(connection.sourceHandle) === 'target') {
    return {
      source: connection.target,
      sourceHandle: connection.targetHandle,
      target: connection.source,
      targetHandle: connection.sourceHandle,
    }
  }
  return connection
}
