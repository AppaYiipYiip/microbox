import { Fragment } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { TOOL_CATALOG } from '../data/toolCatalog'
import './ToolNode.css'

// Custom React Flow node - PLAN.md §6.16: nodes must be "clickable and
// hoverable". Click-to-select is React Flow's own built-in node selection
// (styled via the `selected` prop it injects); hover uses a plain CSS
// tooltip via the native `title` attribute plus a styled ::after, so it
// works with zero extra JS and is trivially screen-reader-visible too.
export type ToolNodeData = { toolId: string }
export type ToolNodeType = Node<ToolNodeData, 'tool'>

// Connect from any side, not just left-in/right-out - owner feedback,
// 2026-09-13: "i would love to be able to connect the nodes from up and
// down, and left and right." Each of the 4 sides gets both a source and a
// target handle (a source and target handle can't be the same Handle
// element - React Flow requires a unique `id` per handle so an edge can
// record exactly which one it's attached to, verified against React
// Flow's own multi-handle docs/examples before implementing this, not
// guessed). Dragging always starts from a source handle and drops on a
// target handle (React Flow's own built-in behavior) - having both at
// every side is what makes every side usable as either the start or the
// end of a connection.
// Explicit offset per pair (rather than relying on @xyflow's internal
// data-handlepos attribute, which isn't part of its public API and could
// change across upgrades) so the target/source handles on the same side
// don't render exactly on top of each other - each stays individually
// grabbable. Top/Bottom handles are offset horizontally; Left/Right
// handles are offset vertically.
const SIDES = [
  { position: Position.Top, key: 'top', targetStyle: { left: '35%' }, sourceStyle: { left: '65%' } },
  { position: Position.Right, key: 'right', targetStyle: { top: '35%' }, sourceStyle: { top: '65%' } },
  { position: Position.Bottom, key: 'bottom', targetStyle: { left: '35%' }, sourceStyle: { left: '65%' } },
  { position: Position.Left, key: 'left', targetStyle: { top: '35%' }, sourceStyle: { top: '65%' } },
] as const

export function ToolNode({ data, selected }: NodeProps<ToolNodeType>) {
  const { t } = useTranslation()
  const tool = TOOL_CATALOG.find((tl) => tl.id === data.toolId)
  if (!tool) return null

  return (
    <div
      className={selected ? 'tool-node tool-node--selected' : 'tool-node'}
      title={t(tool.descriptionKey)}
    >
      {SIDES.map(({ position, key, targetStyle, sourceStyle }) => (
        <Fragment key={key}>
          <Handle
            type="target"
            position={position}
            id={`${key}-target`}
            className="tool-node__handle tool-node__handle--target"
            style={targetStyle}
          />
          <Handle
            type="source"
            position={position}
            id={`${key}-source`}
            className="tool-node__handle tool-node__handle--source"
            style={sourceStyle}
          />
        </Fragment>
      ))}
      <div className="tool-node__category">{t(`categories.${tool.category}`)}</div>
      <div className="tool-node__name">{t(tool.nameKey)}</div>
    </div>
  )
}
