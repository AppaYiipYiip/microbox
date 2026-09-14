include { KRAKEN2_KRAKEN2 as KRAKEN2_KRAKEN2_WGS } from '../modules/nf-core/kraken2/kraken2/main'
include { MASH_SCREEN    } from '../modules/nf-core/mash/screen/main'
include { SEQKIT_STATS   } from '../modules/nf-core/seqkit/stats/main'
include { RENAME_REFERENCE } from '../modules/local/rename_reference/main'
include { BWAMEM2_INDEX  } from '../modules/nf-core/bwamem2/index/main'
include { BWAMEM2_MEM    } from '../modules/nf-core/bwamem2/mem/main'
include { SAMTOOLS_STATS } from '../modules/nf-core/samtools/stats/main'
include { GATK4_CREATESEQUENCEDICTIONARY } from '../modules/nf-core/gatk4/createsequencedictionary/main'
include { SAMTOOLS_FAIDX        } from '../modules/nf-core/samtools/faidx/main'
include { GATK4_HAPLOTYPECALLER } from '../modules/nf-core/gatk4/haplotypecaller/main'
include { GATK4_GENOTYPEGVCFS   } from '../modules/nf-core/gatk4/genotypegvcfs/main'
include { MULTIQC        } from '../modules/nf-core/multiqc/main'

