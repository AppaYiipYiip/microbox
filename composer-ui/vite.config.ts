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
      // reverse proxy (nginx or similar) doing the same job; this is
      // exactly the "UI-to-backend connection" PLAN.md §6.12 already flags
      // as real, separate, not-yet-built scope, just far enough along now
      // to let the two existing pieces sit behind one port for local use.
      '/run-app': {
        target: 'http://localhost:8501',
        ws: true,
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
