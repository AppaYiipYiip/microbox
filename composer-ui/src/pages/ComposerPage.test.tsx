import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
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
      <MemoryRouter>
        <ComposerPage />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), { status: ok ? 200 : 500 })
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

  it('the pipeline family selector filters the palette (WGS tools hidden under the metagenomics default)', () => {
    renderComposerPage()
    expect(screen.queryByText('BWA-MEM2')).not.toBeInTheDocument()
  })

  it('switching to the WGS family reveals WGS-only tools in the palette', async () => {
    renderComposerPage()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Pipeline' }), 'wgs')
    expect(screen.getByText('BWA-MEM2')).toBeInTheDocument()
    expect(screen.queryByText('fastp')).not.toBeInTheDocument()
  })

  // Full-UI-architecture Phase 3: Composer's Run button goes real - drives an actual
  // POST /api/runs, not a disabled placeholder. `fetch` is mocked here the same way
  // HistoryPage.test.tsx already mocks it for the identical reason (jsdom has no real
  // dev server/backend to hit).
  describe('real Run button (Phase 3)', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('enables Run once the canvas has a node, and opens a real launch dialog', async () => {
      renderComposerPage()
      dropToolOnCanvas('fastp')
      await screen.findByText('fastp')
      const user = userEvent.setup()

      expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
      await user.click(screen.getByRole('button', { name: 'Run' }))

      expect(screen.getByRole('dialog', { name: 'Run this pipeline' })).toBeInTheDocument()
    })

    it('refuses to launch without a samplesheet, with a real, specific message', async () => {
      renderComposerPage()
      dropToolOnCanvas('fastp')
      await screen.findByText('fastp')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Run' }))
      await user.click(screen.getByRole('button', { name: 'Launch' }))

      expect(await screen.findByText('Choose a samplesheet CSV first.')).toBeInTheDocument()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('a real launch POSTs the converted params and samplesheet, and shows the real run id on success', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ run_id: 'run_20260914_120000', pid: 4242 }))
      renderComposerPage()
      dropToolOnCanvas('fastp')
      await screen.findByText('fastp')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Run' }))

      const fileInput = screen.getByLabelText('Samplesheet (CSV)') as HTMLInputElement
      const file = new File(['sample,fastq_1\ntest,a.fq.gz\n'], 'samplesheet.csv', { type: 'text/csv' })
      await user.upload(fileInput, file)
      await user.click(screen.getByRole('button', { name: 'Launch' }))

      expect(await screen.findByText(/Run started \(run_20260914_120000\)/)).toBeInTheDocument()

      expect(fetch).toHaveBeenCalledWith('/api/runs', expect.objectContaining({ method: 'POST' }))
      const [, options] = vi.mocked(fetch).mock.calls[0]
      const body = options?.body as FormData
      expect(body.get('pipeline')).toBe('metagenomics')
      expect(body.get('profile')).toBe('test')
      const params = JSON.parse(body.get('params') as string)
      expect(params.skip_fastp).toBe(false) // the one real node on canvas
      expect(params.skip_fastqc).toBe(true) // never added
      expect((body.get('samplesheet') as File).name).toBe('samplesheet.csv')
    })

    it('shows a real error message when the launch request fails', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('network error'))
      renderComposerPage()
      dropToolOnCanvas('fastp')
      await screen.findByText('fastp')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Run' }))

      const fileInput = screen.getByLabelText('Samplesheet (CSV)') as HTMLInputElement
      await user.upload(fileInput, new File(['x'], 'samplesheet.csv', { type: 'text/csv' }))
      await user.click(screen.getByRole('button', { name: 'Launch' }))

      expect(await screen.findByText(/Couldn't launch the run/)).toBeInTheDocument()
    })
  })
})
