import type { Edge } from '@xyflow/react'
import type { ToolNodeType } from '../components/ToolNode'

// Pure undo/redo stack logic, extracted out of ComposerPage so it's directly
// unit-testable (React Flow's own drag/select/delete interactions that
// trigger it can't be faithfully simulated in jsdom - see
// composer-ui/README.md's Testing section).
export type CanvasSnapshot = { nodes: ToolNodeType[]; edges: Edge[] }
export type History = { past: CanvasSnapshot[]; future: CanvasSnapshot[] }

export const EMPTY_HISTORY: History = { past: [], future: [] }
export const DEFAULT_MAX_HISTORY = 50

// Records `snapshot` (the canvas state right BEFORE the mutation the caller
// is about to apply) as the new most-recent undo point, and clears redo -
// same behavior as every standard editor undo stack: making a new change
// after undoing discards the redone-away future.
export function pushSnapshot(history: History, snapshot: CanvasSnapshot, maxHistory = DEFAULT_MAX_HISTORY): History {
  return { past: [...history.past, snapshot].slice(-maxHistory), future: [] }
}

// `current` is the canvas state right now (before the undo is applied) -
// needed so it can be pushed onto `future` for a subsequent redo.
export function undo(history: History, current: CanvasSnapshot, maxHistory = DEFAULT_MAX_HISTORY): { history: History; snapshot: CanvasSnapshot } | null {
  if (history.past.length === 0) return null
  const snapshot = history.past[history.past.length - 1]
  const past = history.past.slice(0, -1)
  const future = [current, ...history.future].slice(0, maxHistory)
  return { history: { past, future }, snapshot }
}

export function redo(history: History, current: CanvasSnapshot, maxHistory = DEFAULT_MAX_HISTORY): { history: History; snapshot: CanvasSnapshot } | null {
  if (history.future.length === 0) return null
  const snapshot = history.future[0]
  const future = history.future.slice(1)
  const past = [...history.past, current].slice(-maxHistory)
  return { history: { past, future }, snapshot }
}
