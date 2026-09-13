import type { ToolNodeType } from '../components/ToolNode'

// Flips one node's enabled/skipped state - extracted as a pure function for
// the same reason updateNodeParam.ts is (directly unit-testable without
// needing React Flow's click-to-select, which jsdom can't simulate - see
// composer-ui/README.md's Testing section). `enabled` defaults to true when
// absent (ToolNode.tsx treats `data.enabled !== false` as enabled), so the
// first toggle on a node that's never had the field set explicitly writes
// `false`, not `undefined`.
export function toggleNodeEnabled(nodes: ToolNodeType[], nodeId: string): ToolNodeType[] {
  return nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, enabled: n.data.enabled === false } } : n))
}
