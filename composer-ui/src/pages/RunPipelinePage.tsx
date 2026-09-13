import { useTranslation } from 'react-i18next'
import './RunPipelinePage.css'

// Embeds the real, functioning pipeline launcher (a separate Streamlit/
// Python app, bin/run-ui.sh) as a same-origin page of this app, via Vite's
// dev-server proxy (vite.config.ts, '/run-app' -> the Streamlit port) -
// owner 2026-09-13: "composer and real pipeline should be in the localhost
// port, just different page, just like the home and run history." This is
// the one page in the app that actually runs the pipeline - Composer is a
// design/diagramming tool only (its own Run button is intentionally
// disabled) and does not talk to this page or to Nextflow in any way.
export function RunPipelinePage() {
  const { t } = useTranslation()
  return (
    <div className="run-pipeline-page">
      <iframe src="/run-app" title={t('runPipeline.title')} className="run-pipeline-page__frame" />
    </div>
  )
}
