import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CATEGORY_ORDER, toolsByCategory, type ToolDefinition } from '../data/toolCatalog'
import { matchesSearch } from '../utils/paletteSearch'
import './NodePalette.css'

// Categorized, draggable node source - PLAN.md §6.16's "node palette /
// categorization" must-have. Uses the HTML5 drag-and-drop API directly
// (React Flow's own official pattern for this - not built into the library
// itself, per xyflow's docs: reactflow.dev/examples/interaction/drag-and-drop).
export const DRAG_DATA_FORMAT = 'application/microbox-tool-id'

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const { t } = useTranslation()

  function onDragStart(event: React.DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData(DRAG_DATA_FORMAT, tool.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className="tool-card"
      draggable
      onDragStart={onDragStart}
      title={t(tool.descriptionKey)}
      role="button"
      tabIndex={0}
      aria-label={`${t(tool.nameKey)}: ${t(tool.descriptionKey)}`}
    >
      <span className="tool-card__name">{t(tool.nameKey)}</span>
      <span className="tool-card__description">{t(tool.descriptionKey)}</span>
    </div>
  )
}

export function NodePalette() {
  const { t } = useTranslation()
  const grouped = toolsByCategory()
  // Search matches against the CURRENT language's translated name/
  // description (not the English source strings or raw tool id) - a French
  // speaker searching "classification" should match the French label, not
  // need to know the English one.
  const [query, setQuery] = useState('')

  const filteredByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    tools: grouped[category].filter((tool) => matchesSearch(query, t(tool.nameKey), t(tool.descriptionKey))),
  })).filter((group) => group.tools.length > 0)

  return (
    <aside className="node-palette" aria-label={t('composer.paletteTitle')}>
      <h2 className="node-palette__title">{t('composer.paletteTitle')}</h2>
      <div className="node-palette__search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('composer.paletteSearchPlaceholder')}
          aria-label={t('composer.paletteSearchPlaceholder')}
        />
        {query && (
          <button
            type="button"
            className="node-palette__search-clear"
            onClick={() => setQuery('')}
            aria-label={t('composer.paletteSearchClear')}
            title={t('composer.paletteSearchClear')}
          >
            ×
          </button>
        )}
      </div>
      {filteredByCategory.length === 0 ? (
        <p className="node-palette__no-results">{t('composer.paletteNoResults')}</p>
      ) : (
        filteredByCategory.map(({ category, tools }) => (
          <section key={category} className="node-palette__category">
            <h3 className="node-palette__category-title">{t(`categories.${category}`)}</h3>
            <div className="node-palette__cards">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>
        ))
      )}
    </aside>
  )
}
