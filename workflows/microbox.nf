include { GZIP_CONTIGS     } from '../modules/local/gzip_contigs/main'
include { MAXBIN2          } from '../modules/local/maxbin2/main'
include { FASTP            } from '../modules/nf-core/fastp/main'
include { FASTQC           } from '../modules/nf-core/fastqc/main'
include { BOWTIE2_BUILD    } from '../modules/nf-core/bowtie2/build/main'
include { BOWTIE2_ALIGN    } from '../modules/nf-core/bowtie2/align/main'
include { MEGAHIT          } from '../modules/nf-core/megahit/main'
include { SPADES           } from '../modules/nf-core/spades/main'
include { KRAKEN2_KRAKEN2  } from '../modules/nf-core/kraken2/kraken2/main'
include { BRACKEN_BRACKEN  } from '../modules/nf-core/bracken/bracken/main'
// Aliased imports for the SECOND, independent pre-depletion classification
// pass (params.skip_kraken2_predepletion, added 2026-09-13) - Nextflow DSL2
// can't call the same process twice in one workflow without an `as` alias
// on a second include, the standard nf-core pattern for reusing a module.
include { KRAKEN2_KRAKEN2 as KRAKEN2_KRAKEN2_PREDEPLETION } from '../modules/nf-core/kraken2/kraken2/main'
include { BRACKEN_BRACKEN as BRACKEN_BRACKEN_PREDEPLETION } from '../modules/nf-core/bracken/bracken/main'
// Real, maintained visualization tool-chain for Kraken2's own report - researched
// 2026-09-14 (full-UI-architecture Phase 4b, §6.17's own reference-image requirement)
// rather than assumed: KrakenTools' kreport2krona.py converts a Kraken2 report into
// Krona's tab-hierarchy text format, then KronaTools' ktImportText renders a real,
// standalone interactive HTML radial chart from it - no external taxonomy database
// needed (unlike ktImportTaxonomy), since kreport2krona already resolves names into
// the text hierarchy itself. Both are real nf-core modules with BioContainers images,
// already used together this exact way by nf-core/taxprofiler in production - not a
// homegrown chart, reused tooling like everything else in this pipeline. Sankey
// (the pipeline's OTHER reference-image chart) was researched the same way and found
// to have no comparably maintained static-output tool - owner decision 2026-09-14:
// Krona only for now, Sankey deferred (docs/planning/PLAN.md, this plan's Phase 4b).
include { KRAKENTOOLS_KREPORT2KRONA } from '../modules/nf-core/krakentools/kreport2krona/main'
include { KRONA_KTIMPORTTEXT        } from '../modules/nf-core/krona/ktimporttext/main'
include { GENOMAD_ENDTOEND } from '../modules/nf-core/genomad/endtoend/main'
include { CHECKV_ENDTOEND  } from '../modules/nf-core/checkv/endtoend/main'
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
    // Declared here (not just inside the fastq-only branch below) so it
    // stays in scope for the pre-depletion Kraken2/Bracken block further
    // down, which needs it but lives outside that branch - same pattern
    // already used for ch_depleted_reads/ch_contigs just below.
    ch_trimmed_reads  = Channel.empty()
    ch_depleted_reads = Channel.empty()
    ch_contigs        = Channel.empty()

    if (params.input_type == 'fastq') {
        // --- Read-based stages: only meaningful when starting from raw FASTQ.
        // Every stage here is now independently toggleable (skip_fastp,
        // skip_fastqc, skip_host_removal, skip_megahit) - toolbox principle
        // PLAN.md §6.7 ("any element can be an entry/exit point") wasn't
        // actually true before 2026-09-11: fastp/FastQC/MEGAHIT had no
        // skip_* flag at all and always ran unconditionally, which both
        // undercounted the pipeline's real combinatorial space (found
        // during a full combinatorics sweep, docs/KNOWN_ISSUES.md) and
        // meant "the last node" could never legitimately be anything but
        // Kraken2 or QUAST on the fastq entry point. ch_trimmed_reads is
        // the "whatever fastp would have produced" channel - either
        // fastp's real output, or the raw samplesheet reads untouched.
        ch_trimmed_reads = ch_samplesheet

        if (!params.skip_fastp) {
            FASTP(
                ch_samplesheet.map { meta, reads -> [ meta, reads, [] ] }, // no adapter_fasta
                false, // discard_trimmed_pass
                false, // save_trimmed_fail
                false  // save_merged
            )
            ch_trimmed_reads = FASTP.out.reads
            ch_multiqc_files = ch_multiqc_files.mix(FASTP.out.json.map { meta, f -> f })
        }

        if (!params.skip_fastqc) {
            FASTQC(ch_trimmed_reads)
            ch_multiqc_files = ch_multiqc_files.mix(FASTQC.out.zip.map { meta, f -> f })
        }

        // Host depletion - optional stage, PLAN.md §6.7 ("every stage
        // optional, no tool hardcoded"). Host genome is always a runtime
        // parameter (params.host_fasta), never bundled - PLAN.md §6.1 owner
        // answer #5 ("host organism unknown, different animal species").
        ch_depleted_reads = ch_trimmed_reads

        if (!params.skip_host_removal) {
            BOWTIE2_BUILD([ [ id: 'host' ], file(params.host_fasta, checkIfExists: true) ])

            BOWTIE2_ALIGN(
                ch_trimmed_reads,
                BOWTIE2_BUILD.out.index,
                [ [ id: 'host' ], [] ], // fasta only needed for CRAM output - not using it
                true,  // save_unaligned: the non-host reads are the actual product of this step
                false  // sort_bam: don't need a sorted alignment for this milestone
            )

            ch_bowtie2_log    = BOWTIE2_ALIGN.out.log.map { meta, f -> f }
            ch_depleted_reads = BOWTIE2_ALIGN.out.fastq
            ch_multiqc_files  = ch_multiqc_files.mix(ch_bowtie2_log)
        }

        // Assembly - de novo, no reference/DB needed. Independently
        // skippable (skip_megahit, added 2026-09-11) - when off, ch_contigs
        // stays empty and QUAST auto-skips below (it has nothing to QC).
        // Which assembler runs is a runtime choice (params.assembler,
        // added 2026-09-12) - PLAN.md §6.6 item 1 flagged this as the one
        // genuinely missing, already-anticipated toolbox addition ("MEGAHIT
        // /metaSPAdes selection are runtime params with sane defaults"),
        // not a new architecture: metaSPAdes slots in as a second producer
        // of the exact same ch_contigs shape (a gzipped contigs FASTA)
        // MEGAHIT already produces, so nothing downstream (Kraken2's
        // GZIP_CONTIGS branch, QUAST, the tool-version topic channel) needed
        // to change to support it.
        if (!params.skip_megahit) {
            if (!(params.assembler in ['megahit', 'metaspades'])) {
                error "params.assembler must be 'megahit' or 'metaspades', got: ${params.assembler}"
            }

            if (params.assembler == 'megahit') {
                // MEGAHIT wants reads1/reads2 as two SEPARATE path lists
                // (not one combined [r1,r2] list like every other module) -
                // easy to get wrong, worth the explicit comment.
                MEGAHIT(
                    ch_depleted_reads.map { meta, reads ->
                        meta.single_end ? [ meta, reads, [] ] : [ meta, [ reads[0] ], [ reads[1] ] ]
                    }
                )
                ch_contigs = MEGAHIT.out.contigs
                // MultiQC has a native MEGAHIT module - it content-sniffs
                // any file for a " - MEGAHIT v" header line in the first 5
                // lines, no special filename required (verified 2026-09-11:
                // docs.seqera.io/multiqc/modules/megahit). Never wired in
                // before Fixed #16, so MEGAHIT-as-the-last-meaningful-stage
                // (skip_quast=true) produced no MultiQC content at all for
                // the assembly itself - found chasing the owner's "no
                // matter what the last node is, there should be a report"
                // requirement.
                ch_multiqc_files = ch_multiqc_files.mix(MEGAHIT.out.log.map { meta, f -> f })
            } else {
                // metaSPAdes = nf-core's generic SPADES module run in
                // --meta mode (conf/modules.config sets ext.args; the
                // module itself has no separate "metaspades" process, only
                // spades.py's own --meta flag distinguishes the mode).
                // Illumina-only for this pipeline (no PacBio/Nanopore
                // samplesheet column exists), so those two tuple slots and
                // the optional yml/hmm inputs are always empty - matches
                // nf-core's own convention for an unused optional path
                // (`[]`, not a placeholder file).
                SPADES(
                    ch_depleted_reads.map { meta, reads -> [ meta, reads, [], [] ] },
                    [], // no --dataset yml
                    []  // no --custom-hmms
                )
                ch_contigs = SPADES.out.contigs
                // Deliberately NOT mixed into ch_multiqc_files the way
                // MEGAHIT's log is above: verified 2026-09-12 (docs.seqera.
                // io/multiqc/modules/, the full assembly-tool module list)
                // that MultiQC has NO native SPAdes/metaSPAdes module at
                // all (only MEGAHIT, HiFiasm, Supernova) - feeding it
                // spades.log would just be silently ignored, adding a file
                // with no payoff rather than real report content. QUAST
                // (below) still covers assembly-quality reporting for a
                // metaSPAdes assembly exactly the same way it does for a
                // MEGAHIT one, since it works from the contigs FASTA
                // itself, not assembler-specific logs - that's what
                // actually satisfies "any node can be last and still get a
                // report" here. Revisit only if MultiQC ever adds SPAdes
                // support upstream.
            }
        }

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

    // Whether there are any contigs at all to run a contigs-only analysis
    // (QUAST, geNomad, CheckV) against - either genuinely true on the
    // contigs entry point, or true on the fastq entry point only if
    // assembly actually ran. Computed once, up front, and reused by every
    // contigs-only stage below rather than each re-deriving it - same
    // "inapplicable combination made to not-happen automatically" guard
    // pattern used throughout this workflow (skip_host_removal-on-contigs,
    // Bracken-on-contigs, and originally just QUAST's own version of this
    // same check before geNomad/CheckV needed it too).
    ch_contigs_present = params.input_type == 'contigs' || !params.skip_megahit

    // Genome binning (MaxBin2) - PLAN.md §4/Phase 4b, "optional binning
    // stage after assembly": clusters a mixed metagenomic assembly's contigs
    // into per-organism bins using MaxBin2's own internal Bowtie2-based
    // coverage estimate + marker-gene EM algorithm. Needs BOTH the contigs
    // AND the reads they were assembled from (for coverage) - unlike
    // Kraken2/geNomad/CheckV/QUAST (which all work from contigs alone), this
    // makes it structurally impossible on the contigs entry point, since no
    // reads exist there at all (ch_depleted_reads stays empty by
    // definition - see its declaration above). Guarded explicitly anyway,
    // same "inapplicable combination made to not-happen automatically, with
    // a clear message" pattern as geNomad-with-no-contigs above, rather than
    // relying on an empty reads channel to fail silently downstream.
    // Off by default (skip_maxbin2 = true): like geNomad/CheckV this is an
    // optional Phase 4 addition, not part of the core MVP path - but unlike
    // those two it doesn't even need an external DB to justify defaulting
    // off, it's genuinely optional by design (PLAN.md's own framing).
    ch_maxbin2_summary = Channel.empty()
    ch_maxbin2_input_available = params.input_type == 'fastq' && !params.skip_megahit

    if (!params.skip_maxbin2 && !ch_maxbin2_input_available) {
        log.warn "skip_maxbin2=false but no assembled contigs+reads are available for binning (needs input_type=fastq with assembly enabled) - skipping it automatically rather than running on nothing."
    }

    if (!params.skip_maxbin2 && ch_maxbin2_input_available) {
        MAXBIN2(
            ch_contigs.join(ch_depleted_reads).map { meta, contigs, reads ->
                meta.single_end ? [ meta, contigs, reads, [] ] : [ meta, contigs, reads[0], reads[1] ]
            }
        )
        ch_maxbin2_summary = MAXBIN2.out.summary.map { meta, f -> f }

        // No native MultiQC module for MaxBin2 (verified 2026-09-13:
        // docs.seqera.io/multiqc/modules/maxbin2 - 404, and not in the full
        // module list either) - same gap as geNomad/CheckV above, same fix:
        // a custom-content `_mqc.yml` summary rather than leaving a run with
        // only MaxBin2 enabled unable to satisfy "any node can be last and
        // still get a report" (Fixed #16). Bin count is a cheap, honest
        // headline number without trying to reproduce MaxBin2's own
        // per-bin completeness/GC table inside MultiQC.
        ch_multiqc_files = ch_multiqc_files.mix(
            MAXBIN2.out.binned_fastas
                .map { meta, fastas -> "    '${meta.id}':\n        n_bins: '${fastas instanceof List ? fastas.size() : 1}'" }
                .collect()
                .map { lines ->
                    ([
                        "id: 'maxbin2_summary'",
                        "section_name: 'MaxBin2 genome binning'",
                        "description: 'Number of bins MaxBin2 produced per sample (docs/planning/PLAN.md §4, Phase 4b).'",
                        "plot_type: 'table'",
                        "pconfig:",
                        "    id: 'maxbin2_summary_table'",
                        "    namespace: 'MaxBin2'",
                        "data:",
                    ] + lines).join('\n') + '\n'
                }
                .collectFile(name: 'maxbin2_summary_mqc.yml', storeDir: "${params.outdir}/pipeline_info")
        )
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

        ch_classify_input_raw = params.input_type == 'contigs'
            ? ch_contigs.map { meta, contigs -> [ meta + [ single_end: true ], contigs ] }
            : ch_depleted_reads

        // Bug found 2026-09-11 (docs/KNOWN_ISSUES.md #15): KRAKEN2_KRAKEN2
        // always passes --gzip-compressed. Every reads channel in this
        // pipeline is guaranteed gzip (fastp/Bowtie2 always emit .fastq.gz),
        // but a contigs file from input_type=contigs is not - it's whatever
        // the user's samplesheet points at. An uncompressed contigs FASTA
        // made kraken2 silently process 0 sequences instead of erroring.
        // Fix: gzip only the files that actually need it (branch on the
        // extension) - already-gzipped contigs (e.g. MEGAHIT's own
        // *.contigs.fa.gz) skip the extra step entirely.
        if (params.input_type == 'contigs') {
            ch_classify_input_raw
                .branch { meta, contigs ->
                    already_gz: contigs.name.endsWith('.gz')
                        return [ meta, contigs ]
                    needs_gz: true
                        return [ meta, contigs ]
                }
                .set { ch_contigs_for_kraken2 }

            GZIP_CONTIGS(ch_contigs_for_kraken2.needs_gz)
            ch_classify_input = ch_contigs_for_kraken2.already_gz.mix(GZIP_CONTIGS.out.gz)
        } else {
            ch_classify_input = ch_classify_input_raw
        }

        KRAKEN2_KRAKEN2(
            ch_classify_input,
            ch_kraken2_db,
            false, // save_output_fastqs
            false  // save_reads_assignment
        )
        ch_kraken2_report = KRAKEN2_KRAKEN2.out.report.map { meta, f -> f }

        // Real Krona radial chart (full-UI-architecture Phase 4b, §6.17) - not
        // independently skippable, same "runs automatically whenever its real input
        // exists" pattern as QUAST auto-running off assembled contigs: this is a cheap,
        // always-useful view of a stage that already ran, not a separate decision the
        // user needs to make. Deliberately only wired for this post-depletion pass for
        // now, not the pre-depletion pass below or WGS's own Kraken2 pass - a real,
        // explicit follow-on (docs/planning/PLAN.md), not an oversight.
        KRAKENTOOLS_KREPORT2KRONA(KRAKEN2_KRAKEN2.out.report)
        KRONA_KTIMPORTTEXT(KRAKENTOOLS_KREPORT2KRONA.out.txt)

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

    // A SECOND, independent Kraken2 classification pass - added 2026-09-13
    // at the owner's request, matching a real reference pipeline diagram
    // their R&D team provided: FastQC's reads feed Kraken2 directly (a
    // solid, primary arrow in that diagram) as well as - separately -
    // Bowtie2's depleted reads feeding Kraken2 (a DOTTED, optional arrow in
    // the same diagram - already what skip_kraken2 above implements, since
    // it's gated behind skip_host_removal being enabled too). Both are
    // genuinely useful and not a duplicate: this pass sees the full
    // community composition INCLUDING host DNA (run right after trimming/
    // QC, before any depletion), while the existing pass above sees the
    // purely-microbial picture. FastQC itself doesn't transform reads (it
    // only emits a report), so "FastQC's reads" and "ch_trimmed_reads" are
    // the same channel - there is no separate transformed channel to
    // classify FastQC's own output from.
    //
    // fastq entry point only - there is no "pre-depletion reads" concept on
    // the contigs entry point (ch_trimmed_reads stays Channel.empty() there,
    // same as ch_depleted_reads) - guarded the same "inapplicable
    // combination made to not-happen automatically" way as
    // skip_host_removal-on-contigs. Same kraken2_db as the pass above - one
    // DB serves both.
    ch_kraken2_predepletion_report = Channel.empty()
    ch_bracken_predepletion_report = Channel.empty()

    if (!params.skip_kraken2_predepletion && params.input_type != 'fastq') {
        log.warn "skip_kraken2_predepletion=false but there are no pre-depletion reads on the contigs entry point (nothing exists before assembly there) - skipping it automatically rather than running on nothing."
    }

    if (!params.skip_kraken2_predepletion && params.input_type == 'fastq') {
        ch_kraken2_predepletion_db = file(params.kraken2_db, checkIfExists: true, type: 'dir')

        KRAKEN2_KRAKEN2_PREDEPLETION(
            ch_trimmed_reads,
            ch_kraken2_predepletion_db,
            false, // save_output_fastqs
            false  // save_reads_assignment
        )
        ch_kraken2_predepletion_report = KRAKEN2_KRAKEN2_PREDEPLETION.out.report.map { meta, f -> f }

        // Same skip_bracken flag as the post-depletion pass above - one
        // toggle for "re-estimate abundance," applied to every Kraken2 pass
        // that's actually running, rather than a second flag no one asked
        // for.
        if (!params.skip_bracken) {
            BRACKEN_BRACKEN_PREDEPLETION(KRAKEN2_KRAKEN2_PREDEPLETION.out.report, ch_kraken2_predepletion_db)
            ch_bracken_predepletion_report = BRACKEN_BRACKEN_PREDEPLETION.out.txt.map { meta, f -> f }
        }
    }

    // Viral/plasmid discovery (geNomad) + quality assessment of what it
    // finds (CheckV) - PLAN.md §9 tool catalogue, the two tools this
    // toolbox's actual vaccine-R&D use case cares about most: finding
    // candidate viral sequences in a metagenomic assembly that a
    // reference-DB-only classifier (Kraken2) could miss entirely if the
    // virus isn't already in its DB. Both work on contigs only, same
    // ch_contigs_present guard as QUAST. Off by default (skip_genomad =
    // true, skip_checkv = true) - same reasoning as Kraken2: both need a
    // whole separate DB directory (`bin/download-dbs.sh genomad` /
    // `checkv`) that isn't part of the zero-setup test profile.
    ch_genomad_virus_summary = Channel.empty()
    ch_checkv_quality_summary = Channel.empty()

    if (!params.skip_genomad && !ch_contigs_present) {
        log.warn "skip_genomad=false but no contigs exist to analyze (skip_megahit=true on a fastq entry) - geNomad needs assembled contigs; skipping it automatically rather than running on nothing."
    }

    if (!params.skip_genomad && ch_contigs_present) {
        ch_genomad_db = file(params.genomad_db, checkIfExists: true, type: 'dir')

        GENOMAD_ENDTOEND(
            ch_contigs,
            [ [ id: 'genomad_db' ], ch_genomad_db ]
        )
        ch_genomad_virus_summary = GENOMAD_ENDTOEND.out.virus_summary.map { meta, f -> f }

        // MultiQC custom-content summary (same `_mqc.yml` auto-detection
        // mechanism already built for tool-version provenance above) -
        // neither geNomad nor CheckV has a native MultiQC module (verified
        // 2026-09-12 against MultiQC's own module list), and unlike
        // metaSPAdes (where QUAST already covers assembly-quality reporting
        // regardless of which assembler ran), a run with ONLY geNomad/
        // CheckV enabled would otherwise have genuinely nothing to satisfy
        // "any node can be last and still get a report" (Fixed #16) -
        // there's no other stage's output that could stand in for it here.
        // Row count minus header = number of virus sequences found, a
        // cheap and honest headline number without trying to reproduce
        // geNomad's own detailed per-contig report inside MultiQC.
        ch_multiqc_files = ch_multiqc_files.mix(
            GENOMAD_ENDTOEND.out.virus_summary
                .map { meta, tsv -> "    '${meta.id}':\n        n_viruses: '${tsv.readLines().size() - 1}'" }
                .collect()
                .map { lines ->
                    ([
                        "id: 'genomad_summary'",
                        "section_name: 'geNomad virus discovery'",
                        "description: 'Number of virus sequences geNomad identified per sample (docs/planning/PLAN.md §9).'",
                        "plot_type: 'table'",
                        "pconfig:",
                        "    id: 'genomad_summary_table'",
                        "    namespace: 'geNomad'",
                        "data:",
                    ] + lines).join('\n') + '\n'
                }
                .collectFile(name: 'genomad_summary_mqc.yml', storeDir: "${params.outdir}/pipeline_info")
        )

        // CheckV grades whatever geNomad flagged as viral - auto-skipped
        // (regardless of skip_checkv's own value) when skip_genomad is on,
        // same "an inapplicable combination is made to not-happen
        // automatically" pattern as Bracken-on-contigs above: there is
        // nothing for CheckV to grade without geNomad having run first.
        //
        // geNomad's virus_fasta output always exists (not `optional: true`
        // in the module) even when it found zero viruses in this sample -
        // a real, common, non-error outcome, not a bug - but feeding CheckV
        // a fasta with no actual sequences in it would be a meaningless run
        // at best and a tool-level error at worst. `.size() > 100` bytes is
        // a deliberately cheap heuristic (an empty gzip stream is ~20
        // bytes; any single real sequence header+bases pushes well past
        // that once compressed) rather than actually decompressing and
        // counting records - good enough to skip the genuinely-empty case
        // without adding a whole extra process just to check.
        if (!params.skip_checkv) {
            ch_checkv_db = file(params.checkv_db, checkIfExists: true, type: 'dir')

            GENOMAD_ENDTOEND.out.virus_fasta
                .filter { meta, fasta -> fasta.size() > 100 }
                .set { ch_checkv_input }

            CHECKV_ENDTOEND(ch_checkv_input, ch_checkv_db)
            ch_checkv_quality_summary = CHECKV_ENDTOEND.out.quality_summary.map { meta, f -> f }

            // Same MultiQC custom-content gap and fix as geNomad's summary
            // above - CheckV has no native MultiQC module either. Row count
            // minus header = number of virus sequences CheckV assessed
            // (a subset of geNomad's count above, since the >100-byte
            // filter can drop the near-empty case before CheckV even runs).
            ch_multiqc_files = ch_multiqc_files.mix(
                CHECKV_ENDTOEND.out.quality_summary
                    .map { meta, tsv -> "    '${meta.id}':\n        n_viruses_assessed: '${tsv.readLines().size() - 1}'" }
                    .collect()
                    .map { lines ->
                        ([
                            "id: 'checkv_summary'",
                            "section_name: 'CheckV quality assessment'",
                            "description: 'Number of geNomad-identified virus sequences CheckV assessed for completeness/contamination (docs/planning/PLAN.md §9).'",
                            "plot_type: 'table'",
                            "pconfig:",
                            "    id: 'checkv_summary_table'",
                            "    namespace: 'CheckV'",
                            "data:",
                        ] + lines).join('\n') + '\n'
                    }
                    .collectFile(name: 'checkv_summary_mqc.yml', storeDir: "${params.outdir}/pipeline_info")
            )
        }
    }

    // Assembly QC - metagenomic assembly has no single reference genome to
    // compare against (it's a mixed community, not one organism), so fasta/
    // gff stay empty; QUAST falls back to reference-free stats (N50, contig
    // count, etc.). Independently skippable, on by default (no external DB).
    //
    // Auto-skipped (with a warning, not a silent no-op and not a hard
    // error) whenever there are genuinely no contigs to QC - either
    // input_type=fastq with skip_megahit=true, or (structurally impossible
    // today, guarded anyway for when a future entry point might add it)
    // any other case with an empty ch_contigs. Same "inapplicable
    // combination made to not-happen automatically" pattern as
    // skip_host_removal-on-contigs and Bracken-on-contigs above.
    ch_quast_results = Channel.empty()

    if (!params.skip_quast && !ch_contigs_present) {
        log.warn "skip_quast=false but no contigs exist to QC (skip_megahit=true on a fastq entry) - QUAST needs assembled contigs; skipping it automatically rather than running on nothing."
    }

    if (!params.skip_quast && ch_contigs_present) {
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

    ch_multiqc_files_guarded = ch_multiqc_files
        .mix(ch_kraken2_report)
        .mix(ch_bracken_report)
        .mix(ch_kraken2_predepletion_report)
        .mix(ch_bracken_predepletion_report)
        .mix(ch_quast_results)
        // A real, reachable degenerate case, not hypothetical: input_type
        // contigs + skip_quast + Kraken2 left off (its default) leaves
        // nothing at all for MultiQC to summarize - and since 2026-09-11
        // fastp/FastQC/MEGAHIT are all independently skippable too, the
        // fastq entry point can reach the exact same degenerate state.
        // Caught here with a clear, actionable message rather than letting
        // MultiQC run anyway and fail with its own opaque "no analysis
        // results found" - same self-contained-diagnostics principle as the
        // run-report (main.nf), just enforced earlier, before a confusing
        // failure instead of after.
        .ifEmpty { error "Nothing enabled to analyze or report: check input_type and the skip_* flags - at least one analysis stage must run." }

    // ---- Tool-version provenance --------------------------------------
    // Galaxy/nf-core norm (researched 2026-09-11, owner: "what is the norm
    // in this? compare different similar software"): Galaxy records the
    // exact tool+dependency version for every step, not just parameters;
    // nf-core is migrating every pipeline in 2026 to exactly the pattern
    // already used here - each module emits tuple(process, tool, version)
    // to the `versions` topic channel (Nextflow 25.04+). Every module in
    // this repo already emits to that topic; nothing ever subscribed to it
    // until now, so the FAIR run-report's "tool versions" promise (PLAN.md
    // §7.2/§6.7) wasn't actually being kept - a real gap, not a style
    // choice. Two outputs: a plain per-process listing under pipeline_info/
    // (always present, human-readable, referenced from the run-report), and
    // a MultiQC custom-content file (the `_mqc.yml` suffix is auto-detected
    // by MultiQC, no --config needed) so a "Software Versions" table shows
    // up in the MultiQC report itself, regardless of which analysis stage
    // ran - closing the "a report must exist no matter what the last node
    // was" gap the same way MEGAHIT's own log now does for assembly stats.
    //
    // Deliberately mixed in AFTER the ifEmpty guard above, not before: this
    // channel always emits exactly one file even when zero processes ran at
    // all (Channel.topic('versions') closes empty, but .collect() on an
    // empty channel still emits one empty list) - including it before the
    // guard would silently defeat the "at least one real stage must run"
    // check.
    // Keyed by "process (tool)", not by process or tool alone: neither is
    // unique on its own. Two processes can share a tool (BOWTIE2_BUILD and
    // BOWTIE2_ALIGN both report "bowtie2"), AND a single process can report
    // several tools (BOWTIE2_ALIGN alone reports bowtie2 + samtools + pigz
    // - it pipes through all three internally). Either alone produces
    // duplicate keys in the YAML `data:` mapping below, which is invalid/
    // undefined for a YAML mapping and silently drops entries. Found and
    // fixed twice in a row while smoke-testing this change - worth the
    // explicit comment so the next edit here doesn't reintroduce it.
    ch_versions_yaml = Channel.topic('versions')
        .unique()
        .map { process, tool, version -> "${process} (${tool}):\n  version: '${version}'" }
        .collect()
        .map { lines -> (["# microbox tool versions (this run), keyed by \"Nextflow process (tool)\""] + lines.sort()).join('\n') + '\n' }
        .collectFile(name: 'software_versions.yml', storeDir: "${params.outdir}/pipeline_info")

    ch_versions_mqc = Channel.topic('versions')
        .unique()
        .map { process, tool, version -> "    '${process} (${tool})':\n        tool: '${tool}'\n        version: '${version}'" }
        .collect()
        .map { lines ->
            ([
                "id: 'software_versions'",
                "section_name: 'Software Versions'",
                "description: 'Tool versions collected at run time from each process as it ran (docs/planning/PLAN.md §7.2 FAIR provenance).'",
                "plot_type: 'table'",
                "pconfig:",
                "    id: 'software_versions_table'",
                "    namespace: 'Software Versions'",
                "data:",
            ] + lines.sort()).join('\n') + '\n'
        }
        .collectFile(name: 'software_versions_mqc.yml', storeDir: "${params.outdir}/pipeline_info")

    ch_multiqc_files = ch_multiqc_files_guarded
        .mix(ch_versions_mqc)
        .collect()
        .map { files -> [ [ id: 'multiqc' ], files, [], [], [], [] ] }

    MULTIQC(ch_multiqc_files)

    emit:
    depleted_reads        = ch_depleted_reads         // channel: [ meta, [ reads ] ] - empty unless input_type=fastq
    contigs               = ch_contigs                // channel: [ meta, contigs.fa(.gz) ]
    genomad_virus_summary = ch_genomad_virus_summary  // channel: path to *_virus_summary.tsv - empty unless skip_genomad=false
    checkv_quality_summary = ch_checkv_quality_summary // channel: path to quality_summary.tsv - empty unless skip_genomad=false and skip_checkv=false
    maxbin2_summary        = ch_maxbin2_summary       // channel: path to *.summary (bin completeness/GC table) - empty unless skip_maxbin2=false
    multiqc_report        = MULTIQC.out.report
    versions_yaml         = ch_versions_yaml          // channel: path to pipeline_info/software_versions.yml
}
