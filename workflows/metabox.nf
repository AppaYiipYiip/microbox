include { FASTP   } from '../modules/nf-core/fastp/main'
include { FASTQC  } from '../modules/nf-core/fastqc/main'
include { MULTIQC } from '../modules/nf-core/multiqc/main'

workflow METABOX {

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

    ch_multiqc_files = FASTP.out.json.map { meta, f -> f }
        .mix(FASTQC.out.zip.map { meta, f -> f })
        .collect()
        .map { files -> [ [ id: 'multiqc' ], files, [], [], [], [] ] }

    MULTIQC(ch_multiqc_files)

    emit:
    multiqc_report = MULTIQC.out.report
}
