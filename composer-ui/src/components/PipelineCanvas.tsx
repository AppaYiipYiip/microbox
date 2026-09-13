import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
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
import { DeletableEdge, type DeletableEdgeData } from './DeletableEdge'
import { DRAG_DATA_FORMAT } from './NodePalette'
import { TOOL_CATALOG } from '../data/toolCatalog'
import { isValidConnection } from '../utils/isValidConnection'
import { nextNodeId } from '../utils/nodeId'
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, defaultNodeHandles } from '../data/nodeDefaults'
import './PipelineCanvas.css'

// Accepts both keys so Delete works on Windows and Backspace works on macOS
// (React Flow's own default is 'Backspace' only) - owner feedback 2026-09-13
// asked for a "delete key" without specifying which.
const DELETE_KEY_CODE = ['Backspace', 'Delete']

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
  invalidEdgeIds,
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
  // Edge ids that don't correspond to a real dependency in
  // workflows/microbox.nf (src/utils/validatePipeline.ts, computed by
  // ComposerPage). Purely a rendering overlay - see edgesWithValidity below.
  invalidEdgeIds: Set<string>
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
        handles: defaultNodeHandles(DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT),
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

  // Injects `data.invalid` into a COPY of the edges array for rendering only
  // - the real `edges` state (and therefore Save snapshots and undo/redo
  // history) never carries this flag, since it's derived, not user data.
  const edgesWithValidity = useMemo(
    () =>
      invalidEdgeIds.size === 0
        ? edges
        : edges.map((edge) =>
            invalidEdgeIds.has(edge.id) ? { ...edge, data: { ...edge.data, invalid: true } satisfies DeletableEdgeData } : edge,
          ),
    [edges, invalidEdgeIds],
  )

  return (
    <div className="pipeline-canvas">
      {nodes.length === 0 && <div className="pipeline-canvas__empty-hint">{t('composer.canvasEmptyHint')}</div>}
      <ReactFlow
        nodes={nodes}
        edges={edgesWithValidity}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        defaultEdgeOptions={{ type: 'deletable' }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        // React Flow's own default is `Strict`, which silently drops a
        // connection whenever the drag starts and ends on two same-role
        // handles (target->target or source->source) - with zero visual
        // feedback explaining why. Every node here always shows all 4
        // fixed-role handles at once (top/left target, right/bottom
        // source), so grabbing the "wrong" one by habit or visual proximity
        // is easy, and did it silently fail with no error - reported
        // 2026-09-13 (owner: "sometimes the connection fails and i need to
        // do it / try so many times"), reproduced and confirmed live: a
        // target-to-target drag created 0 edges under Strict, every time.
        // `Loose` accepts a drag between any two handles regardless of
        // declared role (only rejecting a handle connecting to itself,
        // already covered by isValidConnection above) - the resulting
        // edge's source/target still resolve sensibly (React Flow treats
        // whichever end has the "source" role as source), so this doesn't
        // weaken the fixed-direction visual design, it just stops a mis-
        // grabbed handle from failing with no explanation.
        connectionMode={ConnectionMode.Loose}
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
