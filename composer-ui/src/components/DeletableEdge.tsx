import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps, type Edge } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import './DeletableEdge.css'

// A connection shows an X to delete it when clicked - owner feedback,
// 2026-09-13. Verified against React Flow's own documented pattern before
// implementing (reactflow.dev/learn/customization/edge-labels): BaseEdge
// for the actual line, EdgeLabelRenderer to portal a real HTML button to
// the edge's midpoint (edges render in an SVG layer, which can't host a
// normal button directly), deleteElements from useReactFlow to remove it.
// The X only renders when `selected` - "when clicking a node connection we
// have an X", not a button visible on every edge all the time.
//
// `data.invalid` is a purely visual, render-time overlay - PipelineCanvas
// derives it from src/utils/validatePipeline.ts and injects it into a copy
// of the edges array passed to <ReactFlow>, never into the actual edges
// state (so it never leaks into the Save snapshot or the undo/redo history).
export type DeletableEdgeData = { invalid?: boolean }

export function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, selected, data }: EdgeProps<Edge<DeletableEdgeData>>) {
  const { t } = useTranslation()
  const { deleteElements } = useReactFlow()
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY })
  const classNames = ['deletable-edge']
  if (data?.invalid) classNames.push('deletable-edge--invalid')
  if (selected) classNames.push('deletable-edge--selected')

  return (
    <>
      <BaseEdge id={id} path={edgePath} className={classNames.join(' ')} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="deletable-edge__delete nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title={t('composer.deleteConnection')}
            aria-label={t('composer.deleteConnection')}
            onClick={() => deleteElements({ edges: [{ id }] })}
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

