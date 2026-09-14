// The categorized node palette's data - deliberately mirrors the REAL pipeline
// stages in workflows/microbox.nf (family 'metagenomics') and workflows/wgs.nf
// (family 'wgs'), not an invented/example toolbox. Each entry's `id` matches
// the actual Nextflow process name (or params.* flag) so this catalog stays
// traceable to the real pipeline, not a fictional one. Categories match
// PLAN.md §6.16's requirements (owner examples: "visualization, classification,
// etc.") applied to this project's actual toolbox.
//
// Updated 2026-09-14 (full-UI-architecture Phase 3, item 1): this catalog now
// drives the real UI-to-engine converter (utils/pipelineConverter.ts), not
// just the canvas display - `family`/`skipFlag`/`assemblerValue` are real
// wiring, grounded in nextflow.config's actual param names, not placeholders.
// WGS tools (bwamem2/kraken2wgs/mash/seqkit/gatk4) added here for the first
// time - workflows/wgs.nf had zero presence in the UI before this.

export type ToolCategory =
  | 'qc'
  | 'hostDepletion'
  | 'assembly'
  | 'classification'
  | 'alignment'
  | 'variantCalling'
  | 'viralDiscovery'
  | 'binning'
  | 'reporting'

// 'shared' = runs in both sibling pipelines (multiqc/pavian) - the converter
// never gates these on canvas presence, matching workflows/*.nf where MULTIQC
// always runs unconditionally in both workflow files.
export type ToolFamily = 'metagenomics' | 'wgs' | 'shared'

export interface ToolParamDefinition {
  // Matches the real params.* name in nextflow.config where one exists
  // (e.g. 'kraken2_db') - the converter reads this value straight through to
  // the generated params file (see utils/pipelineConverter.ts). i18n keys
  // under tools.<toolId>.params.<key>.
  key: string
  labelKey: string
}

export interface ToolDefinition {
  id: string
  category: ToolCategory
  family: ToolFamily
  // i18n keys under tools.<id>.name / tools.<id>.description
  nameKey: string
  descriptionKey: string
  // Deliberately grounded in nextflow.config's real params for this tool -
  // most tools here have none exposed as a per-tool value today (their
  // only "parameter" is a pipeline-level skip_* flag, which isn't a
  // per-node value to edit) - an empty/absent array is honest, not a gap.
  params?: ToolParamDefinition[]
  // The real nextflow.config skip_* flag this node's presence on the canvas
  // controls (utils/pipelineConverter.ts: node present & enabled -> false,
  // absent/disabled -> true). Absent for a tool with no on/off flag at all -
  // multiqc always runs; pavian isn't part of the Nextflow DAG at all
  // (PLAN.md §6.6 item 2, a standalone viewer, not a workflow step).
  skipFlag?: string
  // Only set on the two assembler nodes, which share one flag
  // (skip_megahit gates the whole assembly stage regardless of which
  // assembler runs - see nextflow.config's own comment on params.assembler).
  // Whichever of megahit/metaspades is present sets params.assembler to this
  // value; if a canvas somehow has both, the converter takes the last one
  // seen in TOOL_CATALOG order (megahit) - a real but deliberately unvalidated
  // simplification, not expected in practice since they represent the same
  // pipeline slot.
  assemblerValue?: 'megahit' | 'metaspades'
  // The real Nextflow process name(s) (workflows/microbox.nf / workflows/wgs.nf's own
  // `include { X }` names) this tool's live run status is derived from - full-UI-
  // architecture Phase 4, item "per-node live status." Matched against
  // GET /api/runs/{id}'s `processes` map (utils/nodeRunStatus.ts) by SUFFIX after the
  // last ':' - Nextflow's own weblog events qualify trace.process with the workflow
  // name (confirmed empirically 2026-09-14 against a real run: "MICROBOX:FASTP", not
  // bare "FASTP"), and matching on suffix avoids hardcoding that prefix. Status is keyed
  // by TOOL ID, not canvas node ID - the node-ID-to-`ext.prefix` passthrough that would
  // let two same-tool canvas nodes show independently correct statuses is explicitly
  // deferred (docs/KNOWN_ISSUES.md, this plan's own Phase 3 note); today, two nodes of
  // the same tool show the same status together, a real but deliberate simplification
  // consistent with Option A's fixed pipeline shape (there is genuinely only one real
  // Nextflow invocation per tool slot today, duplicates included - kraken2_predepletion
  // is its own separate catalog concern, not a duplicate 'kraken2' node).
  processNames?: string[]
  // Full-UI-architecture Phase 4b (§6.17 requirement 3, "per-tool result contract" -
  // the file-location half; display mode/chart choice is a separate, not-yet-built
  // piece pending the Sankey tooling decision). The real publishDir path(s) this tool's
  // output lands under, relative to a run's own outdir - copied directly from
  // conf/modules.config / conf/modules_wgs.config's own `path: { "${params.outdir}/..." }`
  // lines, not re-derived or guessed (a tool spanning more than one real process, e.g.
  // bowtie2's separate index/align publishDirs, lists every one - not just the first).
  // Used by the results view (HistoryPage.tsx) to group a run's real files by which tool
  // produced them - `undefined` for a tool with no output of its own to browse (multiqc
  // is the rollup of everything else; pavian isn't part of the Nextflow DAG at all).
  resultDirs?: string[]
}

