import type { ToolNodeType } from '../components/ToolNode'

// Pure merge logic for editing one node's one parameter, extracted out of
// ComposerPage so it's directly unit-testable. The click-to-select
// interaction that triggers this in the real app can't be faithfully
// simulated in jsdom (React Flow's node selection relies on pointer-
// capture APIs jsdom doesn't implement - the same class of limitation
// already accepted in this codebase for drag-and-drop, see
// NodePalette.test.tsx) - verified instead via real browser testing
// (composer-ui/README.md), with this function covering the actual data
// transformation by itself.
export function updateNodeParam(nodes: ToolNodeType[], nodeId: string, key: string, value: string): ToolNodeType[] {
  return nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } } : n))
}
