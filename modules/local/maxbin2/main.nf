// Local (non-nf-core) module, added 2026-09-13 (PLAN.md §4/Phase 4b:
// "MaxBin2 = optional binning stage after assembly"). The official nf-core
// module (modules/nf-core/maxbin2, checked first per CONTRIBUTING.md §1)
// only exposes a single `reads` input to `run_MaxBin.pl -reads`, but this
// pipeline's reads are always paired (fastp/Bowtie2 emit R1+R2 separately)
// and MaxBin2 itself directly supports `-reads`/`-reads2` for exactly this
// case (verified live: `run_MaxBin.pl` --help, and a real end-to-end run
// against gzipped paired FASTQ - both flags accept .fastq.gz directly, no
// pre-decompression needed). Forcing the pair through the nf-core module's
// single-file interface would mean concatenating R1+R2 first for no real
// benefit, so this local module mirrors the nf-core one's structure but
// wires both mates through explicitly instead.
process MAXBIN2 {
    tag "$meta.id"

    // Verified live 2026-09-13 against the real tag nf-core's own maxbin2
    // module uses (fetched from github.com/nf-core/modules/master) - PLAN.md
    // §2.1's own research note had a stale/incorrect tag
    // (`h503566f_8`, doesn't exist) for this exact tool, so this was
    // re-checked against the live source rather than trusted, per this
    // project's own established standard (the same mistake this session
    // already caught once for geNomad/CheckV).
    container 'quay.io/biocontainers/maxbin2:2.2.7--he1b5a44_2'

    input:
    // reads2 is `[]` for a single-end sample (this pipeline's own samplesheet
    // schema allows omitting fastq_2 - meta.single_end tracks this the same
    // way every other module here does) - MaxBin2 itself supports
    // single-ended coverage estimation via `-reads` alone, no `-reads2`.
    tuple val(meta), path(contigs), path(reads1), path(reads2)

    output:
    tuple val(meta), path("*.fasta.gz"), emit: binned_fastas
    tuple val(meta), path("*.summary") , emit: summary
    tuple val(meta), path("*.log")     , emit: log
    tuple val("${task.process}"), val('maxbin2'), eval('run_MaxBin.pl -v | sed "1!d;s/MaxBin //"'), topic: versions

    script:
    def prefix = task.ext.prefix ?: "${meta.id}"
    def reads2_arg = reads2 ? "-reads2 ${reads2}" : ''
    """
    run_MaxBin.pl \\
        -contig ${contigs} \\
        -reads ${reads1} \\
        ${reads2_arg} \\
        -thread ${task.cpus} \\
        -out ${prefix}

    gzip ${prefix}.*.fasta
    """
}
