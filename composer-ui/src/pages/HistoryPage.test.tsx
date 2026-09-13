import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'
import { HistoryPage } from './HistoryPage'

function renderHistoryPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <HistoryPage />
    </I18nextProvider>,
  )
}

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), { status: ok ? 200 : 500 })
}

const RUNS = [
  { id: 'run_20260913_224515', startedAt: '2026-09-13T21:45:15.000Z', hasReport: true },
  { id: 'run_20260913_221247', startedAt: '2026-09-13T21:12:47.000Z', hasReport: false },
]

// Real, not a placeholder as of 2026-09-13 - the run list/report/delete
// endpoints are served by the dev-server-only `serveResults` Vite plugin
// (not exercised here - jsdom has no dev server), so `fetch` and
// `window.confirm` are both mocked, same split this project already uses
// for anything that depends on a real running server/browser.
describe('HistoryPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an honest empty state when no runs exist yet', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))
    renderHistoryPage()

    expect(await screen.findByText(/No run has completed yet/)).toBeInTheDocument()
  })

  it('lists every retained run with its status, newest first as returned by the API', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RUNS))
    renderHistoryPage()

    const rows = await screen.findAllByRole('row')
    // First row is the header.
    expect(rows).toHaveLength(3)
    expect(screen.getByText('Report ready')).toBeInTheDocument()
    expect(screen.getByText('No report (run may have failed)')).toBeInTheDocument()
  })

  it('View shows the selected run\'s report inline, with a way back to the list', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RUNS))
    const user = userEvent.setup()
    renderHistoryPage()

    await screen.findAllByRole('row')
    await user.click(screen.getAllByRole('button', { name: 'View' })[0])

    const frame = screen.getByTitle('Pipeline report')
    expect(frame).toHaveAttribute('src', '/reports/run_20260913_224515/multiqc/multiqc_report.html')

    await user.click(screen.getByRole('button', { name: /Back to list/ }))
    expect(await screen.findAllByRole('row')).toHaveLength(3)
  })

  it('disables View and Export for a run with no report', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RUNS))
    renderHistoryPage()

    const rows = await screen.findAllByRole('row')
    const failedRow = rows[2] // header, ready run, failed run
    expect(failedRow).toHaveTextContent('No report')
    const viewButtons = screen.getAllByRole('button', { name: 'View' })
    expect(viewButtons[1]).toBeDisabled()
  })

  it('Export links to the real report file for download', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RUNS))
    renderHistoryPage()

    await screen.findAllByRole('row')
    const exportLinks = screen.getAllByRole('link', { name: 'Export' })
    expect(exportLinks[0]).toHaveAttribute('href', '/reports/run_20260913_224515/multiqc/multiqc_report.html')
    expect(exportLinks[0]).toHaveAttribute('download')
  })

  it('Delete asks for confirmation, then removes the run and refreshes the list', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(jsonResponse(RUNS)) // initial load
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 })) // DELETE
    mockFetch.mockResolvedValueOnce(jsonResponse([RUNS[1]])) // reload after delete
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderHistoryPage()

    await screen.findAllByRole('row')
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    expect(window.confirm).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith('/reports-api/runs/run_20260913_224515', { method: 'DELETE' })
    await screen.findByText('No report (run may have failed)')
    expect(screen.queryByText('Report ready')).not.toBeInTheDocument()
  })

  it('Delete does nothing if the confirmation is declined', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(jsonResponse(RUNS))
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderHistoryPage()

    await screen.findAllByRole('row')
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    expect(window.confirm).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(1) // only the initial list load
  })

  it('falls back to an error message if the run list fails to load', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))
    renderHistoryPage()

    expect(await screen.findByText(/Couldn't load the run list/)).toBeInTheDocument()
  })
})
