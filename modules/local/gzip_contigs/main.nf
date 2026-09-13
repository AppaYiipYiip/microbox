// Local (non-nf-core) module. Exists to fix a real bug found 2026-09-11:
// KRAKEN2_KRAKEN2 (modules/nf-core/kraken2/kraken2/main.nf) unconditionally
// passes `--gzip-compressed` to kraken2 - correct for every reads channel
// in this pipeline (fastp/Bowtie2 always emit .fastq.gz) but NOT guaranteed
// for input_type=contigs, where the contigs file comes straight from an
// arbitrary user-supplied samplesheet FASTA. Feeding kraken2 a plain
// (non-gzip) FASTA under that flag doesn't error - gzip decompression
// silently fails and kraken2 just reports "0 sequences processed", a valid-
// looking but empty report. See docs/KNOWN_ISSUES.md #15.
//
// Only ever invoked for files that are NOT already .gz (workflows/
// microbox.nf branches on the extension first) - already-gzipped contigs
// (e.g. MEGAHIT's own *.contigs.fa.gz, or any pre-gzipped input) skip this
// process entirely and go straight to Kraken2.
process GZIP_CONTIGS {
    tag "$meta.id"
    label 'process_single'

    // Reuses this repo's own already-pinned/verified bowtie2 image rather
    // than introducing a new container tag for one `gzip -c` call - it
    // already bundles pigz (see modules/nf-core/bowtie2/align/main.nf).
    container 'community.wave.seqera.io/library/bowtie2_htslib_samtools_pigz:edeb13799090a2a6'

    input:
    tuple val(meta), path(contigs)

    output:
    tuple val(meta), path("*.gz"), emit: gz

    script:
    """
    pigz -p ${task.cpus} -c ${contigs} > ${contigs}.gz
    """
}
