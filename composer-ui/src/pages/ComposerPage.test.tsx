import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'
import { ComposerPage } from './ComposerPage'
import { DRAG_DATA_FORMAT } from '../components/NodePalette'

// Simulates the exact drag-and-drop code path the app uses (the same
// DRAG_DATA_FORMAT contract NodePalette.test.tsx already verifies
// separately), not a shortcut around it.
function dropToolOnCanvas(toolId: string) {
  const pane = document.querySelector('.react-flow__pane')
  if (!pane) throw new Error('react-flow pane not found')

  const dataTransfer = {
    data: {} as Record<string, string>,
    dropEffect: '',
    getData(format: string) {
      return this.data[format] ?? ''
    },
    setData(format: string, value: string) {
      this.data[format] = value
    },
  }
  dataTransfer.setData(DRAG_DATA_FORMAT, toolId)

  pane.dispatchEvent(Object.assign(new Event('dragover', { bubbles: true }), { dataTransfer, clientX: 100, clientY: 100 }))
  pane.dispatchEvent(Object.assign(new Event('drop', { bubbles: true }), { dataTransfer, clientX: 100, clientY: 100 }))
}

function renderComposerPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ComposerPage />
    </I18nextProvider>,
  )
}

// NOTE on scope: clicking a node to open its detail/param-editing panel,
// and clicking a selected edge's delete (X) button, can't be faithfully
// simulated here - React Flow's node/edge selection relies on pointer-
// capture APIs (setPointerCapture) and real layout measurement jsdom
// doesn't implement, the same class of limitation this codebase already
// accepted for drag-and-drop (NodePalette.test.tsx tests the dataTransfer
// contract, not a full simulated drop-and-render cycle). The underlying
// data-merge logic for parameter editing is unit-tested directly instead
// (src/utils/updateNodeParam.test.ts); the actual click interactions are
// verified via real browser testing (composer-ui/README.md).
describe('ComposerPage', () => {
  it('renders the toolbar (Save, Download Image, Run) and the tool palette', () => {
    renderComposerPage()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    // Disabled on an empty canvas - nothing to render into an image yet,
    // same "disabled with an honest reason" pattern as Run - owner
    // 2026-09-13: "we should have an option to download it as image."
    expect(screen.getByRole('button', { name: 'Download Image' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
    expect(screen.getByText('Tools')).toBeInTheDocument()
  })

  it('dropping a tool from the palette creates a real node on the canvas', async () => {
    renderComposerPage()
    dropToolOnCanvas('fastp')
    expect(await screen.findByText('fastp')).toBeInTheDocument()
  })

  it('enables Download Image once the canvas has at least one node', async () => {
    renderComposerPage()
    dropToolOnCanvas('fastp')
    await screen.findByText('fastp')
    expect(screen.getByRole('button', { name: 'Download Image' })).toBeEnabled()
  })
})
