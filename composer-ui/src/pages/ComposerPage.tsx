import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NodePalette } from '../components/NodePalette'
import { PipelineCanvas } from '../components/PipelineCanvas'
import { TOOL_CATALOG } from '../data/toolCatalog'
import './ComposerPage.css'

export function ComposerPage() {
  const { t } = useTranslation()
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const selectedTool = TOOL_CATALOG.find((tool) => tool.id === selectedToolId) ?? null

  return (
    <div className="composer-page">
      <h1 className="composer-page__title">{t('composer.title')}</h1>
      <div className="composer-page__layout">
        <NodePalette />
        <PipelineCanvas onSelectNode={setSelectedToolId} />
        {selectedTool && (
          <aside className="composer-page__detail" aria-label={t('composer.nodeSelected')}>
            <button type="button" className="composer-page__detail-close" onClick={() => setSelectedToolId(null)}>
              {t('composer.clearSelection')}
            </button>
            <h3>{t(selectedTool.nameKey)}</h3>
            <p>{t(selectedTool.descriptionKey)}</p>
          </aside>
        )}
      </div>
    </div>
  )
}
