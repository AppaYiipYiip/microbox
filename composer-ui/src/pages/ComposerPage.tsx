import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReactFlowProvider, useNodesState, useEdgesState, addEdge, type Connection, type Edge } from '@xyflow/react'
import { NodePalette } from '../components/NodePalette'
import { PipelineCanvas } from '../components/PipelineCanvas'
import { TOOL_CATALOG } from '../data/toolCatalog'
import type { ToolNodeType } from '../components/ToolNode'
import { updateNodeParam as mergeNodeParam } from '../utils/updateNodeParam'
import './ComposerPage.css'

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

  // New edges are explicitly typed 'deletable' (DeletableEdge, the X-on-
  // click component) rather than relying on ReactFlow's defaultEdgeOptions
  // prop to apply automatically through this custom onConnect handler -
  // addEdge() is a plain utility function and doesn't know about that prop
  // on its own, so it's set here directly to be certain, not assumed.
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, type: 'deletable' }, eds)),
    [setEdges],
  )

  const updateNodeParam = useCallback(
    (nodeId: string, key: string, value: string) => setNodes((nds) => mergeNodeParam(nds, nodeId, key, value)),
    [setNodes],
  )

  return (
    <div className="composer-page">
      <div className="composer-page__toolbar">
        <h1 className="composer-page__title">{t('composer.title')}</h1>
        <div className="composer-page__actions">
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
      <div className="composer-page__layout">
        <div className="composer-page__canvas-area">
          <PipelineCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectNode={setSelectedNodeId}
          />
          {selectedNode && selectedTool && (
            <aside className="composer-page__detail" aria-label={t('composer.nodeSelected')}>
              <button type="button" className="composer-page__detail-close" onClick={() => setSelectedNodeId(null)}>
                {t('composer.clearSelection')}
              </button>
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
