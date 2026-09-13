import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'
import { NodePalette, DRAG_DATA_FORMAT } from './NodePalette'
import { TOOL_CATALOG } from '../data/toolCatalog'

function renderPalette() {
  return render(
    <I18nextProvider i18n={i18n}>
      <NodePalette />
    </I18nextProvider>,
  )
}

describe('NodePalette', () => {
  it('renders every tool in the real catalog, not a hardcoded subset', () => {
    renderPalette()
    for (const tool of TOOL_CATALOG) {
      // toolCatalog.test.ts already confirms these keys resolve to real
      // English text; this test confirms that text actually renders here.
      expect(screen.getByText(i18n.getFixedT('en')(tool.nameKey))).toBeInTheDocument()
    }
  })

  it('dragging a tool card sets the tool id on the drag event, using the shared DRAG_DATA_FORMAT', () => {
    renderPalette()
    const fastpCard = screen.getByRole('button', { name: /fastp/i })

    const dataTransfer = {
      data: {} as Record<string, string>,
      effectAllowed: '',
      setData(format: string, value: string) {
        this.data[format] = value
      },
    }
    fastpCard.dispatchEvent(
      Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer }),
    )

    expect(dataTransfer.data[DRAG_DATA_FORMAT]).toBe('fastp')
  })

  // PLAN.md §6.16 node-palette nice-to-have: "search/filter within the
  // palette."
  it('typing in the search box filters to only matching tools, and clears back to the full list', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByPlaceholderText('Search tools...'), 'kraken')
    expect(screen.getByText('Kraken2')).toBeInTheDocument()
    expect(screen.queryByText('fastp')).not.toBeInTheDocument()
    // A category with no matching tools shouldn't leave an empty header.
    expect(screen.queryByText('Read QC & Trimming')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByText('fastp')).toBeInTheDocument()
  })

  it('shows a "no results" message when nothing matches the search', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByPlaceholderText('Search tools...'), 'not-a-real-tool-name')
    expect(screen.getByText('No tools match your search.')).toBeInTheDocument()
  })
})
