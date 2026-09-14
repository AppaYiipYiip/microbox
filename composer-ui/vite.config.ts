/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxies the real, functioning Streamlit launcher (bin/run-ui.sh, a
      // separate Python process on its own port) in as a same-origin page
      // of this app - owner 2026-09-13: "composer and real pipeline should
      // be in the localhost port, just different page, just like the home
      // and run history." Streamlit must be started with the matching
      // `--server.baseUrlPath run-app` (bin/run-ui.sh) so its own internal
      // asset/websocket URLs resolve under this same prefix rather than at
      // the root. `ws: true` is required - Streamlit's live UI updates run
      // over a WebSocket, not just plain HTTP requests.
      //
      // Dev-server-only mechanism (Vite's own proxy, not a production
      // feature) - a real production deployment would need an actual
      // reverse proxy (nginx or similar) doing the same job. Still in use
      // as of full-architecture Phase 1 (server/main.py) - Streamlit's own
      // fate is a deliberate Phase 5 decision point, not resolved yet.
      '/run-app': {
        target: 'http://localhost:8501',
        ws: true,
        changeOrigin: true,
      },
      // Proxies the real backend (server/main.py, PLAN.md §6.12 / full-
      // architecture Phase 1) in the same way - '/reports-api' and
      // '/reports' used to be served by this file's own serveResults()
      // dev-only Vite plugin (composer-ui/serve-results-plugin.ts); that
      // plugin is retired as of this change, not kept alongside a real
      // backend that does the identical job. HistoryPage.tsx needed zero
      // changes - the real backend preserves the exact same URL contract
      // (same paths, same response shapes) on purpose. Run `server/`'s own
      // uvicorn (see server/main.py's own header, or bin/run-server.sh once
      // it exists) on port 8000 for these to resolve.
      '/reports-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/reports': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
