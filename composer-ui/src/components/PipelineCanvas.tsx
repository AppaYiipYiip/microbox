import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
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

function CanvasInner({ onSelectNode }: { onSelectNode: (toolId: string | null) => void }) {
  const { t } = useTranslation()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<ToolNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  )

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
      setNodes((nds) => nds.concat(newNode))
    },
    [screenToFlowPosition, setNodes],
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: ToolNodeType) => {
      onSelectNode(node.data.toolId)
    },
    [onSelectNode],
  )

  const onPaneClick = useCallback(() => onSelectNode(null), [onSelectNode])

  return (
    <div className="pipeline-canvas" ref={wrapperRef}>
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
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}

// Wrapped in its own ReactFlowProvider so useReactFlow (needed for
// screenToFlowPosition - converting a raw browser drop coordinate into the
// canvas's own pan/zoom-aware coordinate space) is available - required by
// React Flow's own drag-and-drop example, not an arbitrary choice.
export function PipelineCanvas({ onSelectNode }: { onSelectNode: (toolId: string | null) => void }) {
  return (
    <ReactFlowProvider>
      <CanvasInner onSelectNode={onSelectNode} />
    </ReactFlowProvider>
  )
}
