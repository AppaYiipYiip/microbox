import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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
  { id: 'run_20260913_224515', startedAt: '2026-09-13T21:45:15.000Z', hasReport: true, status: 'completed' as const },
  { id: 'run_20260913_221247', startedAt: '2026-09-13T21:12:47.000Z', hasReport: false, status: 'unknown' as const },
]

// Real, not a placeholder as of 2026-09-13 - the run list/report/delete
// endpoints are served by the real backend (server/main.py, updated
// 2026-09-14 - see that file's own test_main.py for its own real coverage)
// via a Vite proxy (not exercised here - jsdom has no dev server/backend),
// so `fetch` and `window.confirm` are both mocked, same split this project
// already uses for anything that depends on a real running server/browser.
//
// Updated 2026-09-14 (Phase 2): `status` (running/completed/failed/unknown)
// is now part of the real backend's response shape - see server/main.py's
// _compute_run_status. Fake timers cover the 5s live-poll interval added
// below without a real 5-second wait per test.
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

  // Full-UI-architecture Phase 4b (§6.17's results view, values/table half).
  it('View also shows a real per-tool results panel, lazily fetched only once selected', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockImplementation((input) => {
      if (String(input).includes('/files')) {
        return Promise.resolve(
          jsonResponse([
            { path: 'fastp/sample1.fastp.json', size: 512 },
            { path: 'kraken2/sample1.kraken2.report.txt', size: 2048 },
          ]),
        )
      }
      return Promise.resolve(jsonResponse(RUNS))
    })
    const user = userEvent.setup()
    renderHistoryPage()

    await screen.findAllByRole('row')
    // The files fetch must not fire before a run is actually selected - lazy, not eager.
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('/files'))

    await user.click(screen.getAllByRole('button', { name: 'View' })[0])

    expect(await screen.findByText('fastp')).toBeInTheDocument()
    expect(screen.getByText('kraken2/sample1.kraken2.report.txt')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
  })

  it('shows no results panel at all when a run has no matching per-tool files', async () => {
    vi.mocked(fetch).mockImplementation((input) =>
      Promise.resolve(String(input).includes('/files') ? jsonResponse([]) : jsonResponse(RUNS)),
    )
    const user = userEvent.setup()
    renderHistoryPage()

    await screen.findAllByRole('row')
    await user.click(screen.getAllByRole('button', { name: 'View' })[0])

    await screen.findByTitle('Pipeline report')
    expect(screen.queryByText('Results by tool')).not.toBeInTheDocument()
  })

  it('falls back to an error message if the run list fails to load', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))
    renderHistoryPage()

    expect(await screen.findByText(/Couldn't load the run list/)).toBeInTheDocument()
  })

  it('shows a real "Running..." label for a run the backend reports as running', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([{ id: 'run_20260913_224515', startedAt: '2026-09-13T21:45:15.000Z', hasReport: false, status: 'running' }]),
    )
    renderHistoryPage()

    expect(await screen.findByText('Running...')).toBeInTheDocument()
  })

  it('polls for live status every 5s while the list is showing, and stops while a report is open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const mockFetch = vi.mocked(fetch)
    // A fresh Response per call - mockResolvedValue would reuse one Response object whose
    // body can only be read (.json()) once, silently failing every call after the first.
    // URL-aware so the real /files fetch (triggered by View, below) gets a real files-
    // shaped response rather than the runs list.
    mockFetch.mockImplementation((input) =>
      Promise.resolve(String(input).includes('/files') ? jsonResponse([]) : jsonResponse(RUNS)),
    )
    renderHistoryPage()

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const user = userEvent.setup({ delay: null })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(mockFetch).toHaveBeenCalledTimes(2) // initial load + one silent poll

    // Open a report - polling must stop while it's shown, nothing there needs live updates.
    // Selecting a run also fires its own one-time /files fetch (Phase 4b's results
    // panel) - a real, separate call, not part of the list's own live-status poll.
    await user.click(screen.getAllByRole('button', { name: 'View' })[0])
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(mockFetch).toHaveBeenCalledTimes(3) // unchanged - no poll fired while viewing

    vi.useRealTimers()
  })
})
