import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './HistoryPage.css'

// Real, not a placeholder as of 2026-09-13 - owner: "the full interactive
// report should also be on the app website somehow. i dont expect
// nontechnical people to have to access a path in wsl like that... i assume
// we can read the content of the report in a dedicated page added via
// navigation sidebar." REPORT_URL is served by the dev-server-only
// `serveResults` Vite plugin (serve-results-plugin.ts, ../vite.config.ts),
// which exposes the real pipeline's results/ directory (workflows/
// microbox.nf's publishDir target) as same-origin URLs - no filesystem/WSL
// path ever shown to the viewer.
const REPORT_URL = '/reports/multiqc/multiqc_report.html'

type ReportStatus = 'checking' | 'found' | 'missing'

export function HistoryPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ReportStatus>('checking')
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  // HEAD, not GET - only the existence + Last-Modified header are needed
  // here; the actual report content loads separately via the <iframe>'s own
  // GET request below, not duplicated into this fetch.
  const checkForReport = useCallback(() => {
    setStatus('checking')
    fetch(REPORT_URL, { method: 'HEAD', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          setStatus('missing')
          return
        }
        const lastModified = response.headers.get('Last-Modified')
        setGeneratedAt(lastModified ? new Date(lastModified).toLocaleString() : null)
        setStatus('found')
      })
      .catch(() => setStatus('missing'))
  }, [])

  useEffect(() => {
    // oxlint's set-state-in-effect rule can't see that checkForReport's own
    // setState calls happen inside its async fetch().then()/.catch() (i.e.
    // genuinely later, once a real external system - the results file -
    // responds), not synchronously in this effect body, which is what that
    // rule actually guards against. A real "fetch on mount" is exactly what
    // useEffect is for.
    // oxlint-disable-next-line react/set-state-in-effect
    checkForReport()
  }, [checkForReport])

  return (
    <div className="history-page">
      <div className="history-page__header">
        <h1>{t('history.title')}</h1>
        <button type="button" className="history-page__refresh" onClick={checkForReport}>
          {t('history.refresh')}
        </button>
      </div>
      {status === 'checking' && <p className="history-page__status">{t('history.checking')}</p>}
      {status === 'missing' && <p className="history-page__status">{t('history.placeholder')}</p>}
      {status === 'found' && (
        <div className="history-page__report">
          {generatedAt && <p className="history-page__generated-at">{t('history.generatedAt', { date: generatedAt })}</p>}
          <iframe src={REPORT_URL} title={t('history.reportTitle')} className="history-page__frame" />
        </div>
      )}
    </div>
  )
}
