// Shared with src/components/PipelineCanvas.tsx (new nodes dropped from the
// palette) and src/utils/importCanvasSnapshot.ts (nodes reconstructed from an
// imported file that predates width/height being saved, or that omits them
// for any other reason) - kept in one place so the two can't silently drift.
export const DEFAULT_NODE_WIDTH = 180
export const DEFAULT_NODE_HEIGHT = 68
