import { Handle, NodeResizer, Position, type NodeProps, type Node } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { TOOL_CATALOG } from '../data/toolCatalog'
import './ToolNode.css'

// Custom React Flow node - PLAN.md §6.16: nodes must be "clickable and
// hoverable". Click-to-select is React Flow's own built-in node selection
// (styled via the `selected` prop it injects); hover uses a plain CSS
// tooltip via the native `title` attribute plus a styled ::after, so it
// works with zero extra JS and is trivially screen-reader-visible too.
export type ToolNodeData = { toolId: string; params: Record<string, string> }
export type ToolNodeType = Node<ToolNodeData, 'tool'>

// Exactly 4 handles, one per side, fixed roles - corrected 2026-09-13 after
// owner feedback ("i only asked for 4 in total, not 8... we assume both the
// left and top are connections to previous nodes, while bottom and right
// are connection to the next nodes"). The earlier pass gave every side both
// a source AND a target handle (8 total) to allow starting a drag from any
// side - overcomplicating what was actually asked for: top/left always
// receive an incoming connection, bottom/right always send an outgoing one.
// A single handle accepts any number of edges by default in React Flow (no
// extra config needed for "used multiple times").
const SIDES = [
  { position: Position.Top, id: 'top', type: 'target' as const },
  { position: Position.Left, id: 'left', type: 'target' as const },
  { position: Position.Right, id: 'right', type: 'source' as const },
  { position: Position.Bottom, id: 'bottom', type: 'source' as const },
]

export function ToolNode({ data, selected }: NodeProps<ToolNodeType>) {
  const { t } = useTranslation()
  const tool = TOOL_CATALOG.find((tl) => tl.id === data.toolId)
  if (!tool) return null

  return (
    <div
      className={selected ? 'tool-node tool-node--selected' : 'tool-node'}
      title={t(tool.descriptionKey)}
    >
      <NodeResizer isVisible={selected} minWidth={120} minHeight={56} color="#3a6cf4" handleClassName="tool-node__resize-handle" lineClassName="tool-node__resize-line" />
      {SIDES.map(({ position, id, type }) => (
        <Handle
          key={id}
          type={type}
          position={position}
          id={id}
          className={type === 'target' ? 'tool-node__handle tool-node__handle--target' : 'tool-node__handle tool-node__handle--source'}
        />
      ))}
      <div className="tool-node__category">{t(`categories.${tool.category}`)}</div>
      <div className="tool-node__name">{t(tool.nameKey)}</div>
    </div>
  )
}
