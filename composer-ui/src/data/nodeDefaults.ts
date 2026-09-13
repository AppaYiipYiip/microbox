import { Position, type NodeHandle } from '@xyflow/react'

// Shared with src/components/PipelineCanvas.tsx (new nodes dropped from the
// palette) and src/utils/importCanvasSnapshot.ts (nodes reconstructed from an
// imported file that predates width/height being saved, or that omits them
// for any other reason) - kept in one place so the two can't silently drift.
export const DEFAULT_NODE_WIDTH = 180
export const DEFAULT_NODE_HEIGHT = 68

// Must mirror ToolNode.tsx's SIDES array exactly (top/left target, right/
// bottom source) - this is a deliberate duplication, not a shared import,
// because that file is React-Flow-render-only and this one needs to stay
// importable from pure logic (importCanvasSnapshot.ts) without pulling it in.
//
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
  return [
    { id: 'top', type: 'target', position: Position.Top, x: width / 2 - HANDLE_SIZE / 2, y: -HANDLE_SIZE / 2 },
    { id: 'left', type: 'target', position: Position.Left, x: -HANDLE_SIZE / 2, y: height / 2 - HANDLE_SIZE / 2 },
    { id: 'right', type: 'source', position: Position.Right, x: width - HANDLE_SIZE / 2, y: height / 2 - HANDLE_SIZE / 2 },
    { id: 'bottom', type: 'source', position: Position.Bottom, x: width / 2 - HANDLE_SIZE / 2, y: height - HANDLE_SIZE / 2 },
  ]
}
