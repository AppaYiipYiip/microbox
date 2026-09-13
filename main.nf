#!/usr/bin/env nextflow

include { MICROBOX } from './workflows/microbox'

workflow {

    main:
    // Multiple entry points (PLAN.md §6.7: "any element can be first").
    // params.input_type picks which samplesheet shape to expect and which
    // stages are even applicable - a raw-FASTQ run and a contigs-only run
    // are fundamentally different starting points, not the same channel
    // with some stages skipped.
    if (params.input_type == 'fastq') {
        ch_samplesheet = Channel
            .fromPath(params.input, checkIfExists: true)
            .splitCsv(header: true)
            .map { row ->
                def meta  = [ id: row.sample, single_end: !row.fastq_2 ]
                def reads = meta.single_end
                    ? [ file(row.fastq_1, checkIfExists: true) ]
                    : [ file(row.fastq_1, checkIfExists: true), file(row.fastq_2, checkIfExists: true) ]
                [ meta, reads ]
            }
    } else if (params.input_type == 'contigs') {
        ch_samplesheet = Channel
            .fromPath(params.input, checkIfExists: true)
            .splitCsv(header: true)
            .map { row -> [ [ id: row.sample ], file(row.contigs, checkIfExists: true) ] }
    } else {
        error "params.input_type must be 'fastq' or 'contigs', got: ${params.input_type}"
    }

    MICROBOX(ch_samplesheet)

    // Self-contained run report - crucial requirement, PLAN.md §6.2 (owner,
    // 2026-09-11), covering TWO things every run must leave behind, not just
    // one: (a) enough to diagnose a failure without reproducing it, and
    // (b) the FAIR provenance record PLAN.md §7.2/§6.7 already commits to
    // (unique run ID, pipeline revision, exact params, tool versions) - a
    // successful run's record must be just as complete as a failed one.
    // `onComplete:`/`onError:` sections (not `workflow.onComplete { }`) are
    // the current strict-syntax way to do this - the legacy closure style
    // has a known bug where params/workflow resolve null inside it when
    // defined in the entry workflow (nextflow-io/nextflow#5445).
    onComplete:
    def ts     = new java.text.SimpleDateFormat('yyyyMMdd_HHmmss').format(new Date())
    def report = file("${params.outdir}/run-report/run_${ts}.md")
    report.parent.mkdirs()

    def lines = []
    lines << "# microbox run report"
    lines << ""
    lines << "## Provenance (FAIR record - always present, success or failure)"
    lines << ""
    lines << "- Run name     : ${workflow.runName}"
    lines << "- Session ID   : ${workflow.sessionId}"
    lines << "- Pipeline     : ${workflow.manifest.name} v${workflow.manifest.version}"
    lines << "- Revision     : ${workflow.revision ?: '(uncommitted / no git tag)'}"
    lines << "- Commit ID    : ${workflow.commitId ?: '(not run from a git repo)'}"
    lines << "- Config files : ${workflow.configFiles}"
    lines << "- Params       : ${groovy.json.JsonOutput.toJson(params)}"
    lines << ""
    lines << "## Execution"
    lines << ""
    lines << "- Command line : ${workflow.commandLine}"
    lines << "- Profile      : ${workflow.profile}"
    lines << "- Started      : ${workflow.start}"
    lines << "- Completed    : ${workflow.complete}"
    lines << "- Duration     : ${workflow.duration}"
    lines << "- Success      : ${workflow.success}"
    lines << "- Exit status  : ${workflow.exitStatus}"
    lines << "- Work dir     : ${workflow.workDir}"
    lines << "- Nextflow     : ${workflow.nextflow.version} (build ${workflow.nextflow.build})"
    lines << ""
    lines << "See also: ${params.outdir}/pipeline_info/ for the technical drill-down - execution_trace.txt / execution_report.html / execution_timeline.html / pipeline_dag.html (PLAN.md §6.2 layer 3-4), and software_versions.yml for the exact tool version each process actually ran (also shown as a table in the MultiQC report itself - Galaxy/nf-core provenance norm, researched 2026-09-11)."

    if (!workflow.success) {
        lines << ""
        lines << "## Failure"
        lines << ""
        lines << "- Error message: ${workflow.errorMessage}"
        lines << ""
        lines << '```'
        lines << "${workflow.errorReport}"
        lines << '```'
        lines << ""
        // Added 2026-09-11 (owner: "add debugging, to make fixing bugs
        // easier") alongside bin/debug.sh - this report already tells you
        // *that* it failed and roughly why (errorReport above), but
        // finding the failed task's exact command/stderr/work-dir still
        // meant manually grepping .nextflow.log by hand every time this
        // session. bin/debug.sh automates that; pointing at it here means
        // the next diagnosis step is discoverable from the one artifact
        // every run always produces, not something you have to already
        // know exists.
        lines << "For the exact command that failed, its full stderr, and its work directory - run: `bin/debug.sh` (or `bin/debug.sh ${workflow.runName}` for this specific run)."
    }

    report.text = lines.join('\n') + '\n'
    log.info "Run report written to ${report}"

    onError:
    log.error "Pipeline errored: ${workflow.errorMessage}"
}
