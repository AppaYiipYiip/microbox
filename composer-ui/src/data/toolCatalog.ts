// The categorized node palette's data - deliberately mirrors the REAL pipeline
// stages in workflows/microbox.nf, not an invented/example toolbox. Each
// entry's `id` matches the actual Nextflow process name (or params.* flag)
// so this catalog stays traceable to the real pipeline, not a fictional one.
// Categories match PLAN.md §6.16's requirements (owner examples: "visualization,
// classification, etc.") applied to this project's actual toolbox.
//
// This is UI-only data for the composer canvas - it does NOT wire up to the
// pipeline yet (PLAN.md §6.16: requirements/prototype only, not scoped to
// actually run anything). name/description are i18n keys, resolved via
// react-i18next in NodePalette/PipelineCanvas, not hardcoded English strings.

export type ToolCategory =
  | 'qc'
  | 'hostDepletion'
  | 'assembly'
  | 'classification'
  | 'viralDiscovery'
  | 'binning'
  | 'reporting'

export interface ToolDefinition {
  id: string
  category: ToolCategory
  // i18n keys under tools.<id>.name / tools.<id>.description
  nameKey: string
  descriptionKey: string
}

export const CATEGORY_ORDER: ToolCategory[] = [
  'qc',
  'hostDepletion',
  'assembly',
  'classification',
  'viralDiscovery',
  'binning',
  'reporting',
]

export const TOOL_CATALOG: ToolDefinition[] = [
  { id: 'fastp', category: 'qc', nameKey: 'tools.fastp.name', descriptionKey: 'tools.fastp.description' },
  { id: 'fastqc', category: 'qc', nameKey: 'tools.fastqc.name', descriptionKey: 'tools.fastqc.description' },
  { id: 'bowtie2', category: 'hostDepletion', nameKey: 'tools.bowtie2.name', descriptionKey: 'tools.bowtie2.description' },
  { id: 'megahit', category: 'assembly', nameKey: 'tools.megahit.name', descriptionKey: 'tools.megahit.description' },
  { id: 'metaspades', category: 'assembly', nameKey: 'tools.metaspades.name', descriptionKey: 'tools.metaspades.description' },
  { id: 'kraken2', category: 'classification', nameKey: 'tools.kraken2.name', descriptionKey: 'tools.kraken2.description' },
  { id: 'bracken', category: 'classification', nameKey: 'tools.bracken.name', descriptionKey: 'tools.bracken.description' },
  { id: 'quast', category: 'assembly', nameKey: 'tools.quast.name', descriptionKey: 'tools.quast.description' },
  { id: 'genomad', category: 'viralDiscovery', nameKey: 'tools.genomad.name', descriptionKey: 'tools.genomad.description' },
  { id: 'checkv', category: 'viralDiscovery', nameKey: 'tools.checkv.name', descriptionKey: 'tools.checkv.description' },
  { id: 'maxbin2', category: 'binning', nameKey: 'tools.maxbin2.name', descriptionKey: 'tools.maxbin2.description' },
  { id: 'multiqc', category: 'reporting', nameKey: 'tools.multiqc.name', descriptionKey: 'tools.multiqc.description' },
]

export function toolsByCategory(): Record<ToolCategory, ToolDefinition[]> {
  const grouped = {} as Record<ToolCategory, ToolDefinition[]>
  for (const category of CATEGORY_ORDER) {
    grouped[category] = []
  }
  for (const tool of TOOL_CATALOG) {
    grouped[tool.category].push(tool)
  }
  return grouped
}