// Pathogen/isolate WGS sibling pipeline (docs/planning/PLAN.md §6.9 -
// promoted from "evaluated, not built" to an owner-directed requirement
// 2026-09-14: "option A is more work but more reward"). A DELIBERATE
// sibling to MICROBOX (workflows/microbox.nf), not a branch bolted onto it -
// this answers a different scientific question ("how does this ONE isolate's
// genome compare to a reference - strain, mutations") than metagenomics'
// "what's the mixed community in this sample", so it gets its own samplesheet
// shape (assets/schema_input_wgs.json) and its own workflow file, while
// sharing everything that isn't metagenomics-specific: Docker-per-tool via
// nf-core module containers, conf/base.config resourceLimits, always-on
// trace/report/dag (nextflow.config), the results/ publishDir convention,
// MultiQC aggregation, and the versions-topic provenance pattern below -
// copied from workflows/microbox.nf's tail, not reinvented.
//
// Phase 1 (done): plumbing only, zero tool stages, explicit error when
// invoked. Phase 2 (this version): first real stage - BWA-MEM2 reference-
// guided alignment. One reference serves every sample in a run (many
// isolates of the same organism vs. one reference - assets/
// schema_input_wgs.json), so the index is built once and reused per sample,
// not a per-row samplesheet column.
workflow WGS {

    take:
    // [ meta, [ fastq_1, (fastq_2) ] ] - built in main.nf, same shape as
    // MICROBOX's input_type=fastq branch.
    ch_samplesheet

    main:
    ch_multiqc_files = Channel.empty()
    ch_aligned_bam   = Channel.empty()
    ch_final_vcf     = Channel.empty()

    // ---- Pre-flight species/contamination screening --------------------
    // Runs on raw reads, before alignment - both stages independently
    // toggleable, not a forced either/or (owner, 2026-09-14: "keep both,
    // allow the user to pick whatever they want, as long as they are both
    // functional"). Researched first (owner: "google to make sure we would
    // be providing something useful, not wasting time"): real bacterial WGS
    // QC pipelines most commonly use Kraken2 as the primary species/
    // contamination gate; Mash Screen is also real and used in the field
    // for a different specific signal (fast genome-distance estimation,
    // public-health plasmid-transmission surveillance) - both genuinely
    // useful, for different reasons. Non-blocking: an unexpected screening
    // result logs/reports but never stops BWA-MEM2/GATK4 from running,
    // same "warn, don't crash" philosophy as the rest of this repo.
    if (!params.skip_kraken2_wgs) {
        // Reuses the exact same module/DB as the metagenomics pipeline
        // (params.kraken2_db) via an `as`-aliased include - same tool, same
        // job, different pipeline context, not a second copy. Matches
        // workflows/microbox.nf's own ch_kraken2_db construction verbatim.
        ch_kraken2_db_wgs = file(params.kraken2_db, checkIfExists: true, type: 'dir')
        KRAKEN2_KRAKEN2_WGS(
            ch_samplesheet,
            ch_kraken2_db_wgs,
            false, // save_output_fastqs
            false  // save_reads_assignment
        )
        ch_multiqc_files = ch_multiqc_files.mix(KRAKEN2_KRAKEN2_WGS.out.report.map { meta, f -> f })
    }

    if (!params.skip_mash) {
        if (!params.mash_refseq_db) {
            error "params.mash_refseq_db must be set when skip_mash=false - the real external RefSeq sketch DB is required (bin/download-dbs.sh mash_refseq, PLAN.md §6.9)."
        }
        ch_mash_refseq_db = Channel.value(
            [ [ id: 'refseq' ], file(params.mash_refseq_db, checkIfExists: true) ]
        )
        // Query is the raw reads DIRECTLY, not a pre-built sketch - real
        // finding from actually running this: mash screen's own job is to
        // stream/k-merize a query (raw sequence files) against an already-
        // loaded reference sketch DB; feeding it a pre-sketched query
        // (mash/sketch's own output) instead fails with mash's own
        // "ERROR: reading inputs" (confirmed reproduced directly against
        // the real container, not assumed from an error message alone) -
        // mash/sketch simply has no role in this particular use case.
        // Verified against real data (ERR044595, this pipeline's own real
        // S. aureus fixture): screening the raw reads against the real
        // RefSeq DB correctly identifies GCF_000284535.1 Staphylococcus
        // aureus subsp. aureus HO 5096 0412 as a perfect match (identity 1,
        // 1000/1000 shared hashes) - genuine species confirmation, not a
        // coincidental file that happens to produce output.
        MASH_SCREEN(ch_samplesheet, ch_mash_refseq_db)

        // No native MultiQC module (verified against docs.seqera.io/
        // multiqc/modules, 182 tools listed, none named "mash") - same
        // "check before assuming" gap geNomad/CheckV/MaxBin2 all hit, same
        // fix: a small custom MultiQC custom-content summary, not silence.
        // Real bug found and fixed here, not hypothetical: a first version
        // left Mash with NO MultiQC contribution at all, which meant a run
        // with ONLY skip_mash=false enabled correctly produced real output
        // on disk but still hit the "Nothing enabled to analyze or report"
        // guard below, because that guard checks ch_multiqc_files - Mash
        // genuinely ran and produced a real result, the guard just couldn't
        // see it. Caught by an nf-test case actually exercising skip_mash
        // alone, not assumed safe. The summary itself is also real value,
        // not just a guard workaround: the team sees the top species match
        // directly in the aggregated report instead of having to open
        // results/wgs/mash/*.screen by hand - the -w (winner-takes-all)
        // flag already applied (conf/modules_wgs.config) keeps this file
        // small enough to parse cheaply.
        ch_mash_mqc = MASH_SCREEN.out.screen
            .map { meta, screen_file ->
                def top = screen_file.readLines()
                    .findAll { it.trim() }
                    .collect { it.split('\t') }
                    .max { it[0] as Double }
                // Column 5 (the reference sketch's own comment - e.g. "NC_017763.1
                // Staphylococcus aureus subsp. aureus HO 5096 0412 complete
                // genome") is the human-readable organism name - column 4 alone
                // is just the machine accession filename (e.g.
                // "GCF_000284535.1_ASM28453v1_genomic.fna.gz"), not useful to a
                // human reading the report on its own. Real gap found and fixed
                // while writing this test: a first version captured only column
                // 4, so the summary never actually named the organism - caught
                // by asserting real text content, not just that a row exists.
                // Single quotes stripped, not escaped, matching this file's own
                // versions_mqc simple-YAML convention (no full YAML escaping
                // done anywhere else in this pipeline's generated _mqc.yml files).
                def organism = (top.size() > 5 ? top[5] : top[4]).replace("'", '')
                "    '${meta.id}':\n        identity: '${top[0]}'\n        shared_hashes: '${top[1]}'\n        top_match: '${organism}'"
            }
            .collect()
            .map { rows ->
                ([
                    "id: 'mash_screen'",
                    "section_name: 'Mash Screen - top species match'",
                    "description: 'Top-identity RefSeq match per sample from Mash screen pre-flight species/contamination check (docs/planning/PLAN.md §6.9) - not exhaustive, see the full .screen file under results/wgs/mash/ for every winning match.'",
                    "plot_type: 'table'",
                    "pconfig:",
                    "    id: 'mash_screen_table'",
                    "    namespace: 'Mash Screen'",
                    "data:",
                ] + rows).join('\n') + '\n'
            }
            .collectFile(name: 'mash_screen_mqc.yml', storeDir: "${params.outdir}/wgs/mash")
        ch_multiqc_files = ch_multiqc_files.mix(ch_mash_mqc)
    }

    if (!params.skip_seqkit_stats) {
        SEQKIT_STATS(ch_samplesheet)
        ch_multiqc_files = ch_multiqc_files.mix(SEQKIT_STATS.out.stats.map { meta, f -> f })
    }

    if (!params.skip_bwamem2) {
        if (!params.wgs_reference_fasta) {
            error "params.wgs_reference_fasta must be set when skip_bwamem2=false - one reference genome is required for alignment (PLAN.md §6.9)."
        }

        ch_reference_fasta_raw = Channel.value(
            [ [ id: 'reference' ], file(params.wgs_reference_fasta, checkIfExists: true) ]
        )
        // RENAME_REFERENCE (modules/local/) fixes a real bug found while
        // wiring Phase 4: GATK4_CREATESEQUENCEDICTIONARY requires a
        // recognized fasta extension on the staged filename, which an
        // NCBI-efetch-URL-sourced reference doesn't have (stages as
        // "efetch.fcgi") - BWA-MEM2 tolerates this fine, GATK4 doesn't.
        // Applied once here so every downstream consumer gets a
        // consistently-named reference.fasta, not just GATK4's own inputs.
        RENAME_REFERENCE(ch_reference_fasta_raw)
        ch_reference_fasta = RENAME_REFERENCE.out.fasta

        BWAMEM2_INDEX(ch_reference_fasta)

        BWAMEM2_MEM(
            ch_samplesheet,
            // No .first() here (unlike the usual nf-core one-reference-many-
            // samples idiom) - BWAMEM2_INDEX's own input is already a
            // Channel.value(), so Nextflow treats its output as a value
            // channel too (a single-shot process reused automatically for
            // every ch_samplesheet item); .first() on top of that is a
            // genuine no-op Nextflow warns about, not just unnecessary -
            // confirmed by removing it and re-running clean, not guessed.
            BWAMEM2_INDEX.out.index.map { meta, index -> [ [ id: 'reference' ], index ] },
            Channel.value([ [ id: 'reference' ], [] ]), // no fasta - not producing CRAM output
            true // sort_bam: samtools sort, not samtools view
        )
        ch_aligned_bam = BWAMEM2_MEM.out.bam

        // Real alignment QC content, since BWA-MEM2 has no native MultiQC
        // module of its own (verified 2026-09-14 against docs.seqera.io/
        // multiqc/modules/ - only a `samtools` module exists) - samtools
        // stats on the sorted BAM is what actually surfaces in the report,
        // same "check live MultiQC support before assuming it" discipline
        // used for geNomad/CheckV/MaxBin2 (all needed a custom _mqc.yml
        // instead; this stage gets a real upstream MultiQC module instead).
        SAMTOOLS_STATS(
            ch_aligned_bam.join(BWAMEM2_MEM.out.csi),
            Channel.value([ [ id: 'reference' ], [], [] ]) // no fasta/fai reference needed for BAM (only required for CRAM)
        )
        ch_multiqc_files = ch_multiqc_files.mix(SAMTOOLS_STATS.out.stats.map { meta, f -> f })

        // ---- Variant calling (GATK4 HaplotypeCaller) ---------------------
        // Nested inside skip_bwamem2's block, not its own top-level `if` -
        // GATK4 consumes BWA-MEM2's own aligned BAM and reuses its already-
        // loaded reference, same "nested because it genuinely depends on
        // the outer stage" pattern workflows/microbox.nf already uses for
        // Bracken depending on Kraken2. The real guard against the
        // inapplicable combination (skip_gatk4=false, skip_bwamem2=true)
        // lives below, after this block closes.
        if (!params.skip_gatk4) {
            GATK4_CREATESEQUENCEDICTIONARY(ch_reference_fasta)
            SAMTOOLS_FAIDX(
                ch_reference_fasta.map { meta, fasta -> [ meta, fasta, [] ] }, // no pre-existing fai
                false // get_sizes
            )

            // Always GVCF mode (-ERC GVCF, conf/modules_wgs.config's own
            // ext.args) then per-sample GenotypeGVCFs - the standard GATK
            // best-practices shape (owner, 2026-09-14: cover the broadest
            // real use case - many isolates vs. one reference is this
            // pipeline's own stated scenario, PLAN.md §6.9 - without
            // recalling anything once real cross-sample joint genotyping
            // is added later). intervals/dragstr_model/dbsnp/dbsnp_tbi are
            // all genuinely unused here - empty lists, matching this
            // repo's own established idiom for unused optional module
            // inputs (e.g. FASTP's adapter_fasta).
            GATK4_HAPLOTYPECALLER(
                ch_aligned_bam.join(BWAMEM2_MEM.out.csi)
                    .map { meta, bam, csi -> [ meta, bam, csi, [], [] ] },
                ch_reference_fasta,
                SAMTOOLS_FAIDX.out.fai,
                GATK4_CREATESEQUENCEDICTIONARY.out.dict,
                Channel.value([ [ id: 'reference' ], [] ]),
                Channel.value([ [ id: 'reference' ], [] ])
            )

            GATK4_GENOTYPEGVCFS(
                GATK4_HAPLOTYPECALLER.out.vcf.join(GATK4_HAPLOTYPECALLER.out.tbi)
                    .map { meta, vcf, tbi -> [ meta, vcf, tbi, [], [] ] },
                ch_reference_fasta,
                SAMTOOLS_FAIDX.out.fai,
                GATK4_CREATESEQUENCEDICTIONARY.out.dict,
                Channel.value([ [ id: 'reference' ], [] ]),
                Channel.value([ [ id: 'reference' ], [] ])
            )
            ch_final_vcf = GATK4_GENOTYPEGVCFS.out.vcf
        }
    }

    if (!params.skip_gatk4 && params.skip_bwamem2) {
        // Same "warn, don't crash" pattern as every other inapplicable-
        // combination guard in this repo (e.g. workflows/microbox.nf's
        // MaxBin2-on-contigs-entry guard) - GATK4 has nothing to call
        // variants from without BWA-MEM2's own aligned BAM.
        log.warn "skip_gatk4=false but skip_bwamem2=true - GATK4 needs BWA-MEM2's aligned BAM, nothing to call variants from. Auto-skipping GATK4."
    }

    ch_multiqc_files_guarded = ch_multiqc_files
        // Same real, reachable degenerate case as MICROBOX (workflows/
        // microbox.nf) - with only one optional stage wired so far, the
        // default (skip_bwamem2=true) run has nothing at all to report.
        // Caught here with a clear, actionable message rather than letting
        // MultiQC run anyway and produce nothing silently (docs/
        // KNOWN_ISSUES.md #22 - the real failure mode hit and fixed in
        // Phase 1 before any real stage existed to trigger it honestly).
        .ifEmpty { error "Nothing enabled to analyze or report: check the skip_* flags - at least one WGS analysis stage must run." }

    // ---- Tool-version provenance --------------------------------------
    // Channel.topic('versions') now has a real, invoked producer inside
    // THIS running workflow (BWAMEM2_INDEX/BWAMEM2_MEM/SAMTOOLS_STATS all
    // emit to it) when skip_bwamem2=false, so the pattern behaves exactly
    // as workflows/microbox.nf's own comment describes - unlike Phase 1's
    // skeleton, which had no real producer at all and needed a different
    // fix (docs/KNOWN_ISSUES.md #22). Identical pattern to
    // workflows/microbox.nf otherwise - not re-explained here, just reused.
    ch_versions_yaml = Channel.topic('versions')
        .unique()
        .map { process, tool, version -> "${process} (${tool}):\n  version: '${version}'" }
        .collect()
        .map { lines -> (["# microbox WGS pipeline tool versions (this run), keyed by \"Nextflow process (tool)\""] + lines.sort()).join('\n') + '\n' }
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
    aligned_bam    = ch_aligned_bam    // channel: [ meta, bam ] - empty unless skip_bwamem2=false
    final_vcf      = ch_final_vcf      // channel: [ meta, vcf.gz ] - empty unless skip_gatk4=false
    multiqc_report = MULTIQC.out.report
    versions_yaml  = ch_versions_yaml  // channel: path to pipeline_info/software_versions.yml
}
