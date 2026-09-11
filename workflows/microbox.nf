include { FASTP            } from '../modules/nf-core/fastp/main'
include { FASTQC           } from '../modules/nf-core/fastqc/main'
include { BOWTIE2_BUILD    } from '../modules/nf-core/bowtie2/build/main'
include { BOWTIE2_ALIGN    } from '../modules/nf-core/bowtie2/align/main'
include { MEGAHIT          } from '../modules/nf-core/megahit/main'
include { KRAKEN2_KRAKEN2  } from '../modules/nf-core/kraken2/kraken2/main'
include { BRACKEN_BRACKEN  } from '../modules/nf-core/bracken/bracken/main'
include { QUAST            } from '../modules/nf-core/quast/main'
include { MULTIQC          } from '../modules/nf-core/multiqc/main'

workflow MICROBOX {

    take:
    // input_type=fastq:   [ meta, [ fastq_1, (fastq_2) ] ]
    // input_type=contigs: [ meta, contigs.fasta ]
    ch_samplesheet

    main:
    ch_multiqc_files  = Channel.empty()
    ch_bowtie2_log    = Channel.empty()
    ch_depleted_reads = Channel.empty()
    ch_contigs        = Channel.empty()

    if (params.input_type == 'fastq') {
        // --- Read-based stages: only meaningful when starting from raw FASTQ.
        FASTP(
            ch_samplesheet.map { meta, reads -> [ meta, reads, [] ] }, // no adapter_fasta
            false, // discard_trimmed_pass
            false, // save_trimmed_fail
            false  // save_merged
        )
        FASTQC(FASTP.out.reads)
        ch_multiqc_files = ch_multiqc_files
            .mix(FASTP.out.json.map { meta, f -> f })
            .mix(FASTQC.out.zip.map { meta, f -> f })

        // Host depletion - optional stage, PLAN.md §6.7 ("every stage
        // optional, no tool hardcoded"). Host genome is always a runtime
        // parameter (params.host_fasta), never bundled - PLAN.md §6.1 owner
        // answer #5 ("host organism unknown, different animal species").
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
            ch_multiqc_files  = ch_multiqc_files.mix(ch_bowtie2_log)
        }

        // Assembly - de novo, no reference/DB needed. MEGAHIT wants
        // reads1/reads2 as two SEPARATE path lists (not one combined
        // [r1,r2] list like every other module) - easy to get wrong, worth
        // the explicit comment.
        MEGAHIT(
            ch_depleted_reads.map { meta, reads ->
                meta.single_end ? [ meta, reads, [] ] : [ meta, [ reads[0] ], [ reads[1] ] ]
            }
        )
        ch_contigs = MEGAHIT.out.contigs

    } else if (params.input_type == 'contigs') {
        // --- Starting from an existing assembly: everything upstream of
        // contigs (QC, depletion, assembly itself) doesn't apply - there are
        // no reads to trim/deplete/assemble, only contigs to classify/QC.
        // skip_host_removal has no effect here (nothing to skip, no error
        // either - it's just inapplicable, matching PLAN.md §6.7's "any
        // module can be an entry point" rather than making callers guess
        // which flags matter for which entry point).
        ch_contigs = ch_samplesheet
    }

    // Taxonomic classification. Works on either reads (fastq entry) or
    // contigs (contigs entry) - Kraken2 classifies whatever FASTA/FASTQ it's
    // given, so a contigs file is passed through as a "single-end read" for
    // this module's purposes, not literally reinterpreted as short reads.
    // Independent of assembly either way - not a downstream dependency of
    // MEGAHIT/QUAST. Off by default (params.skip_kraken2 = true) even in the
    // test profile: unlike every other test fixture, the Kraken2 DB is a
    // whole directory that needs a separate one-time `bin/download-dbs.sh`
    // run first - keeping the zero-setup test profile zero-setup was judged
    // more valuable than testing this by default.
    ch_kraken2_report = Channel.empty()
    ch_bracken_report = Channel.empty()

    if (!params.skip_kraken2) {
        ch_kraken2_db = file(params.kraken2_db, checkIfExists: true, type: 'dir')

        ch_classify_input = params.input_type == 'contigs'
            ? ch_contigs.map { meta, contigs -> [ meta + [ single_end: true ], contigs ] }
            : ch_depleted_reads

        KRAKEN2_KRAKEN2(
            ch_classify_input,
            ch_kraken2_db,
            false, // save_output_fastqs
            false  // save_reads_assignment
        )
        ch_kraken2_report = KRAKEN2_KRAKEN2.out.report.map { meta, f -> f }

        // Bracken re-estimates abundance from Kraken2's report - needs the
        // *same* DB directory, which the pre-built genome-idx downloads
        // already ship the required *.kmer_distrib files for (no separate
        // bracken-build step). Depends on Kraken2 having run, so nested
        // here rather than given its own top-level `if`; still independently
        // skippable (params.skip_bracken).
        //
        // Auto-skipped entirely for contigs input, regardless of
        // skip_bracken's value - not just "less trustworthy" (the original
        // assumption here), confirmed to genuinely CRASH: Bracken's
        // kmer_distrib files assume ~100bp reads, and treating a whole
        // assembled contig (tens of kb) as one "read" isn't just a bad fit,
        // it breaks Bracken's abundance-redistribution math outright (a
        // Python traceback, not a graceful error). Same pattern as
        // skip_host_removal not applying to contigs input: an inapplicable
        // combination is made to not-happen automatically, not left for the
        // caller to discover by hitting a crash.
        if (!params.skip_bracken && params.input_type != 'contigs') {
            BRACKEN_BRACKEN(KRAKEN2_KRAKEN2.out.report, ch_kraken2_db)
            ch_bracken_report = BRACKEN_BRACKEN.out.txt.map { meta, f -> f }
        }
    }

    // Assembly QC - metagenomic assembly has no single reference genome to
    // compare against (it's a mixed community, not one organism), so fasta/
    // gff stay empty; QUAST falls back to reference-free stats (N50, contig
    // count, etc.). Independently skippable, on by default (no external DB).
    ch_quast_results = Channel.empty()

    if (!params.skip_quast) {
        QUAST(
            ch_contigs,
            [ [ id: 'none' ], [] ], // no reference fasta
            [ [ id: 'none' ], [] ]  // no reference gff
        )
        // MultiQC's QUAST module looks for a file literally named
        // report.tsv - QUAST.out.tsv is a renamed *convenience* symlink
        // (${prefix}.tsv, e.g. test.tsv) that MultiQC does NOT recognize.
        // Found the hard way: QUAST's data was silently absent from every
        // MultiQC report so far (including milestones already called
        // "verified") - it only became visible once a test ran with QUAST
        // as the *only* multiqc input and MultiQC had nothing else to mask
        // the gap. QUAST.out.results (the whole directory, correctly-named
        // report.tsv inside it) is what actually needs to feed MultiQC.
        ch_quast_results = QUAST.out.results.map { meta, dir -> dir }
    }

    ch_multiqc_files = ch_multiqc_files
        .mix(ch_kraken2_report)
        .mix(ch_bracken_report)
        .mix(ch_quast_results)
        // A real, reachable degenerate case, not hypothetical: input_type
        // contigs + skip_quast + Kraken2 left off (its default) leaves
        // nothing at all for MultiQC to summarize. Caught here with a clear,
        // actionable message rather than letting MultiQC run anyway and fail
        // with its own opaque "no analysis results found" - same
        // self-contained-diagnostics principle as the run-report (main.nf),
        // just enforced earlier, before a confusing failure instead of after.
        .ifEmpty { error "Nothing enabled to analyze or report: check input_type, skip_quast, and skip_kraken2 - at least one analysis stage must run." }
        .collect()
        .map { files -> [ [ id: 'multiqc' ], files, [], [], [], [] ] }

    MULTIQC(ch_multiqc_files)

    emit:
    depleted_reads = ch_depleted_reads // channel: [ meta, [ reads ] ] - empty unless input_type=fastq
    contigs        = ch_contigs        // channel: [ meta, contigs.fa(.gz) ]
    multiqc_report = MULTIQC.out.report
}
