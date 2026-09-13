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

export interface ToolParamDefinition {
  // Matches the real params.* name in nextflow.config where one exists
  // (e.g. 'kraken2_db') - editing this in the composer is a UI-only value
  // today (PLAN.md §6.16 prototype scope), not yet wired to actually
  // produce a -params-file. i18n keys under tools.<toolId>.params.<key>.
  key: string
  labelKey: string
}

export interface ToolDefinition {
  id: string
  category: ToolCategory
  // i18n keys under tools.<id>.name / tools.<id>.description
  nameKey: string
  descriptionKey: string
  // Deliberately grounded in nextflow.config's real params for this tool -
  // most tools here have none exposed as a per-tool value today (their
  // only "parameter" is a pipeline-level skip_* flag, which isn't a
  // per-node value to edit) - an empty/absent array is honest, not a gap.
  params?: ToolParamDefinition[]
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
  {
    id: 'bowtie2',
    category: 'hostDepletion',
    nameKey: 'tools.bowtie2.name',
    descriptionKey: 'tools.bowtie2.description',
    params: [{ key: 'host_fasta', labelKey: 'tools.bowtie2.params.host_fasta' }],
  },
  { id: 'megahit', category: 'assembly', nameKey: 'tools.megahit.name', descriptionKey: 'tools.megahit.description' },
  { id: 'metaspades', category: 'assembly', nameKey: 'tools.metaspades.name', descriptionKey: 'tools.metaspades.description' },
  {
    id: 'kraken2',
    category: 'classification',
    nameKey: 'tools.kraken2.name',
    descriptionKey: 'tools.kraken2.description',
    params: [{ key: 'kraken2_db', labelKey: 'tools.kraken2.params.kraken2_db' }],
  },
  { id: 'bracken', category: 'classification', nameKey: 'tools.bracken.name', descriptionKey: 'tools.bracken.description' },
  { id: 'quast', category: 'assembly', nameKey: 'tools.quast.name', descriptionKey: 'tools.quast.description' },
  {
    id: 'genomad',
    category: 'viralDiscovery',
    nameKey: 'tools.genomad.name',
    descriptionKey: 'tools.genomad.description',
    params: [{ key: 'genomad_db', labelKey: 'tools.genomad.params.genomad_db' }],
  },
  {
    id: 'checkv',
    category: 'viralDiscovery',
    nameKey: 'tools.checkv.name',
    descriptionKey: 'tools.checkv.description',
    params: [{ key: 'checkv_db', labelKey: 'tools.checkv.params.checkv_db' }],
  },
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
