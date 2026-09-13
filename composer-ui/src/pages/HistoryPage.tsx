import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './HistoryPage.css'

// Real, not a placeholder as of 2026-09-13 - owner: "i had an image in mind
// where we see all previous run, we can delete some, export some and vew
// what we select." Every real run now gets its own timestamped output
// directory (ui/app.py, results/run_<timestamp>/) instead of one run
// silently overwriting the last one's report - this page lists all of them
// via the dev-server-only `serveResults` Vite plugin's /reports-api/runs
// endpoint (serve-results-plugin.ts), and views/exports a selected one via
// the same plugin's /reports/* static file serving. No filesystem/WSL path
// ever shown to the viewer.
interface RunSummary {
  id: string
  startedAt: string
  hasReport: boolean
}

const RUNS_API = '/reports-api/runs'

function reportUrl(id: string): string {
  return `/reports/${id}/multiqc/multiqc_report.html`
}

type ListStatus = 'loading' | 'loaded' | 'error'

export function HistoryPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ListStatus>('loading')
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const loadRuns = useCallback(() => {
    setStatus('loading')
    fetch(RUNS_API, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('request failed')
        return response.json() as Promise<RunSummary[]>
      })
      .then((data) => {
        setRuns(data)
        setStatus('loaded')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    // oxlint's set-state-in-effect rule can't see that loadRuns' own
    // setState calls happen inside its async fetch().then()/.catch(), not
    // synchronously in this effect body - see the identical note this
    // project already has on the equivalent single-report version of this
    // page's earlier design.
    // oxlint-disable-next-line react/set-state-in-effect
    loadRuns()
  }, [loadRuns])

  const deleteRun = useCallback(
    (id: string) => {
      if (!window.confirm(t('history.confirmDelete', { id }))) return
      fetch(`${RUNS_API}/${id}`, { method: 'DELETE' })
        .then(() => {
          if (selectedRunId === id) setSelectedRunId(null)
          loadRuns()
        })
        .catch(() => setStatus('error'))
    },
    [loadRuns, selectedRunId, t],
  )

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null

  if (selectedRun) {
    return (
      <div className="history-page">
        <div className="history-page__header">
          <button type="button" className="history-page__back" onClick={() => setSelectedRunId(null)}>
            {t('history.backToList')}
          </button>
          <h1>{new Date(selectedRun.startedAt).toLocaleString()}</h1>
        </div>
        <div className="history-page__report">
          <iframe src={reportUrl(selectedRun.id)} title={t('history.reportTitle')} className="history-page__frame" />
        </div>
      </div>
    )
  }

  return (
    <div className="history-page">
      <div className="history-page__header">
        <h1>{t('history.title')}</h1>
        <button type="button" className="history-page__refresh" onClick={loadRuns}>
          {t('history.refresh')}
        </button>
      </div>
      {status === 'loading' && <p className="history-page__status">{t('history.checking')}</p>}
      {status === 'error' && <p className="history-page__status">{t('history.loadError')}</p>}
      {status === 'loaded' && runs.length === 0 && <p className="history-page__status">{t('history.placeholder')}</p>}
      {status === 'loaded' && runs.length > 0 && (
        <table className="history-page__table">
          <thead>
            <tr>
              <th>{t('history.columnDate')}</th>
              <th>{t('history.columnStatus')}</th>
              <th>{t('history.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{new Date(run.startedAt).toLocaleString()}</td>
                <td>{run.hasReport ? t('history.statusReady') : t('history.statusNoReport')}</td>
                <td className="history-page__actions">
                  <button type="button" disabled={!run.hasReport} onClick={() => setSelectedRunId(run.id)}>
                    {t('history.view')}
                  </button>
                  <a
                    className={run.hasReport ? 'history-page__export' : 'history-page__export history-page__export--disabled'}
                    href={run.hasReport ? reportUrl(run.id) : undefined}
                    download={run.hasReport ? `${run.id}_multiqc_report.html` : undefined}
                    aria-disabled={!run.hasReport}
                  >
                    {t('history.export')}
                  </a>
                  <button type="button" className="history-page__delete" onClick={() => deleteRun(run.id)}>
                    {t('history.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
