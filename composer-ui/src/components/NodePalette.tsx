import { useTranslation } from 'react-i18next'
import { CATEGORY_ORDER, toolsByCategory, type ToolDefinition } from '../data/toolCatalog'
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

  return (
    <aside className="node-palette" aria-label={t('composer.paletteTitle')}>
      <h2 className="node-palette__title">{t('composer.paletteTitle')}</h2>
      {CATEGORY_ORDER.map((category) => (
        <section key={category} className="node-palette__category">
          <h3 className="node-palette__category-title">{t(`categories.${category}`)}</h3>
          <div className="node-palette__cards">
            {grouped[category].map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      ))}
    </aside>
  )
}
