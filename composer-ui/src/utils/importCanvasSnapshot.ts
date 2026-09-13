import { addEdge, type Edge } from '@xyflow/react'
import type { ToolNodeType } from '../components/ToolNode'
import { TOOL_CATALOG } from '../data/toolCatalog'
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, defaultNodeHandles } from '../data/nodeDefaults'
import { nextNodeId } from './nodeId'

// Parses and validates a canvas snapshot downloaded by downloadCanvasSnapshot
// (ComposerPage.tsx) - PLAN.md §6.11's "save/import/export a pipeline
// configuration as a portable file" requirement. Pure and side-effect-free
// (no FileReader/DOM here) so it's directly unit-testable - the actual file
// picker is wired in ComposerPage.tsx and verified live in-browser instead,
// same split as every other browser-only interaction this project can't
// faithfully simulate in jsdom.
//
// Deliberately REJECTS the whole file on any structural problem rather than
// importing a partial/best-effort graph - PLAN.md §6.11 flags "basic sanity
// validation on import (a malformed or hostile file shouldn't be trusted
// blindly)" as a real requirement, and a half-imported graph silently missing
// nodes the user expected would be worse than a clear "this file didn't load"
// error.
export type ImportError = 'invalid-json' | 'malformed' | 'unsupported-version' | 'unknown-tool'
export type ImportResult = { ok: true; nodes: ToolNodeType[]; edges: Edge[] } | { ok: false; error: ImportError }

const KNOWN_TOOL_IDS = new Set(TOOL_CATALOG.map((tool) => tool.id))

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function parseCanvasSnapshot(jsonText: string): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    return { ok: false, error: 'invalid-json' }
  }

  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'malformed' }
  const snapshot = raw as Record<string, unknown>

  // Gate on the exact version this parser understands - a real future
  // format change should bump this and get its own migration path, not be
  // guessed at here (same "no silent guessing" stance as every validation
  // step below).
  if (snapshot.formatVersion !== 1) return { ok: false, error: 'unsupported-version' }
  if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return { ok: false, error: 'malformed' }

  // Every imported node gets a FRESH id via the same counter the palette-
  // drop and duplicate paths use (src/utils/nodeId.ts) - never trusting the
  // file's own ids directly, since they were assigned in a different session
  // and could collide with ids already in use on the current canvas (two
  // different sessions both start counting from "node-1"). idRemap lets
  // edges below follow the same renumbering.
  const idRemap = new Map<string, string>()
  const importedNodes: ToolNodeType[] = []

  for (const rawNode of snapshot.nodes) {
    if (typeof rawNode !== 'object' || rawNode === null) return { ok: false, error: 'malformed' }
    const node = rawNode as Record<string, unknown>
    const position = node.position as Record<string, unknown> | undefined
    const data = node.data as Record<string, unknown> | undefined

    if (
      typeof node.id !== 'string' ||
      !position ||
      !isFiniteNumber(position.x) ||
      !isFiniteNumber(position.y) ||
      !data ||
      typeof data.toolId !== 'string'
    ) {
      return { ok: false, error: 'malformed' }
    }
    if (!KNOWN_TOOL_IDS.has(data.toolId)) return { ok: false, error: 'unknown-tool' }

    const newId = nextNodeId()
    idRemap.set(node.id, newId)

    const rawParams = data.params
    const params: Record<string, string> =
      rawParams && typeof rawParams === 'object'
        ? Object.fromEntries(
            Object.entries(rawParams as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
          )
        : {}

    const width = isFiniteNumber(node.width) ? node.width : DEFAULT_NODE_WIDTH
    const height = isFiniteNumber(node.height) ? node.height : DEFAULT_NODE_HEIGHT

    importedNodes.push({
      id: newId,
      type: 'tool',
      position: { x: position.x, y: position.y },
      width,
      height,
      // See defaultNodeHandles() - without this, edges connecting two
      // freshly-imported nodes silently fail to render (React Flow can't
      // yet measure real handle positions for nodes it just received).
      handles: defaultNodeHandles(width, height),
      data: { toolId: data.toolId, params, enabled: data.enabled !== false },
    })
  }

  // Edges are rebuilt via React Flow's own addEdge() utility (the same one
  // onConnect already uses) rather than hand-assembling edge objects, so the
  // id format/shape stays identical to a freshly-drawn connection instead of
  // a second, easy-to-drift scheme.
  let importedEdges: Edge[] = []
  for (const rawEdge of snapshot.edges) {
    if (typeof rawEdge !== 'object' || rawEdge === null) return { ok: false, error: 'malformed' }
    const edge = rawEdge as Record<string, unknown>
    if (typeof edge.source !== 'string' || typeof edge.target !== 'string') return { ok: false, error: 'malformed' }

    const newSource = idRemap.get(edge.source)
    const newTarget = idRemap.get(edge.target)
    if (!newSource || !newTarget) return { ok: false, error: 'malformed' }

    importedEdges = addEdge(
      {
        source: newSource,
        target: newTarget,
        // Older exports (before this field was saved) omit these - falls
        // back to React Flow's own "first handle found" default, a known,
        // documented limitation (composer-ui/README.md) rather than data
        // this parser can recover.
        sourceHandle: typeof edge.sourceHandle === 'string' ? edge.sourceHandle : null,
        targetHandle: typeof edge.targetHandle === 'string' ? edge.targetHandle : null,
        type: 'deletable',
      },
      importedEdges,
    )
  }

  return { ok: true, nodes: importedNodes, edges: importedEdges }
}
