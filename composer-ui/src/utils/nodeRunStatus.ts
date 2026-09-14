import { TOOL_CATALOG } from '../data/toolCatalog'

// Full-UI-architecture Phase 4 (item "per-node live status on the canvas"). Turns
// GET /api/runs/{id}'s `processes` map (server/main.py's _compute_run_status, real
// Nextflow trace statuses: SUBMITTED/RUNNING/COMPLETED/CACHED/FAILED/ABORTED) into one
// status per TOOL (not per canvas node - see toolCatalog.ts's processNames comment for
// why this is keyed by tool id, a deliberate simplification, not an oversight).
export type ToolRunStatus = 'running' | 'completed' | 'failed'

const RUNNING_STATUSES = new Set(['SUBMITTED', 'RUNNING'])
const FAILED_STATUSES = new Set(['FAILED', 'ABORTED'])
// Everything else (COMPLETED, CACHED - a -resume'd task that didn't need to re-run, but
// genuinely did complete) counts as completed.

function matchesProcessName(qualifiedName: string, processName: string): boolean {
  // Nextflow's weblog qualifies trace.process with its workflow name
  // ("MICROBOX:FASTP", "WGS:BWAMEM2_MEM" - confirmed empirically 2026-09-14 against a
  // real run, see toolCatalog.ts's own comment) - matching on the suffix after the last
  // ':' avoids hardcoding that prefix, so this keeps working if a process ever moves
  // into a named subworkflow (an extra ':'-separated segment) without needing an update
  // here.
  return qualifiedName === processName || qualifiedName.endsWith(`:${processName}`)
}

export function deriveToolRunStatuses(processes: Record<string, string>): Record<string, ToolRunStatus> {
  const result: Record<string, ToolRunStatus> = {}
  for (const tool of TOOL_CATALOG) {
    if (!tool.processNames || tool.processNames.length === 0) continue
    let sawAny = false
    let sawRunning = false
    let sawFailed = false
    for (const [qualifiedName, status] of Object.entries(processes)) {
      if (!tool.processNames.some((name) => matchesProcessName(qualifiedName, name))) continue
      sawAny = true
      if (FAILED_STATUSES.has(status)) sawFailed = true
      else if (RUNNING_STATUSES.has(status)) sawRunning = true
    }
    if (!sawAny) continue // not yet started - no badge, same as a node that hasn't run
    result[tool.id] = sawFailed ? 'failed' : sawRunning ? 'running' : 'completed'
  }
  return result
}
