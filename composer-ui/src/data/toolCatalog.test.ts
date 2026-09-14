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

  it('every tool param has an i18n label that actually resolves in en.json', () => {
    for (const tool of TOOL_CATALOG) {
      for (const param of tool.params ?? []) {
        const key = param.labelKey.replace('tools.', '')
        const [toolId, , paramKey] = key.split('.')
        const label = (en.tools as Record<string, { params?: Record<string, string> }>)[toolId]?.params?.[paramKey]
        expect(label, `${param.labelKey} missing from en.json`).toBeTruthy()
      }
    }
  })

  it('filtering by family includes only that family plus shared tools (multiqc/pavian)', () => {
    const wgsOnly = toolsByCategory('wgs')
    const wgsIds = Object.values(wgsOnly)
      .flat()
      .map((t) => t.id)
    expect(wgsIds).toContain('bwamem2')
    expect(wgsIds).toContain('gatk4')
    expect(wgsIds).toContain('multiqc') // shared
    expect(wgsIds).not.toContain('fastp') // metagenomics-only

    const metagenomicsOnly = toolsByCategory('metagenomics')
    const metaIds = Object.values(metagenomicsOnly)
      .flat()
      .map((t) => t.id)
    expect(metaIds).toContain('fastp')
    expect(metaIds).toContain('pavian') // shared
    expect(metaIds).not.toContain('bwamem2')
  })

  it('every real runnable tool (has a skipFlag, or is multiqc) declares at least one resultDir', () => {
    // Phase 4b's results view needs a real place to look for each tool's output -
    // pavian is the one deliberate exception (not part of the Nextflow DAG at all).
    for (const tool of TOOL_CATALOG) {
      if (tool.id === 'pavian') continue
      if (!tool.skipFlag && tool.id !== 'multiqc') continue
      expect(tool.resultDirs?.length, `${tool.id} has no resultDirs`).toBeGreaterThan(0)
    }
  })

  it('every WGS tool with a skipFlag maps to a real nextflow.config param name', () => {
    // Real names, copied from nextflow.config directly - a typo here would
    // silently produce a params file Nextflow ignores rather than erroring.
    const realWgsSkipFlags = new Set([
      'skip_bwamem2',
      'skip_kraken2_wgs',
      'skip_mash',
      'skip_seqkit_stats',
      'skip_gatk4',
    ])
    for (const tool of TOOL_CATALOG.filter((t) => t.family === 'wgs')) {
      if (tool.skipFlag) expect(realWgsSkipFlags.has(tool.skipFlag), tool.id).toBe(true)
    }
  })
})
