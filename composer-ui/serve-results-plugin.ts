import { createReadStream, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import type { Plugin } from 'vite'

// Dev-server-only static file server for the real pipeline's results/
// directory (../results relative to composer-ui/, i.e. the sibling repo
// root's own output tree - workflows/microbox.nf's publishDir target) -
// owner 2026-09-13: "the full interactive report should also be on the app
// website somehow. i dont expect nontechnical people to have to access a
// path in wsl like that." Lets RunHistoryPage.tsx fetch
// `/reports/multiqc/multiqc_report.html` as a same-origin URL instead of
// needing a raw filesystem/WSL path at all.
//
// Same dev-server-only caveat as vite.config.ts's Streamlit proxy - a real
// production deployment needs an actual server/reverse-proxy doing this
// job, not a Vite dev plugin (PLAN.md §6.12's still-open UI-to-backend
// scope).
const RESULTS_ROOT = resolve(import.meta.dirname, '../results')

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.tsv': 'text/tab-separated-values',
  '.csv': 'text/csv',
}

export function serveResults(): Plugin {
  return {
    name: 'serve-results',
    configureServer(server) {
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
