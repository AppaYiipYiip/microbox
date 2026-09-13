import { createReadStream, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'

// Dev-server-only API for the real pipeline's results/ directory (../results
// relative to composer-ui/, i.e. the sibling repo root's own output tree -
// workflows/microbox.nf's publishDir target, one run_<timestamp>/ per real
// run since 2026-09-13's ui/app.py change) - owner 2026-09-13: "the full
// interactive report should also be on the app website somehow. i dont
// expect nontechnical people to have to access a path in wsl like that... i
// had an image in mind where we see all previous runs, we can delete some,
// export some and view what we select." Lets HistoryPage.tsx list every
// retained run, and fetch/delete a specific one's files as same-origin
// URLs - no raw filesystem/WSL path ever shown or typed anywhere.
//
// Same dev-server-only caveat as vite.config.ts's Streamlit proxy - a real
// production deployment needs an actual server/reverse-proxy doing this
// job, not a Vite dev plugin (PLAN.md §6.12's still-open UI-to-backend
// scope).
const RESULTS_ROOT = resolve(import.meta.dirname, '../results')
const RUN_DIR_PREFIX = 'run_'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.tsv': 'text/tab-separated-values',
  '.csv': 'text/csv',
}

export interface RunSummary {
  id: string
  // ISO string - parsed from the run_YYYYMMDD_HHMMSS id when it matches
  // that shape (ui/app.py's own naming), falling back to the directory's
  // mtime for anything else (e.g. a manually-created or oddly-named run
  // directory) so a run never silently fails to list just because its name
  // doesn't parse.
  startedAt: string
  hasReport: boolean
}

const RUN_ID_PATTERN = /^run_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/

function parseRunId(id: string, fallbackMtimeMs: number): string {
  const match = RUN_ID_PATTERN.exec(id)
  if (!match) return new Date(fallbackMtimeMs).toISOString()
  const [, year, month, day, hour, minute, second] = match
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).toISOString()
}

function listRuns(): RunSummary[] {
  if (!existsSync(RESULTS_ROOT)) return []
  return readdirSync(RESULTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(RUN_DIR_PREFIX))
    .map((entry) => {
      const dirPath = join(RESULTS_ROOT, entry.name)
      const reportPath = join(dirPath, 'multiqc', 'multiqc_report.html')
      return {
        id: entry.name,
        startedAt: parseRunId(entry.name, statSync(dirPath).mtimeMs),
        hasReport: existsSync(reportPath),
      }
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

// One safety check shared by every handler that takes a run id from the
// URL: it must be a bare directory name directly under RESULTS_ROOT (no
// '/', no '..') and must actually resolve inside RESULTS_ROOT once joined -
// belt-and-suspenders against a path-traversal id like '../../etc'.
function resolveRunDir(id: string): string | null {
  if (!id || id.includes('/') || id.includes('\\') || !id.startsWith(RUN_DIR_PREFIX)) return null
  const dirPath = resolve(join(RESULTS_ROOT, id))
  if (!dirPath.startsWith(RESULTS_ROOT)) return null
  return dirPath
}

function sendJson(res: Connect.IncomingMessage extends never ? never : Parameters<Connect.NextHandleFunction>[1], status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function serveResults(): Plugin {
  return {
    name: 'serve-results',
    configureServer(server) {
      // GET /reports-api/runs - list every retained run, newest first.
      // DELETE /reports-api/runs/<id> - permanently remove one run's whole
      // output directory (its report, logs, everything under it).
      server.middlewares.use('/reports-api/runs', (req, res, next) => {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
        const id = urlPath.replace(/^\/+/, '')

        if (req.method === 'GET' && id === '') {
          sendJson(res, 200, listRuns())
          return
        }

        if (req.method === 'DELETE' && id !== '') {
          const dirPath = resolveRunDir(id)
          if (!dirPath || !existsSync(dirPath)) {
            sendJson(res, 404, { error: 'Run not found' })
            return
          }
          rmSync(dirPath, { recursive: true, force: true })
          sendJson(res, 200, { deleted: id })
          return
        }

        next()
      })

      // Static file serving for a specific run's own files - viewing (an
      // <iframe src>) and exporting (an <a download> to the same URL) both
      // just need a plain, real same-origin GET.
      server.middlewares.use('/reports', (req, res, next) => {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
        const filePath = resolve(join(RESULTS_ROOT, urlPath))
        // Reject anything that escapes RESULTS_ROOT (e.g. a '../' in the
        // URL) - this only ever needs to serve files that are already
        // inside the real results tree.
        if (!filePath.startsWith(RESULTS_ROOT)) {
          res.statusCode = 403
          res.end()
          return
        }
        let stat
        try {
          stat = statSync(filePath)
        } catch {
          next()
          return
        }
        if (!stat.isFile()) {
          next()
          return
        }
        res.setHeader('Content-Type', CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream')
        res.setHeader('Last-Modified', stat.mtime.toUTCString())
        createReadStream(filePath).pipe(res)
      })
    },
  }
}
