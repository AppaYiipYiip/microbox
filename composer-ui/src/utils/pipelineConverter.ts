import { TOOL_CATALOG, type ToolFamily } from '../data/toolCatalog'
import type { ToolNodeType } from '../components/ToolNode'

// The real UI-to-engine converter (full-UI-architecture Phase 3, item 1 -
// ~/.claude/plans/jazzy-shimmying-wolf.md). Implements "Option A" (PLAN.md
// §6.11, already decided): a front-end over the FIXED pipeline shape, not a
// DSL2 compiler - this reads which family is selected and which tool nodes
// are present & enabled on the canvas, and emits the equivalent
// --pipeline/skip_*/param values Nextflow's own -params-file already
// consumes (bin/run.sh's PARAMS_FILE_ARG). Canvas EDGES are never read here -
// the real pipeline's wiring is fixed in workflows/*.nf, controlled entirely
// by skip_* flags and params, not by drawn connections (Composer's own
// README already documents that connections are design/documentation value
// only, not validated against real pipeline behavior).
//
// Every skip_* flag this family owns is always emitted explicitly (true or
// false), not just deltas from nextflow.config's own defaults - a node's
// absence from the canvas must reliably mean "off" regardless of what that
// flag's pipeline-level default happens to be, so an explicit params file
// always fully determines the run, never left half-implied.
export interface ConvertedParams {
  pipeline: ToolFamily
  [flagOrParamKey: string]: string | boolean
}

export function convertCanvasToParams(family: 'metagenomics' | 'wgs', nodes: ToolNodeType[]): ConvertedParams {
  // A disabled node (the canvas's own enabled/skipped toggle, ToolNode.tsx)
  // is treated exactly like a node that isn't on the canvas at all - both
  // mean "don't run this stage," same semantics the canvas's own dimmed-
  // badge visual language already implies to the user.
  const enabledIds = new Set(nodes.filter((n) => n.data.enabled !== false).map((n) => n.data.toolId))

  const familyTools = TOOL_CATALOG.filter((t) => t.family === family)
  const params: ConvertedParams = { pipeline: family }

  // Group by skipFlag first (megahit/metaspades share skip_megahit) - a flag
  // is only "off" (skip=false) if NONE of the tools mapped to it are on the
  // canvas; correct for the shared-flag case, and a no-op grouping of one
  // for every other flag (each maps to exactly one tool).
  const toolsByFlag = new Map<string, typeof familyTools>()
  for (const tool of familyTools) {
    if (!tool.skipFlag) continue
    const list = toolsByFlag.get(tool.skipFlag) ?? []
    list.push(tool)
    toolsByFlag.set(tool.skipFlag, list)
  }
  for (const [flag, tools] of toolsByFlag) {
    params[flag] = !tools.some((t) => enabledIds.has(t.id))
  }

  // Assembler selection (metagenomics only) - whichever of megahit/metaspades
  // is actually enabled on canvas picks params.assembler; if neither is
  // enabled, skip_megahit is already true above so the value is unused, but
  // still emitted for an explicit, unambiguous params file.
  const assemblerTool = familyTools.find((t) => t.assemblerValue && enabledIds.has(t.id))
  if (assemblerTool?.assemblerValue) params.assembler = assemblerTool.assemblerValue

  // Per-node param values (DB/reference paths) - only from nodes that are
  // actually enabled; a disabled node's stale path value must never leak
  // into the params file for a stage that isn't going to run.
  for (const node of nodes) {
    if (node.data.enabled === false) continue
    const tool = familyTools.find((t) => t.id === node.data.toolId)
    if (!tool?.params) continue
    for (const paramDef of tool.params) {
      const value = node.data.params[paramDef.key]
      if (value) params[paramDef.key] = value
    }
  }

  return params
}
