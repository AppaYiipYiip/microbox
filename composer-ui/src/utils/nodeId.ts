// Shared node-id counter - used by both PipelineCanvas.tsx (drag-drop from
// the palette) and ComposerPage.tsx (duplicating an existing node), so the
// two creation paths can never hand out the same id.
let counter = 0

export function nextNodeId(): string {
  counter += 1
  return `node-${counter}`
}
