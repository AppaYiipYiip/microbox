// Local (non-nf-core) module. Exists to fix a real bug found 2026-09-14:
// GATK4_CREATESEQUENCEDICTIONARY (modules/nf-core/gatk4/createsequencedictionary/
// main.nf) fails with "File is not a supported reference file type" whenever
// the reference fasta's staged filename has no recognized extension
// (htsjdk's ReferenceSequenceFileFactory determines file type strictly from
// the filename). This is a real, reachable case in this pipeline, not
// hypothetical: params.wgs_reference_fasta commonly points at an NCBI
// efetch URL (e.g. the same pattern conf/test.config already uses for the
// metagenomics pipeline's host_fasta) - those URLs have no filename with an
// extension at all, so Nextflow stages the downloaded file under the URL's
// literal CGI script name ("efetch.fcgi"), which BWA-MEM2 tolerates fine
// (extension-agnostic) but GATK4 does not.
//
// Renames/copies the reference once, giving every downstream WGS stage
// (BWA-MEM2, GATK4, and anything added later) a consistently-named
// reference.fasta regardless of how params.wgs_reference_fasta was sourced -
// simpler and more robust than teaching every consumer about the source
// URL's quirks individually.
process RENAME_REFERENCE {
    tag "$meta.id"
    label 'process_single'

    // Reuses this repo's own already-pinned/verified bowtie2 image rather
    // than introducing a new container tag for one `cp` call - same
    // reasoning as modules/local/gzip_contigs/main.nf.
    container 'community.wave.seqera.io/library/bowtie2_htslib_samtools_pigz:edeb13799090a2a6'

    input:
    tuple val(meta), path(fasta)

    output:
    tuple val(meta), path("reference.fasta"), emit: fasta

    script:
    """
    cp -L ${fasta} reference.fasta
    """
}