export const CATEGORY_ORDER: ToolCategory[] = [
  'qc',
  'hostDepletion',
  'alignment',
  'assembly',
  'classification',
  'variantCalling',
  'viralDiscovery',
  'binning',
  'reporting',
]

export const TOOL_CATALOG: ToolDefinition[] = [
  { id: 'fastp', category: 'qc', family: 'metagenomics', nameKey: 'tools.fastp.name', descriptionKey: 'tools.fastp.description', skipFlag: 'skip_fastp', processNames: ['FASTP'], resultDirs: ['fastp'] },
  { id: 'fastqc', category: 'qc', family: 'metagenomics', nameKey: 'tools.fastqc.name', descriptionKey: 'tools.fastqc.description', skipFlag: 'skip_fastqc', processNames: ['FASTQC'], resultDirs: ['fastqc'] },
  {
    id: 'bowtie2',
    category: 'hostDepletion',
    family: 'metagenomics',
    nameKey: 'tools.bowtie2.name',
    descriptionKey: 'tools.bowtie2.description',
    params: [{ key: 'host_fasta', labelKey: 'tools.bowtie2.params.host_fasta' }],
    skipFlag: 'skip_host_removal',
    processNames: ['BOWTIE2_BUILD', 'BOWTIE2_ALIGN'],
    resultDirs: ['bowtie2/index', 'bowtie2/align'],
  },
  { id: 'megahit', category: 'assembly', family: 'metagenomics', nameKey: 'tools.megahit.name', descriptionKey: 'tools.megahit.description', skipFlag: 'skip_megahit', assemblerValue: 'megahit', processNames: ['MEGAHIT'], resultDirs: ['megahit'] },
  { id: 'metaspades', category: 'assembly', family: 'metagenomics', nameKey: 'tools.metaspades.name', descriptionKey: 'tools.metaspades.description', skipFlag: 'skip_megahit', assemblerValue: 'metaspades', processNames: ['SPADES'], resultDirs: ['metaspades'] },
  {
    id: 'kraken2',
    category: 'classification',
    family: 'metagenomics',
    nameKey: 'tools.kraken2.name',
    descriptionKey: 'tools.kraken2.description',
    params: [{ key: 'kraken2_db', labelKey: 'tools.kraken2.params.kraken2_db' }],
    skipFlag: 'skip_kraken2',
    processNames: ['KRAKEN2_KRAKEN2'],
    resultDirs: ['kraken2'],
  },
  { id: 'bracken', category: 'classification', family: 'metagenomics', nameKey: 'tools.bracken.name', descriptionKey: 'tools.bracken.description', skipFlag: 'skip_bracken', processNames: ['BRACKEN_BRACKEN'], resultDirs: ['bracken'] },
  { id: 'quast', category: 'assembly', family: 'metagenomics', nameKey: 'tools.quast.name', descriptionKey: 'tools.quast.description', skipFlag: 'skip_quast', processNames: ['QUAST'], resultDirs: ['quast'] },
  {
    id: 'genomad',
    category: 'viralDiscovery',
    family: 'metagenomics',
    nameKey: 'tools.genomad.name',
    descriptionKey: 'tools.genomad.description',
    params: [{ key: 'genomad_db', labelKey: 'tools.genomad.params.genomad_db' }],
    skipFlag: 'skip_genomad',
    processNames: ['GENOMAD_ENDTOEND'],
    resultDirs: ['genomad'],
  },
  {
    id: 'checkv',
    category: 'viralDiscovery',
    family: 'metagenomics',
    nameKey: 'tools.checkv.name',
    descriptionKey: 'tools.checkv.description',
    params: [{ key: 'checkv_db', labelKey: 'tools.checkv.params.checkv_db' }],
    skipFlag: 'skip_checkv',
    processNames: ['CHECKV_ENDTOEND'],
    resultDirs: ['checkv'],
  },
  { id: 'maxbin2', category: 'binning', family: 'metagenomics', nameKey: 'tools.maxbin2.name', descriptionKey: 'tools.maxbin2.description', skipFlag: 'skip_maxbin2', processNames: ['MAXBIN2'], resultDirs: ['maxbin2'] },

  // ---- WGS-only (workflows/wgs.nf) ----------------------------------------
  {
    id: 'bwamem2',
    category: 'alignment',
    family: 'wgs',
    nameKey: 'tools.bwamem2.name',
    descriptionKey: 'tools.bwamem2.description',
    params: [{ key: 'wgs_reference_fasta', labelKey: 'tools.bwamem2.params.wgs_reference_fasta' }],
    skipFlag: 'skip_bwamem2',
    processNames: ['RENAME_REFERENCE', 'BWAMEM2_INDEX', 'BWAMEM2_MEM', 'SAMTOOLS_STATS'],
    resultDirs: ['wgs/reference', 'wgs/bwamem2/index', 'wgs/bwamem2/align', 'wgs/samtools_stats'],
  },
  {
    id: 'kraken2wgs',
    category: 'classification',
    family: 'wgs',
    nameKey: 'tools.kraken2wgs.name',
    descriptionKey: 'tools.kraken2wgs.description',
    // Same params.kraken2_db as the metagenomics 'kraken2' node - one DB
    // serves both pipeline contexts (workflows/wgs.nf's own comment).
    params: [{ key: 'kraken2_db', labelKey: 'tools.kraken2.params.kraken2_db' }],
    skipFlag: 'skip_kraken2_wgs',
    // `as`-aliased in workflows/wgs.nf (KRAKEN2_KRAKEN2 as KRAKEN2_KRAKEN2_WGS) - the
    // ALIAS is what appears in trace.process, not the module's own base name.
    processNames: ['KRAKEN2_KRAKEN2_WGS'],
    resultDirs: ['wgs/kraken2'],
  },
  {
    id: 'mash',
    category: 'classification',
    family: 'wgs',
    nameKey: 'tools.mash.name',
    descriptionKey: 'tools.mash.description',
    params: [{ key: 'mash_refseq_db', labelKey: 'tools.mash.params.mash_refseq_db' }],
    skipFlag: 'skip_mash',
    processNames: ['MASH_SCREEN'],
    resultDirs: ['wgs/mash'],
  },
  { id: 'seqkit', category: 'qc', family: 'wgs', nameKey: 'tools.seqkit.name', descriptionKey: 'tools.seqkit.description', skipFlag: 'skip_seqkit_stats', processNames: ['SEQKIT_STATS'], resultDirs: ['wgs/seqkit_stats'] },
  {
    id: 'gatk4',
    category: 'variantCalling',
    family: 'wgs',
    nameKey: 'tools.gatk4.name',
    descriptionKey: 'tools.gatk4.description',
    skipFlag: 'skip_gatk4',
    processNames: ['GATK4_CREATESEQUENCEDICTIONARY', 'SAMTOOLS_FAIDX', 'GATK4_HAPLOTYPECALLER', 'GATK4_GENOTYPEGVCFS'],
    resultDirs: ['wgs/gatk4/reference', 'wgs/gatk4/haplotypecaller', 'wgs/gatk4/genotypegvcfs'],
  },

  {
    id: 'multiqc',
    category: 'reporting',
    family: 'shared',
    nameKey: 'tools.multiqc.name',
    descriptionKey: 'tools.multiqc.description',
    processNames: ['MULTIQC'],
    // Two real, distinct publishDirs depending on which pipeline family actually ran
    // (conf/modules.config's plain 'MULTIQC' selector vs. conf/modules_wgs.config's
    // family-scoped 'WGS:MULTIQC' one) - listing both is harmless, since only one will
    // ever have real content for a given run; the results view doesn't need to know
    // which family produced a run to group its files correctly.
    resultDirs: ['multiqc', 'wgs/multiqc'],
  },
  // Pavian (bin/run-pavian.sh + docker-compose.yml) is a standalone
  // interactive report viewer, deliberately NOT wired into
  // workflows/microbox.nf as a DAG step (PLAN.md §6.6 item 2 - it only ever
  // reads an existing run's results/kraken2 or results/bracken output, it
  // doesn't process anything). Included here anyway per owner request
  // 2026-09-13 ("i would love to see it in the pipeline") since this
  // catalog's job is representing every real tool the project has, not
  // strictly the Nextflow DAG - same "reporting" category as MultiQC.
  { id: 'pavian', category: 'reporting', family: 'shared', nameKey: 'tools.pavian.name', descriptionKey: 'tools.pavian.description' },
]

// `family` filters the palette to one pipeline shape at a time (Composer's
// new family selector, ComposerPage.tsx) - 'shared' tools (multiqc/pavian)
// always show regardless of which family is selected, matching that both
// real workflow files actually run MULTIQC unconditionally.
export function toolsByCategory(family?: ToolFamily): Record<ToolCategory, ToolDefinition[]> {
  const grouped = {} as Record<ToolCategory, ToolDefinition[]>
  for (const category of CATEGORY_ORDER) {
    grouped[category] = []
  }
  for (const tool of TOOL_CATALOG) {
    if (family && tool.family !== family && tool.family !== 'shared') continue
    grouped[tool.category].push(tool)
  }
  return grouped
}
