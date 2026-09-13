import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'
import { ToolNode, type ToolNodeType } from './ToolNode'

const NODE_TYPES = { tool: ToolNode }

// Regression test for owner feedback, 2026-09-13: "i would love to be able
// to connect the nodes from up and down, and left and right." Confirms all
// 4 sides expose both a source and a target handle with unique ids - the
// concrete, verifiable requirement behind "connect from any direction",
// not just a visual check. Rendered through a real ReactFlow instance
// (not hand-constructed NodeProps) so React Flow itself supplies every
// prop ToolNode actually needs, matching how it's really used.
describe('ToolNode', () => {
  it('renders a source and a target handle on all four sides, each with a unique id', () => {
    const nodes: ToolNodeType[] = [{ id: 'n1', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp' } }]

    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <ReactFlowProvider>
          <div style={{ width: 400, height: 400 }}>
            <ReactFlow nodes={nodes} edges={[]} nodeTypes={NODE_TYPES} />
          </div>
        </ReactFlowProvider>
      </I18nextProvider>,
    )

    const handles = Array.from(container.querySelectorAll('.react-flow__handle'))
    const ids = handles.map((h) => h.getAttribute('data-handleid')).sort()

    expect(ids).toEqual(
      ['bottom-source', 'bottom-target', 'left-source', 'left-target', 'right-source', 'right-target', 'top-source', 'top-target'].sort(),
    )
    expect(container.querySelectorAll('.tool-node__handle--source')).toHaveLength(4)
    expect(container.querySelectorAll('.tool-node__handle--target')).toHaveLength(4)
  })
})
