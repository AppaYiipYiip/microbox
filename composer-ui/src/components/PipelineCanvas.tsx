import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  type Connection,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTranslation } from 'react-i18next'
import { ToolNode, type ToolNodeType } from './ToolNode'
import { DRAG_DATA_FORMAT } from './NodePalette'
import { TOOL_CATALOG } from '../data/toolCatalog'
import './PipelineCanvas.css'

let nodeIdCounter = 0
function nextNodeId() {
  nodeIdCounter += 1
  return `node-${nodeIdCounter}`
}

// Module-level, not recreated per render - React Flow's own guidance for
// nodeTypes/edgeTypes objects (a new object identity every render forces it
// to rebuild internal caches unnecessarily).
const NODE_TYPES = { tool: ToolNode }

// Controlled component - the parent (ComposerPage) owns nodes/edges state
// (via useNodesState/useEdgesState) so its Save/Run toolbar can read the
// current canvas contents directly, rather than this component being the
// only place that state lives. Must be rendered inside a ReactFlowProvider
// by the parent (needs useReactFlow for screenToFlowPosition).
export function PipelineCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectNode,
}: {
  nodes: ToolNodeType[]
  edges: Edge[]
  onNodesChange: OnNodesChange<ToolNodeType>
  onEdgesChange: OnEdgesChange<Edge>
  onConnect: (connection: Connection) => void
  onSelectNode: (toolId: string | null) => void
}) {
  const { t } = useTranslation()
  const { screenToFlowPosition } = useReactFlow()

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const toolId = event.dataTransfer.getData(DRAG_DATA_FORMAT)
      if (!toolId || !TOOL_CATALOG.some((tool) => tool.id === toolId)) return

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const newNode: ToolNodeType = {
        id: nextNodeId(),
        type: 'tool',
        position,
        data: { toolId },
      }
      onNodesChange([{ type: 'add', item: newNode }])
    },
    [screenToFlowPosition, onNodesChange],
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: ToolNodeType) => onSelectNode(node.data.toolId),
    [onSelectNode],
  )

  const onPaneClick = useCallback(() => onSelectNode(null), [onSelectNode])

  return (
    <div className="pipeline-canvas">
      {nodes.length === 0 && <div className="pipeline-canvas__empty-hint">{t('composer.canvasEmptyHint')}</div>}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        colorMode="dark"
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
