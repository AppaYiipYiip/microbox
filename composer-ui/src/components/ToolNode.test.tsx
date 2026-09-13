import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'
import { ToolNode, type ToolNodeType } from './ToolNode'

const NODE_TYPES = { tool: ToolNode }

function renderNode(nodes: ToolNodeType[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ReactFlowProvider>
        <div style={{ width: 400, height: 400 }}>
          <ReactFlow nodes={nodes} edges={[]} nodeTypes={NODE_TYPES} />
        </div>
      </ReactFlowProvider>
    </I18nextProvider>,
  )
}

// Regression test for owner feedback, 2026-09-13: first "i would love to
// connect from up/down and left/right" (which led to 8 handles - a source
// + target pair per side), then corrected the same day: "i only asked for
// 4 in total, not 8... we assume both the left and top are connections to
// previous nodes, while bottom and right are connection to the next
// nodes." Confirms exactly 4 handles now exist, with the fixed
// target/source roles the owner specified - the concrete, verifiable
// requirement behind "4 in total, fixed direction", not just a visual
// check. Rendered through a real ReactFlow instance (not hand-constructed
// NodeProps) so React Flow itself supplies every prop ToolNode actually
// needs, matching how it's really used.
describe('ToolNode', () => {
  it('renders exactly 4 handles - target on top/left, source on right/bottom', () => {
    const nodes: ToolNodeType[] = [{ id: 'n1', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {} } }]

    const { container } = renderNode(nodes)

    const handles = Array.from(container.querySelectorAll('.react-flow__handle'))
    expect(handles).toHaveLength(4)

    const byId = Object.fromEntries(handles.map((h) => [h.getAttribute('data-handleid'), h]))
    expect(Object.keys(byId).sort()).toEqual(['bottom', 'left', 'right', 'top'])

    expect(byId.top).toHaveClass('tool-node__handle--target')
    expect(byId.left).toHaveClass('tool-node__handle--target')
    expect(byId.right).toHaveClass('tool-node__handle--source')
    expect(byId.bottom).toHaveClass('tool-node__handle--source')
  })

  // PLAN.md §6.11: node state (enabled/skipped) "needs to be visible, not
  // just silently enforced" - dimmed styling + a "Skipped" badge, both
  // driven purely by `data.enabled`, not by node selection.
  it('renders dimmed with a Skipped badge when data.enabled is false', () => {
    const nodes: ToolNodeType[] = [{ id: 'n1', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {}, enabled: false } }]
    const { container, getByText } = renderNode(nodes)
    expect(container.querySelector('.tool-node')).toHaveClass('tool-node--disabled')
    expect(getByText('Skipped')).toBeInTheDocument()
  })

  it('does not render the Skipped badge when enabled is true or omitted', () => {
    const nodes: ToolNodeType[] = [{ id: 'n1', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {} } }]
    const { container, queryByText } = renderNode(nodes)
    expect(container.querySelector('.tool-node')).not.toHaveClass('tool-node--disabled')
    expect(queryByText('Skipped')).toBeNull()
  })

  // PLAN.md §6.11: nodes need "a visual distinction between default and
  // user-overridden parameters," and tooltips "should show current values,
  // not defaults."
  it('shows an override dot and the current value in the tooltip when a real param is set', () => {
    const nodes: ToolNodeType[] = [{ id: 'n1', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'kraken2', params: { kraken2_db: '/data/kraken2-db' } } }]
    const { container } = renderNode(nodes)
    expect(container.querySelector('.tool-node__param-dot')).not.toBeNull()
    expect(container.querySelector('.tool-node')?.getAttribute('title')).toContain('/data/kraken2-db')
  })

  it('shows no override dot when the tool has no params set', () => {
    const nodes: ToolNodeType[] = [{ id: 'n1', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'kraken2', params: {} } }]
    const { container } = renderNode(nodes)
    expect(container.querySelector('.tool-node__param-dot')).toBeNull()
  })
})
