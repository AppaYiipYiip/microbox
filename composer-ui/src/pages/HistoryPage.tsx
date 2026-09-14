import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { groupRunFilesByTool, type RunFile } from '../utils/groupRunFiles'
import './HistoryPage.css'

// Real, not a placeholder as of 2026-09-13 - owner: "i had an image in mind
// where we see all previous run, we can delete some, export some and vew
// what we select." Every real run now gets its own timestamped output
// directory (ui/app.py, results/run_<timestamp>/) instead of one run
// silently overwriting the last one's report - this page lists all of them
// via the real backend's (server/main.py, PLAN.md §6.12 / full-architecture
// Phase 1) /reports-api/runs endpoint, proxied in by vite.config.ts, and
// views/exports a selected one via the same backend's /reports/* static
// file serving. No filesystem/WSL path ever shown to the viewer. Updated
// 2026-09-14: this used to be served by a dev-server-only Vite plugin
// (serve-results-plugin.ts, now retired) - the URL contract is unchanged,
// this component needed zero code changes for the swap.
//
// Updated 2026-09-14 (Phase 2, -with-weblog): /reports-api/runs now also
// returns each run's live `status` (running/completed/failed/unknown),
// computed backend-side from Nextflow's own weblog events plus a liveness
// check on the launching pid - see server/main.py's _compute_run_status for
// why the weblog alone is never trusted for final state. Only runs launched
// through the new backend's POST /api/runs (not yet wired to any UI button -
// that's Phase 3) carry a pid at all; a run launched via the still-separate
// Streamlit path shows "unknown" here exactly as it showed no status at all
// before this change - not a regression, just an honest "nothing to go on".
// While any run in the list is "running", this page polls every 5s instead
// of only on mount/refresh-click, so a real in-progress run's status
// visibly updates without the user needing to click Refresh - short enough
// to feel live, long enough not to hammer the backend for a single local user.
interface RunSummary {
  id: string
  startedAt: string
  hasReport: boolean
  status: 'running' | 'completed' | 'failed' | 'unknown'
}

const RUNS_API = '/reports-api/runs'
const LIVE_POLL_INTERVAL_MS = 5000

function reportUrl(id: string): string {
  return `/reports/${id}/multiqc/multiqc_report.html`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function statusLabelKey(status: RunSummary['status']): string {
  switch (status) {
    case 'running':
      return 'history.statusRunning'
    case 'failed':
      return 'history.statusFailed'
    case 'completed':
      return 'history.statusReady'
    default:
      return 'history.statusNoReport'
  }
}

type ListStatus = 'loading' | 'loaded' | 'error'

export function HistoryPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ListStatus>('loading')
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  // `silent` skips the loading-spinner state - used by the background poll below so a
  // run's status visibly updating every 5s doesn't flash "Loading runs..." over the table
  // each time. The manual Refresh button and the initial load still show it, same as before.
  const loadRuns = useCallback((silent = false) => {
    if (!silent) setStatus('loading')
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

  // Phase 2 (-with-weblog): while looking at the list (not an embedded report), keep
  // polling so a run that's still "running" visibly updates without the user hitting
  // Refresh - the whole point of adding live status server-side. Stops while a report is
  // open (nothing there needs live updates) and on unmount, same discipline as any other
  // effect-driven interval in this codebase.
  useEffect(() => {
    if (selectedRunId !== null) return
    const id = setInterval(() => loadRuns(true), LIVE_POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [selectedRunId, loadRuns])

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

  // Full-UI-architecture Phase 4b (§6.17's results view, values/table half - charts are
  // a separate, not-yet-built piece pending the Sankey tooling decision). Fetched only
  // once a run is actually selected, not eagerly for every row in the list - matches
  // §6.17 critique #7's "lazy-load per-node result content" requirement, one level up
  // (the whole per-tool panel, not yet per-individual-node within it).
  const [runFiles, setRunFiles] = useState<RunFile[]>([])
  useEffect(() => {
    // Nothing to clear/fetch when no run is selected - the results panel only ever
    // renders inside the `if (selectedRun)` branch below, so a stale `runFiles` value
    // while back on the list is simply never shown, not a real leak worth resetting.
    if (!selectedRun) return
    fetch(`${RUNS_API}/${selectedRun.id}/files`)
      .then((response) => {
        if (!response.ok) throw new Error('file list request failed')
        return response.json() as Promise<RunFile[]>
      })
      .then((data) => setRunFiles(data))
      // A failed file listing shouldn't block viewing the MultiQC report itself - the
      // per-tool panel below just stays empty, same "degrade gracefully" pattern as
      // every other secondary-content fetch in this app.
      .catch(() => setRunFiles([]))
  }, [selectedRun])

  if (selectedRun) {
    const resultGroups = groupRunFilesByTool(runFiles)
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
        {resultGroups.length > 0 && (
          <div className="history-page__results">
            <h2>{t('history.perToolResults')}</h2>
            {resultGroups.map((group) => (
              <details key={group.toolId} className="history-page__result-group">
                <summary>
                  {t(group.nameKey)} <span className="history-page__result-count">({group.files.length})</span>
                </summary>
                <ul>
                  {group.files.map((file) => (
                    <li key={file.path}>
                      <a href={`/reports/${selectedRun.id}/${file.path}`} download>
                        {file.path}
                      </a>{' '}
                      <span className="history-page__result-size">{formatFileSize(file.size)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="history-page">
      <div className="history-page__header">
        <h1>{t('history.title')}</h1>
        <button type="button" className="history-page__refresh" onClick={() => loadRuns()}>
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
                <td>{t(statusLabelKey(run.status))}</td>
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
