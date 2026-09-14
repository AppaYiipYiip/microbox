import { TOOL_CATALOG } from '../data/toolCatalog'

// Full-UI-architecture Phase 4b (§6.17: "the data already exists per-node, it just
// isn't surfaced yet"). Groups a run's real file listing (server/main.py's
// GET /reports-api/runs/{id}/files) by which tool's real resultDirs prefix each file's
// path starts with - the values/table half of the results view (Sankey/Krona charts are
// a separate, not-yet-built piece). A run launched before Phase 4b (no matching
// resultDirs at all) or one where a tool simply didn't run produces no group for it -
// an empty results view for an old run is honest, not a bug.
export interface RunFile {
  path: string
  size: number
}

export interface ToolResultGroup {
  toolId: string
  nameKey: string
  files: RunFile[]
}

export function groupRunFilesByTool(files: RunFile[]): ToolResultGroup[] {
  // Defensive against a malformed/unexpected response shape (a network layer returning
  // something other than server/main.py's real {path, size} contract) - real files always
  // have a real string path; this must never crash the whole results panel over one bad
  // entry, degrading to "that file just doesn't show up" instead.
  const validFiles = files.filter((file) => typeof file.path === 'string')
  const groups: ToolResultGroup[] = []
  for (const tool of TOOL_CATALOG) {
    if (!tool.resultDirs || tool.resultDirs.length === 0) continue
    const matched = validFiles.filter((file) => tool.resultDirs?.some((dir) => file.path === dir || file.path.startsWith(`${dir}/`)))
    if (matched.length > 0) groups.push({ toolId: tool.id, nameKey: tool.nameKey, files: matched })
  }
  return groups
}
