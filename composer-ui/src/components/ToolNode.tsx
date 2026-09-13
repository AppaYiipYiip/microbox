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

export function ToolNode({ data, selected }: NodeProps<ToolNodeType>) {
  const { t } = useTranslation()
  const tool = TOOL_CATALOG.find((tl) => tl.id === data.toolId)
  if (!tool) return null

  return (
    <div
      className={selected ? 'tool-node tool-node--selected' : 'tool-node'}
      title={t(tool.descriptionKey)}
    >
      <Handle type="target" position={Position.Left} />
      <div className="tool-node__category">{t(`categories.${tool.category}`)}</div>
      <div className="tool-node__name">{t(tool.nameKey)}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
