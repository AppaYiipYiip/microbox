import type { HandleType } from '@xyflow/react'
import { HANDLE_SIDES } from '../data/nodeDefaults'

const SOURCE_HANDLE_IDS = new Set(HANDLE_SIDES.filter((h) => h.type === 'source').map((h) => h.id))
const TARGET_HANDLE_IDS = new Set(HANDLE_SIDES.filter((h) => h.type === 'target').map((h) => h.id))

// Every node's handle ids are fixed and global (HANDLE_SIDES, in
// nodeDefaults.ts) - 'top'/'left' are always target, 'right'/'bottom' are
// always source - so a handle's role can be looked up from its id alone,
// with no need to inspect the actual node. Returns null for a missing id
// (an older export/edge with no handle info) or one that isn't one of the
// 4 known ids - both treated as "unknown, don't block on this" by callers.
export function handleRole(handleId: string | null | undefined): HandleType | null {
  if (!handleId) return null
  if (SOURCE_HANDLE_IDS.has(handleId)) return 'source'
  if (TARGET_HANDLE_IDS.has(handleId)) return 'target'
  return null
}
