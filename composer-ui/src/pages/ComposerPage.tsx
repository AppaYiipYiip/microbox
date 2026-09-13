import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReactFlowProvider, useNodesState, useEdgesState, addEdge, type Connection, type Edge } from '@xyflow/react'
import { NodePalette } from '../components/NodePalette'
import { PipelineCanvas } from '../components/PipelineCanvas'
import { TOOL_CATALOG } from '../data/toolCatalog'
import type { ToolNodeType } from '../components/ToolNode'
import './ComposerPage.css'

// Downloads a JSON snapshot of the canvas (nodes: id/type/position/data,
// edges: source/target) via a Blob + temporary <a download> - genuinely
// works client-side, no backend needed for this much. NOT the full §6.11
// export-fidelity requirement (no per-node parameter editing exists yet to
// serialize, no import path, no schema version) - a real first step, not
// the finished feature. Named for a human reading the download, not a
// hash, so it's obviously "a microbox pipeline" in a Downloads folder.
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
  const [nodes, , onNodesChange] = useNodesState<ToolNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const selectedTool = TOOL_CATALOG.find((tool) => tool.id === selectedToolId) ?? null

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges])

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
            onSelectNode={setSelectedToolId}
          />
          {selectedTool && (
            <aside className="composer-page__detail" aria-label={t('composer.nodeSelected')}>
              <button type="button" className="composer-page__detail-close" onClick={() => setSelectedToolId(null)}>
                {t('composer.clearSelection')}
              </button>
              <h3>{t(selectedTool.nameKey)}</h3>
              <p>{t(selectedTool.descriptionKey)}</p>
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
