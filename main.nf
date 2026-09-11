#!/usr/bin/env nextflow

include { MICROBOX } from './workflows/microbox'

workflow {

    ch_samplesheet = Channel
        .fromPath(params.input, checkIfExists: true)
        .splitCsv(header: true)
        .map { row ->
            def meta       = [ id: row.sample, single_end: !row.fastq_2 ]
            def reads       = meta.single_end
                ? [ file(row.fastq_1, checkIfExists: true) ]
                : [ file(row.fastq_1, checkIfExists: true), file(row.fastq_2, checkIfExists: true) ]
            [ meta, reads ]
        }

    MICROBOX(ch_samplesheet)
}
