// What can actually feed what, in the REAL pipeline (workflows/microbox.nf) -
// not a general "any node can connect to any node" graph. The composer
// canvas lets you draw arbitrary connections with no validation today; this
// map is the ground truth used by src/utils/validatePipeline.ts to flag the
// ones that don't correspond to anything the real pipeline can execute.
//
// microbox.nf is a FIXED BACKBONE with independently skippable stages
// (fastp -> FastQC/Bowtie2 -> MEGAHIT|metaSPAdes -> ...), not a freely
// reorderable/mergeable DAG - confirmed by reading the actual channel wiring
// (each entry below cites the specific behavior it's grounded in), not
// assumed from tool names. A node with NO incoming edge is always valid on
// its own (every reads-stage is independently skippable, so e.g. MEGAHIT can
// legitimately be "fed" by the untouched samplesheet if fastp/FastQC/Bowtie2
// are all skipped) - only the edges actually drawn are checked here.
//
// Deliberately does NOT check whether a node has ALL the inputs it needs
// (e.g. MaxBin2 genuinely requires BOTH a contigs edge AND a reads edge
// simultaneously - `ch_contigs.join(ch_depleted_reads)` - a node fed only
// one of the two would still fail in the real pipeline). That's a real, known
// gap, not an oversight - see composer-ui/README.md's Testing/limitations
// notes. This pass only checks "is each individual drawn connection one that
// exists in the real pipeline at all," which is what was asked for and what
// actually caught the mistakes in a real user-drawn graph.
export const VALID_CONNECTIONS: Record<string, string[]> = {
  // fastp's trimmed reads feed FastQC (a QC report, not a further
  // transform), Bowtie2 (host depletion), and - added 2026-09-13, a real
  // R&D-provided reference pipeline diagram - Kraken2 directly, as an
  // independent PRE-depletion classification pass (params.
  // skip_kraken2_predepletion) that runs alongside the existing
  // post-depletion one below, not instead of it. fastp's own JSON report is
  // also one of the files MultiQC aggregates.
  fastp: ['fastqc', 'bowtie2', 'kraken2', 'multiqc'],
  // FastQC doesn't transform reads (its output is a report) - "FastQC's
  // reads" and "fastp's reads" are the same channel, so FastQC validly
  // feeds Kraken2 too, for the same pre-depletion classification pass as
  // fastp above (the R&D diagram draws this exact arrow, FastQC directly to
  // Kraken2, as the primary/solid one). Otherwise a dead end - nothing else
  // downstream consumes FastQC's own output except MultiQC's aggregation.
  fastqc: ['kraken2', 'multiqc'],
  // Bowtie2's depleted reads feed whichever assembler runs, Kraken2 (a
  // SECOND, independent, post-depletion classification pass - fastq entry
  // classifies READS, not contigs - see the ch_classify_input_raw ternary;
  // this is the dotted/optional arrow in the R&D reference diagram, since
  // it only exists when host depletion itself is enabled), and MaxBin2 (one
  // of its two required inputs). Its own log also feeds MultiQC.
  bowtie2: ['megahit', 'metaspades', 'kraken2', 'maxbin2', 'multiqc'],
  // MEGAHIT's contigs feed QUAST, geNomad, and MaxBin2 (its other required
  // input) - MEGAHIT never feeds Kraken2 directly (fastq-entry Kraken2
  // always classifies reads, contigs-entry Kraken2 gets contigs straight
  // from the samplesheet, never from an assembler node). Its log also
  // feeds MultiQC (MultiQC has a native MEGAHIT module).
  megahit: ['quast', 'genomad', 'maxbin2', 'multiqc'],
  // Same contig-consumers as MEGAHIT, EXCEPT MultiQC: confirmed against
  // MultiQC's own module list (docs.seqera.io/multiqc/modules/) that no
  // native SPAdes/metaSPAdes module exists, and the workflow deliberately
  // does not mix spades.log into ch_multiqc_files for exactly that reason.
  metaspades: ['quast', 'genomad', 'maxbin2'],
  // QUAST's report only feeds MultiQC (via QUAST.out.results, not the
  // renamed .tsv - see the Fixed #13 comment in workflows/microbox.nf).
  quast: ['multiqc'],
  // geNomad's flagged sequences feed CheckV for quality grading; its
  // virus-count summary also feeds MultiQC via a custom-content yml.
  genomad: ['checkv', 'multiqc'],
  // CheckV is a dead end in the data flow - only its summary feeds MultiQC.
  checkv: ['multiqc'],
  // Kraken2's report feeds Bracken (re-estimation), MultiQC directly, and
  // is the kind of file Pavian is meant to browse (bin/run-pavian.sh reads
  // results/kraken2/ - not a live pipe, but the real intended "next step").
  kraken2: ['bracken', 'pavian', 'multiqc'],
  // Bracken's re-estimated report is the other kind of file Pavian browses
  // (results/bracken/), and also feeds MultiQC.
  bracken: ['pavian', 'multiqc'],
  // MaxBin2's summary only feeds MultiQC (via a custom-content yml - no
  // native MultiQC module for MaxBin2 either).
  maxbin2: ['multiqc'],
  // Pavian and MultiQC are both terminal viewers/reports - nothing in the
  // real pipeline consumes their output.
  pavian: [],
  multiqc: [],
}
