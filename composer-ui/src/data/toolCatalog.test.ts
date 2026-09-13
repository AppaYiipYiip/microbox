import { describe, it, expect } from 'vitest'
import { TOOL_CATALOG, CATEGORY_ORDER, toolsByCategory } from './toolCatalog'
import en from '../i18n/locales/en.json'

describe('toolCatalog', () => {
  it('every tool has an i18n name/description key that actually resolves in en.json', () => {
    // Catches a typo'd nameKey/descriptionKey before it ships as a blank
    // label in the UI - the failure mode this test exists to prevent.
    for (const tool of TOOL_CATALOG) {
      const entry = (en.tools as Record<string, { name: string; description: string }>)[tool.id]
      expect(entry, `tools.${tool.id} missing from en.json`).toBeDefined()
      expect(entry.name).toBeTruthy()
      expect(entry.description).toBeTruthy()
    }
  })

  it('every tool category has a real category label in en.json', () => {
    for (const category of CATEGORY_ORDER) {
      expect((en.categories as Record<string, string>)[category]).toBeTruthy()
    }
  })

  it('toolsByCategory groups every catalog tool exactly once, under its own category', () => {
    const grouped = toolsByCategory()
    const totalGrouped = Object.values(grouped).reduce((sum, tools) => sum + tools.length, 0)
    expect(totalGrouped).toBe(TOOL_CATALOG.length)
    for (const tool of TOOL_CATALOG) {
      expect(grouped[tool.category]).toContainEqual(tool)
    }
  })
})
