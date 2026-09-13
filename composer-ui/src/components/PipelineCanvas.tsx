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
  type OnBeforeDelete,
  type SelectionDragHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTranslation } from 'react-i18next'
import { ToolNode, type ToolNodeType } from './ToolNode'
import { DeletableEdge } from './DeletableEdge'
import { DRAG_DATA_FORMAT } from './NodePalette'
import { TOOL_CATALOG } from '../data/toolCatalog'
import { isValidConnection } from '../utils/isValidConnection'
import { nextNodeId } from '../utils/nodeId'
import './PipelineCanvas.css'

// Accepts both keys so Delete works on Windows and Backspace works on macOS
// (React Flow's own default is 'Backspace' only) - owner feedback 2026-09-13
// asked for a "delete key" without specifying which.
const DELETE_KEY_CODE = ['Backspace', 'Delete']

// All nodes start at this same size regardless of tool name/category length
// (owner feedback 2026-09-13: "the nodes should all have the same size by
// default no matter their content"). ToolNode.tsx truncates overflowing text
// with an ellipsis rather than growing the box. The user can resize from
// here via the NodeResizer handles ToolNode renders when selected; React
// Flow persists the result back onto node.width/node.height through the
// normal onNodesChange stream, same as position drags.
export const DEFAULT_NODE_WIDTH = 180
export const DEFAULT_NODE_HEIGHT = 68

// Module-level, not recreated per render - React Flow's own guidance for
// nodeTypes/edgeTypes objects (a new object identity every render forces it
// to rebuild internal caches unnecessarily).
const NODE_TYPES = { tool: ToolNode }
const EDGE_TYPES = { deletable: DeletableEdge }

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
  onBeforeDelete,
  onNodesDelete,
  onNodeDragStart,
  onSelectionDragStart,
  onBeforeAddNode,
}: {
  nodes: ToolNodeType[]
  edges: Edge[]
  onNodesChange: OnNodesChange<ToolNodeType>
  onEdgesChange: OnEdgesChange<Edge>
  onConnect: (connection: Connection) => void
  onSelectNode: (nodeId: string | null) => void
  // Undo/redo hooks (owner feedback 2026-09-13: "many quality of life
  // elements") - each fires right BEFORE its corresponding mutation is
  // applied, so ComposerPage can snapshot pre-change state for its history
  // stack. Delete goes through `onBeforeDelete` specifically (not just a
  // 'remove' NodeChange/EdgeChange) since it's the one hook React Flow
  // guarantees runs before the removal is committed to state.
  onBeforeDelete: OnBeforeDelete<ToolNodeType, Edge>
  onNodesDelete: (deleted: ToolNodeType[]) => void
  onNodeDragStart: () => void
  onSelectionDragStart: SelectionDragHandler<ToolNodeType>
  // Fired right before a palette drop adds a new node - the fourth history
  // entry point alongside onConnect/onBeforeDelete/onNodeDragStart above.
  onBeforeAddNode: () => void
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
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
        data: { toolId, params: {} },
      }
      onBeforeAddNode()
      onNodesChange([{ type: 'add', item: newNode }])
    },
    [screenToFlowPosition, onNodesChange, onBeforeAddNode],
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: ToolNodeType) => onSelectNode(node.id),
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
        edgeTypes={EDGE_TYPES}
        defaultEdgeOptions={{ type: 'deletable' }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onBeforeDelete={onBeforeDelete}
        onNodesDelete={onNodesDelete}
        onNodeDragStart={onNodeDragStart}
        onSelectionDragStart={onSelectionDragStart}
        deleteKeyCode={DELETE_KEY_CODE}
        colorMode="dark"
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
