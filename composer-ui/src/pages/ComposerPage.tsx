import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReactFlowProvider, useNodesState, useEdgesState, addEdge, type Connection, type Edge } from '@xyflow/react'
import { NodePalette } from '../components/NodePalette'
import { PipelineCanvas } from '../components/PipelineCanvas'
import { TOOL_CATALOG } from '../data/toolCatalog'
import type { ToolNodeType } from '../components/ToolNode'
import { updateNodeParam as mergeNodeParam } from '../utils/updateNodeParam'
import { nextNodeId } from '../utils/nodeId'
import { EMPTY_HISTORY, pushSnapshot, undo as undoHistory, redo as redoHistory } from '../utils/history'
import { findInvalidEdges } from '../utils/validatePipeline'
import './ComposerPage.css'

function toolName(t: (key: string) => string, toolId: string): string {
  const tool = TOOL_CATALOG.find((tl) => tl.id === toolId)
  return tool ? t(tool.nameKey) : toolId
}

// Downloads a JSON snapshot of the canvas (nodes: id/type/position/data -
// data now includes each node's edited params - edges: source/target) via
// a Blob + temporary <a download> - genuinely works client-side, no
// backend needed for this much. NOT the full §6.11 export-fidelity
// requirement (no import path, no schema-version migration story) - a
// real first step, not the finished feature. Named for a human reading
// the download, not a hash, so it's obviously "a microbox pipeline" in a
// Downloads folder.
function downloadCanvasSnapshot(nodes: ToolNodeType[], edges: Edge[]) {
  const snapshot = {
    formatVersion: 1,
    savedAt: new Date().toISOString(),
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  }
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `microbox-pipeline-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function ComposerInner() {
  const { t } = useTranslation()
  const [nodes, setNodes, onNodesChange] = useNodesState<ToolNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  // Tracks the selected NODE instance, not just its tool type - two nodes
  // of the same tool can hold different parameter values, so the detail/
  // edit panel needs to know exactly which node is selected, not just
  // which kind of tool it is (corrected 2026-09-13 alongside adding
  // per-node parameter editing).
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedTool = selectedNode ? TOOL_CATALOG.find((tool) => tool.id === selectedNode.data.toolId) : null

  // Flags connections that don't correspond to any real dependency in
  // workflows/microbox.nf (owner feedback 2026-09-13, after asking about a
  // saved canvas: "doesnt each node have a set of parametres..." led into
  // "how would we store the result" and surfaced that the composer let you
  // draw graphs the real fixed-backbone pipeline can't execute - e.g. QUAST
  // -> MaxBin2, which isn't a real data dependency). Purely informational -
  // does not block Save/Run (Run is already disabled for other reasons).
  const invalidEdges = useMemo(() => findInvalidEdges(nodes, edges), [nodes, edges])
  const invalidEdgeIds = useMemo(() => new Set(invalidEdges.map((e) => e.edgeId)), [invalidEdges])

  // Undo/redo (owner feedback 2026-09-13: "many quality of life elements").
  // A snapshot is the canvas state right BEFORE the mutation about to be
  // applied - taken explicitly at each user-initiated structural edit (add
  // node, delete, duplicate, connect, drag-start) rather than on every low-
  // level onNodesChange/onEdgesChange call, which would otherwise push a
  // new history entry per pixel of a drag. Deliberately does NOT cover
  // in-progress param edits or node resizing yet - narrower scope than "undo
  // literally everything," documented in composer-ui/README.md.
  const [history, setHistory] = useState(EMPTY_HISTORY)
  const takeSnapshot = useCallback(() => setHistory((h) => pushSnapshot(h, { nodes, edges })), [nodes, edges])

  const handleUndo = useCallback(() => {
    const result = undoHistory(history, { nodes, edges })
    if (!result) return
    setHistory(result.history)
    setNodes(result.snapshot.nodes)
    setEdges(result.snapshot.edges)
    setSelectedNodeId(null)
  }, [history, nodes, edges, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    const result = redoHistory(history, { nodes, edges })
    if (!result) return
    setHistory(result.history)
    setNodes(result.snapshot.nodes)
    setEdges(result.snapshot.edges)
    setSelectedNodeId(null)
  }, [history, nodes, edges, setNodes, setEdges])

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y to redo - skipped
  // while focus is inside a text field so the browser's own native text-undo
  // still works for in-progress param edits.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target
      const isEditableTarget = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isEditableTarget || !(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        handleUndo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // New edges are explicitly typed 'deletable' (DeletableEdge, the X-on-
  // click component) rather than relying on ReactFlow's defaultEdgeOptions
  // prop to apply automatically through this custom onConnect handler -
  // addEdge() is a plain utility function and doesn't know about that prop
  // on its own, so it's set here directly to be certain, not assumed.
  const onConnect = useCallback(
    (connection: Connection) => {
      takeSnapshot()
      setEdges((eds) => addEdge({ ...connection, type: 'deletable' }, eds))
    },
    [takeSnapshot, setEdges],
  )

  // onBeforeDelete is the one React Flow hook guaranteed to run before a
  // Delete/Backspace-key or edge-"x" removal is actually applied to state -
  // used here purely to snapshot; always allows the deletion through.
  const handleBeforeDelete = useCallback(async () => {
    takeSnapshot()
    return true
  }, [takeSnapshot])

  const handleNodesDelete = useCallback(
    (deleted: ToolNodeType[]) => {
      if (deleted.some((n) => n.id === selectedNodeId)) setSelectedNodeId(null)
    },
    [selectedNodeId],
  )

  const updateNodeParam = useCallback(
    (nodeId: string, key: string, value: string) => setNodes((nds) => mergeNodeParam(nds, nodeId, key, value)),
    [setNodes],
  )

  // Duplicates the selected node's tool + params (not its connections - a
  // copy that inherited its source's edges would silently create a second
  // pipeline branch the user didn't ask for). Offset so the copy doesn't
  // land exactly on top of the original and is immediately draggable apart.
  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      takeSnapshot()
      const newNode: ToolNodeType = {
        ...node,
        id: nextNodeId(),
        position: { x: node.position.x + 24, y: node.position.y + 24 },
        selected: false,
      }
      setNodes((nds) => [...nds, newNode])
      setSelectedNodeId(newNode.id)
    },
    [nodes, takeSnapshot, setNodes],
  )

  return (
    <div className="composer-page">
      <div className="composer-page__toolbar">
        <h1 className="composer-page__title">{t('composer.title')}</h1>
        <div className="composer-page__actions">
          <button type="button" className="composer-page__btn" title="Ctrl+Z" disabled={history.past.length === 0} onClick={handleUndo}>
            {t('composer.undo')}
          </button>
          <button type="button" className="composer-page__btn" title="Ctrl+Shift+Z" disabled={history.future.length === 0} onClick={handleRedo}>
            {t('composer.redo')}
          </button>
          <button
            type="button"
            className="composer-page__btn"
            title={t('composer.saveHint')}
            onClick={() => downloadCanvasSnapshot(nodes, edges)}
          >
            {t('composer.save')}
          </button>
          <button
            type="button"
            className="composer-page__btn composer-page__btn--primary"
            disabled
            title={t('composer.runDisabledHint')}
          >
            {t('composer.run')}
          </button>
        </div>
      </div>
      {invalidEdges.length > 0 && (
        <div className="composer-page__warning" role="status">
          <p className="composer-page__warning-title">
            {t('composer.invalidConnections', { count: invalidEdges.length })}
          </p>
          <ul className="composer-page__warning-list">
            {invalidEdges.map((invalid) => (
              <li key={invalid.edgeId}>
                {toolName(t, invalid.sourceToolId)} → {toolName(t, invalid.targetToolId)}
              </li>
            ))}
          </ul>
          <p className="composer-page__warning-hint">{t('composer.invalidConnectionsHint')}</p>
        </div>
      )}
      <div className="composer-page__layout">
        <div className="composer-page__canvas-area">
          <PipelineCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectNode={setSelectedNodeId}
            onBeforeDelete={handleBeforeDelete}
            onNodesDelete={handleNodesDelete}
            onNodeDragStart={takeSnapshot}
            onSelectionDragStart={takeSnapshot}
            onBeforeAddNode={takeSnapshot}
            invalidEdgeIds={invalidEdgeIds}
          />
          {selectedNode && selectedTool && (
            <aside className="composer-page__detail" aria-label={t('composer.nodeSelected')}>
              <div className="composer-page__detail-actions">
                <button type="button" className="composer-page__detail-duplicate" onClick={() => duplicateNode(selectedNode.id)}>
                  {t('composer.duplicate')}
                </button>
                <button type="button" className="composer-page__detail-close" onClick={() => setSelectedNodeId(null)}>
                  {t('composer.clearSelection')}
                </button>
              </div>
              <h3>{t(selectedTool.nameKey)}</h3>
              <p>{t(selectedTool.descriptionKey)}</p>
              {selectedTool.params && selectedTool.params.length > 0 ? (
                <form className="composer-page__params" onSubmit={(e) => e.preventDefault()}>
                  {selectedTool.params.map((param) => (
                    <label key={param.key} className="composer-page__param-field">
                      <span>{t(param.labelKey)}</span>
                      <input
                        type="text"
                        value={selectedNode.data.params[param.key] ?? ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, param.key, e.target.value)}
                      />
                    </label>
                  ))}
                </form>
              ) : (
                <p className="composer-page__no-params">{t('composer.noParams')}</p>
              )}
            </aside>
          )}
        </div>
        <NodePalette />
      </div>
    </div>
  )
}

export function ComposerPage() {
  return (
    <ReactFlowProvider>
      <ComposerInner />
    </ReactFlowProvider>
  )
}
