import { createContext } from 'react'
import type { ToolRunStatus } from '../utils/nodeRunStatus'

// Full-UI-architecture Phase 4: live per-tool run status, deliberately kept OUT of
// ToolNodeData/the `nodes` React Flow state - it's run-time information, not build-time
// (§6.17's own critique #3 draws exactly this line for the full results view; this is
// the same principle applied to the lighter canvas-highlighting version). Keeping it in
// a separate context means a live run's status can never leak into a Save/Export JSON
// snapshot, undo/redo history, or a copy/paste clipboard entry - all of which only ever
// touch `ToolNodeData` directly. Empty object = no active run, same as before Phase 4.
export const RunStatusContext = createContext<Record<string, ToolRunStatus>>({})
