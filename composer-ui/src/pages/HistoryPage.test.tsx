import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

// Real, not a placeholder as of 2026-09-13 - the report is fetched from
// src/pages/HistoryPage.tsx's REPORT_URL, served by the dev-server-only
// `serveResults` Vite plugin (not exercised here - jsdom has no dev
// server), so `fetch` itself is mocked, same split this project already
// uses for anything that depends on a real running server/browser.
describe('HistoryPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an honest empty state when no report exists yet', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
    renderHistoryPage()

    expect(await screen.findByText(/No run has completed yet/)).toBeInTheDocument()
    expect(screen.queryByTitle('Pipeline report')).not.toBeInTheDocument()
  })

  it('embeds the real report when one exists, showing when it was generated', async () => {
    const lastModified = new Date('2026-09-13T22:42:00Z').toUTCString()
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200, headers: { 'Last-Modified': lastModified } }))
    renderHistoryPage()

    const frame = await screen.findByTitle('Pipeline report')
    expect(frame).toHaveAttribute('src', '/reports/multiqc/multiqc_report.html')
    expect(await screen.findByText(/Report generated/)).toBeInTheDocument()
  })

  it('re-checks for a report when Refresh is clicked', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }))
    const user = userEvent.setup()
    renderHistoryPage()

    await screen.findByText(/No run has completed yet/)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('falls back to the empty state if the fetch itself fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))
    renderHistoryPage()

    await waitFor(() => expect(screen.getByText(/No run has completed yet/)).toBeInTheDocument())
  })
})
