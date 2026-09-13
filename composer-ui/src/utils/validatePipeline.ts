import type { Edge } from '@xyflow/react'
import type { ToolNodeType } from '../components/ToolNode'
import { VALID_CONNECTIONS } from '../data/pipelineTopology'

// One drawn connection that doesn't correspond to any real dependency in
// workflows/microbox.nf (see pipelineTopology.ts for the ground truth and
// why). Pure and React-Flow-independent so it's directly unit-testable -
// same extraction pattern already used for isValidConnection/updateNodeParam.
export interface InvalidEdge {
  edgeId: string
  sourceToolId: string
  targetToolId: string
}

export function findInvalidEdges(nodes: ToolNodeType[], edges: Edge[]): InvalidEdge[] {
  const toolIdByNodeId = new Map(nodes.map((n) => [n.id, n.data.toolId]))
  const invalid: InvalidEdge[] = []

  for (const edge of edges) {
    const sourceToolId = toolIdByNodeId.get(edge.source)
    const targetToolId = toolIdByNodeId.get(edge.target)
    if (!sourceToolId || !targetToolId) continue

    const allowedTargets = VALID_CONNECTIONS[sourceToolId] ?? []
    if (!allowedTargets.includes(targetToolId)) {
      invalid.push({ edgeId: edge.id, sourceToolId, targetToolId })
    }
  }

  return invalid
}
