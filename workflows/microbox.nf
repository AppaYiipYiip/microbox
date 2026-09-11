include { FASTP            } from '../modules/nf-core/fastp/main'
include { FASTQC           } from '../modules/nf-core/fastqc/main'
include { BOWTIE2_BUILD    } from '../modules/nf-core/bowtie2/build/main'
include { BOWTIE2_ALIGN    } from '../modules/nf-core/bowtie2/align/main'
include { MEGAHIT          } from '../modules/nf-core/megahit/main'
include { KRAKEN2_KRAKEN2  } from '../modules/nf-core/kraken2/kraken2/main'
include { MULTIQC          } from '../modules/nf-core/multiqc/main'

workflow MICROBOX {

    take:
    ch_samplesheet // channel: [ meta, [ fastq_1, (fastq_2) ] ]

    main:
    FASTP(
        ch_samplesheet.map { meta, reads -> [ meta, reads, [] ] }, // no adapter_fasta
        false, // discard_trimmed_pass
        false, // save_trimmed_fail
        false  // save_merged
    )

    FASTQC(FASTP.out.reads)

    // Host depletion - optional stage, PLAN.md §6.7 ("every stage optional,
    // no tool hardcoded"). Host genome is always a runtime parameter
    // (params.host_fasta), never bundled - PLAN.md §6.1 owner answer #5
    // ("host organism unknown, different animal species").
    ch_bowtie2_log    = Channel.empty()
    ch_depleted_reads = FASTP.out.reads

    if (!params.skip_host_removal) {
        BOWTIE2_BUILD([ [ id: 'host' ], file(params.host_fasta, checkIfExists: true) ])

        BOWTIE2_ALIGN(
            FASTP.out.reads,
            BOWTIE2_BUILD.out.index,
            [ [ id: 'host' ], [] ], // fasta only needed for CRAM output - not using it
            true,  // save_unaligned: the non-host reads are the actual product of this step
            false  // sort_bam: don't need a sorted alignment for this milestone
        )

        ch_bowtie2_log    = BOWTIE2_ALIGN.out.log.map { meta, f -> f }
        ch_depleted_reads = BOWTIE2_ALIGN.out.fastq
    }

    // Assembly - de novo, no reference/DB needed. MEGAHIT wants reads1/reads2
    // as two SEPARATE path lists (not one combined [r1,r2] list like every
    // other module so far) - easy to get wrong, worth the explicit comment.
    MEGAHIT(
        ch_depleted_reads.map { meta, reads ->
            meta.single_end ? [ meta, reads, [] ] : [ meta, [ reads[0] ], [ reads[1] ] ]
        }
    )

    // Taxonomic classification - runs on the depleted READS (standard
    // metagenomics practice, e.g. nf-core/taxprofiler), not on MEGAHIT's
    // contigs; the two stages are independent, not sequential. Off by
    // default (params.skip_kraken2 = true) even in the test profile: unlike
    // every other test fixture so far (plain URLs Nextflow stages directly),
    // the Kraken2 DB is a whole directory that needs a separate one-time
    // `bin/download-dbs.sh` run first - keeping the zero-setup test profile
    // zero-setup was judged more valuable than testing this by default.
    ch_kraken2_report = Channel.empty()

    if (!params.skip_kraken2) {
        KRAKEN2_KRAKEN2(
            ch_depleted_reads,
            file(params.kraken2_db, checkIfExists: true, type: 'dir'),
            false, // save_output_fastqs
            false  // save_reads_assignment
        )
        ch_kraken2_report = KRAKEN2_KRAKEN2.out.report.map { meta, f -> f }
    }

    ch_multiqc_files = FASTP.out.json.map { meta, f -> f }
        .mix(FASTQC.out.zip.map { meta, f -> f })
        .mix(ch_bowtie2_log)
        .mix(ch_kraken2_report)
        .collect()
        .map { files -> [ [ id: 'multiqc' ], files, [], [], [], [] ] }

    MULTIQC(ch_multiqc_files)

    emit:
    depleted_reads = ch_depleted_reads   // channel: [ meta, [ reads ] ] - host-depleted (or just trimmed, if skipped) reads
    contigs        = MEGAHIT.out.contigs // channel: [ meta, contigs.fa.gz ]
    multiqc_report = MULTIQC.out.report
}
