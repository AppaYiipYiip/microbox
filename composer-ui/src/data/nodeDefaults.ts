import { Position, type NodeHandle, type HandleType } from '@xyflow/react'

// Shared with src/components/PipelineCanvas.tsx (new nodes dropped from the
// palette) and src/utils/importCanvasSnapshot.ts (nodes reconstructed from an
// imported file that predates width/height being saved, or that omits them
// for any other reason) - kept in one place so the two can't silently drift.
export const DEFAULT_NODE_WIDTH = 180
export const DEFAULT_NODE_HEIGHT = 68

// The single source of truth for every node's 4 fixed-role handles - top/
// left always incoming (target), right/bottom always outgoing (source).
// ToolNode.tsx renders its actual <Handle> elements from this exact array
// (not a separate local copy) so it can never drift from defaultNodeHandles/
// normalizeConnection below, which both also depend on this same shape.
export const HANDLE_SIDES: { id: string; type: HandleType; position: Position }[] = [
  { id: 'top', type: 'target', position: Position.Top },
  { id: 'left', type: 'target', position: Position.Left },
  { id: 'right', type: 'source', position: Position.Right },
  { id: 'bottom', type: 'source', position: Position.Bottom },
]

// Root cause fixed 2026-09-13: importing a saved pipeline set brand-new nodes
// AND the edges connecting them in the same operation. React Flow only knows
// where to draw an edge once it has measured the node's actual handle
// positions via an async ResizeObserver pass - for a normal palette drop
// there's always a human-timescale gap before the user draws a connection,
// so this measurement has time to land first. Import gives it no such gap:
// the edge's very first render finds `internals.handleBounds` still empty
// (React Flow's `isNodeInitialized()` gate) and silently renders nothing -
// confirmed live (README/KNOWN_ISSUES 2026-09-13 entry) to never self-correct
// afterward even seconds later, an Auto-arrange re-render, or a delayed
// setEdges - this is not a timing race that a delay can win.
//
// `node.handles` is React Flow's own documented escape hatch for exactly
// this: pre-declaring approximate handle positions makes `isNodeInitialized`
// true synchronously (no measurement wait), so the edge draws immediately in
// roughly the right place; the real ResizeObserver pass still runs afterward
// and silently overwrites this estimate with the pixel-exact one
// (`sourceNode.internals.handleBounds || toHandleBounds(sourceNode.handles)`
// in @xyflow/system prefers real measurement whenever it exists). Also
// applied to fresh palette drops below for consistency, since nothing
// guarantees that human-timescale gap will always exist (e.g. a future
// "connect on drop" feature).
const HANDLE_SIZE = 8

export function defaultNodeHandles(width: number, height: number): NodeHandle[] {
  return HANDLE_SIDES.map(({ id, type, position }) => {
    switch (position) {
      case Position.Top:
        return { id, type, position, x: width / 2 - HANDLE_SIZE / 2, y: -HANDLE_SIZE / 2 }
      case Position.Left:
        return { id, type, position, x: -HANDLE_SIZE / 2, y: height / 2 - HANDLE_SIZE / 2 }
      case Position.Right:
        return { id, type, position, x: width - HANDLE_SIZE / 2, y: height / 2 - HANDLE_SIZE / 2 }
      case Position.Bottom:
        return { id, type, position, x: width / 2 - HANDLE_SIZE / 2, y: height - HANDLE_SIZE / 2 }
    }
  })
}
