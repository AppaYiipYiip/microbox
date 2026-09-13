import { describe, it, expect } from 'vitest'
import { EMPTY_HISTORY, pushSnapshot, undo, redo, type CanvasSnapshot } from './history'

const snapshotA: CanvasSnapshot = { nodes: [{ id: 'a', type: 'tool', position: { x: 0, y: 0 }, data: { toolId: 'fastp', params: {} } }], edges: [] }
const snapshotB: CanvasSnapshot = { nodes: [{ id: 'a', type: 'tool', position: { x: 10, y: 0 }, data: { toolId: 'fastp', params: {} } }], edges: [] }
const snapshotC: CanvasSnapshot = { nodes: [{ id: 'a', type: 'tool', position: { x: 20, y: 0 }, data: { toolId: 'fastp', params: {} } }], edges: [] }

describe('history', () => {
  it('undo on an empty history is a no-op (returns null)', () => {
    expect(undo(EMPTY_HISTORY, snapshotA)).toBeNull()
  })

  it('redo on an empty future is a no-op (returns null)', () => {
    expect(redo(EMPTY_HISTORY, snapshotA)).toBeNull()
  })

  it('undo restores the last pushed snapshot and moves the current state to future', () => {
    const afterPush = pushSnapshot(EMPTY_HISTORY, snapshotA)
    const result = undo(afterPush, snapshotB)
    expect(result?.snapshot).toBe(snapshotA)
    expect(result?.history.past).toHaveLength(0)
    expect(result?.history.future).toEqual([snapshotB])
  })

  it('redo replays a snapshot moved to future by undo', () => {
    const afterPush = pushSnapshot(EMPTY_HISTORY, snapshotA)
    const afterUndo = undo(afterPush, snapshotB)!
    const result = redo(afterUndo.history, afterUndo.snapshot)
    expect(result?.snapshot).toBe(snapshotB)
    expect(result?.history.future).toHaveLength(0)
    expect(result?.history.past).toEqual([snapshotA])
  })

  it('pushing a new snapshot after an undo discards the redo future', () => {
    const afterPush = pushSnapshot(EMPTY_HISTORY, snapshotA)
    const afterUndo = undo(afterPush, snapshotB)!
    const afterNewPush = pushSnapshot(afterUndo.history, snapshotC)
    expect(afterNewPush.future).toHaveLength(0)
    expect(afterNewPush.past).toEqual([snapshotC])
  })

  it('caps history length at maxHistory, dropping the oldest entries', () => {
    let history = EMPTY_HISTORY
    history = pushSnapshot(history, snapshotA, 2)
    history = pushSnapshot(history, snapshotB, 2)
    history = pushSnapshot(history, snapshotC, 2)
    expect(history.past).toEqual([snapshotB, snapshotC])
  })
})
