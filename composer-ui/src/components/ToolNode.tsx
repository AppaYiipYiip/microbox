import { Handle, NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { TOOL_CATALOG } from '../data/toolCatalog'
import { HANDLE_SIDES } from '../data/nodeDefaults'
import './ToolNode.css'

// Custom React Flow node - PLAN.md §6.16: nodes must be "clickable and
// hoverable". Click-to-select is React Flow's own built-in node selection
// (styled via the `selected` prop it injects); hover uses a plain CSS
// tooltip via the native `title` attribute plus a styled ::after, so it
// works with zero extra JS and is trivially screen-reader-visible too.
//
// `enabled` is optional and defaults to true when absent (not required on
// every node object) so nodes created before this field existed - already on
// a canvas, in an old Save export, in an existing test - don't need a
// migration; PLAN.md §6.11's Pipeline-page refinement calls this out
// explicitly: node state (enabled/skipped/incompatible-connection) needs to
// be visible on the canvas, not just silently enforced.
export type ToolNodeData = { toolId: string; params: Record<string, string>; enabled?: boolean }
export type ToolNodeType = Node<ToolNodeData, 'tool'>

export function ToolNode({ data, selected }: NodeProps<ToolNodeType>) {
  const { t } = useTranslation()
  const tool = TOOL_CATALOG.find((tl) => tl.id === data.toolId)
  if (!tool) return null

  const isEnabled = data.enabled !== false
  const overriddenParams = (tool.params ?? []).filter((param) => (data.params[param.key] ?? '').trim().length > 0)

  // Tooltip shows CURRENT values, not just the static description - PLAN.md
  // §6.11's Pipeline-page refinement: "tooltips should show current values,
  // not defaults." Built here (not extracted as a pure util) since it's
  // tightly coupled to both `t` and the tool's real param labels.
  const tooltipLines = [t(tool.descriptionKey)]
  if (!isEnabled) tooltipLines.push(t('composer.skippedTooltip'))
  for (const param of overriddenParams) {
    tooltipLines.push(`${t(param.labelKey)}: ${data.params[param.key]}`)
  }

  const classNames = ['tool-node']
  if (selected) classNames.push('tool-node--selected')
  if (!isEnabled) classNames.push('tool-node--disabled')

  return (
    <div className={classNames.join(' ')} title={tooltipLines.join('\n')}>
      <NodeResizer isVisible={selected} minWidth={120} minHeight={56} color="#3a6cf4" handleClassName="tool-node__resize-handle" lineClassName="tool-node__resize-line" />
      {/* Exactly 4 handles, one per side, fixed roles (top/left always
          incoming, right/bottom always outgoing) - corrected 2026-09-13
          after owner feedback ("i only asked for 4 in total, not 8"). Shared
          with nodeDefaults.ts/normalizeConnection.ts via HANDLE_SIDES so all
          three can never drift apart on which id means what. */}
      {HANDLE_SIDES.map(({ position, id, type }) => (
        <Handle
          key={id}
          type={type}
          position={position}
          id={id}
          className={type === 'target' ? 'tool-node__handle tool-node__handle--target' : 'tool-node__handle tool-node__handle--source'}
        />
      ))}
      {!isEnabled && <div className="tool-node__skipped-badge">{t('composer.skippedBadge')}</div>}
      <div className="tool-node__category">{t(`categories.${tool.category}`)}</div>
      <div className="tool-node__name">
        {t(tool.nameKey)}
        {overriddenParams.length > 0 && <span className="tool-node__param-dot" aria-hidden="true" />}
      </div>
    </div>
  )
}
