#!/usr/bin/env bash
# Deep inspection of any task in any recorded run - not just failures
# (bin/debug.sh already covers "the pipeline crashed, why"). This is for the
# harder case: the pipeline finished successfully but a result looks wrong,
# and you need to see exactly what a specific node actually did - its exact
# command, exactly which files were staged into it (and which upstream task
# produced each one), and exactly what it produced for the next node.
# Owner request, 2026-09-13: "excessive [debugging], so we can find all bugs
# while we implement and test... if a result is not what the R&D team
# expected... we need to [know] what happened and why... read carefully the
# result of what node and what goes into the next one."
#
# Built entirely on what Nextflow already records for every task (the `work/`
# directory + `nextflow log`'s cache) - no new instrumentation, just tooling
# to make it fast to actually look at. Requires the run's `work/` directory
# to still exist (same requirement `-resume` already has) - nothing here
# reads anything Nextflow doesn't already keep on disk for every run.
#
# Usage:
#   bin/inspect.sh                          # list recent runs
#   bin/inspect.sh <run-name>                # list every task in that run
#   bin/inspect.sh <run-name> <process-name> # deep-dive matching task(s):
#                                             #   exact command, resolved
#                                             #   inputs (which upstream task
#                                             #   produced each staged file),
#                                             #   outputs, full stderr/stdout
#   bin/inspect.sh --bundle [run-name]       # zip up everything needed to
#                                             #   hand a run to someone else
#                                             #   for diagnosis (defaults to
#                                             #   the most recent run)
#
# Run names/process names come from `nextflow log` / this script's own run
# listing - <process-name> matches case-insensitively and by substring (e.g.
# "kraken" matches "KRAKEN2_KRAKEN2").
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Same defensive sourcing as bin/run.sh/bin/debug.sh, same reason: this
# script shells out to `nextflow` directly and can't assume an interactive
# login shell already has SDKMAN's `java` shim on PATH.
if [[ -f "$HOME/.sdkman/bin/sdkman-init.sh" ]]; then
  set +u
  # shellcheck disable=SC1090,SC1091
  source "$HOME/.sdkman/bin/sdkman-init.sh"
  set -u
fi

if ! command -v nextflow >/dev/null 2>&1; then
  echo "nextflow not found on PATH - can't query run history." >&2
  exit 1
fi

if [[ ! -d .nextflow/cache ]]; then
  echo "No .nextflow/cache in ${REPO_ROOT} - no runs recorded here yet." >&2
  exit 1
fi

most_recent_run() {
  nextflow log 2>/dev/null | tail -n 1 | awk -F'\t' '{print $3}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# A run's --outdir is a runtime param, not a fixed location - bin/run.sh's
# default `results/` is only one possible value, and this session's own CLI
# testing routinely overrode it (e.g. `--outdir /tmp/...`). Reusing whatever
# results/ happens to contain right now would silently bundle a DIFFERENT
# run's reports - found the hard way testing this script against a real run
# that used a custom --outdir. Recovers the real value from the run's own
# recorded command line (nextflow log's un-filtered output always includes
# it), falling back to nextflow.config's own default only if --outdir was
# never passed explicitly.
find_outdir() {
  local run="$1"
  local line outdir
  line="$(nextflow log 2>/dev/null | awk -F'\t' -v r="$run" '{gsub(/^[ \t]+|[ \t]+$/, "", $3); if ($3 == r) print}' | tail -1)"
  outdir="$(echo "$line" | grep -oE -- '--outdir[= ]+[^ ]+' | sed -E 's/--outdir[= ]+//' | tail -1)"
  if [[ -n "$outdir" ]]; then
    echo "$outdir"
  else
    echo "results"
  fi
}

# Given a staged file's real (symlink-resolved) path, identify which task in
# THIS run produced it, if any - it might instead be an original pipeline
# input (a samplesheet FASTQ, a reference file) rather than another task's
# output, which is itself useful information ("this came from outside the
# pipeline, not from an upstream node").
find_producer() {
  local target="$1"
  local run="$2"
  while IFS=$'\t' read -r proc tag wd; do
    [[ -z "$wd" ]] && continue
    if [[ "$target" == "$wd"/* || "$target" == "$wd" ]]; then
      echo "${proc} (tag: ${tag})"
      return 0
    fi
  done < <(nextflow log "$run" -f 'process,tag,workdir' 2>/dev/null)
  return 1
}

inspect_task() {
  local run="$1" process="$2" tag="$3" workdir="$4" status="$5" exit_code="$6"

  echo "========================================================================"
  echo "Process    : ${process}"
  echo "Tag        : ${tag}"
  echo "Status     : ${status}  (exit ${exit_code})"
  echo "Work dir   : ${workdir}"
  echo "========================================================================"

  if [[ ! -d "$workdir" ]]; then
    echo "Work directory no longer exists on disk - this task's exact I/O can't"
    echo "be inspected (it may have been cleaned up, or this run happened on a"
    echo "different machine). The run-report/execution_trace.txt still record"
    echo "that it ran, its resources, and its status."
    return
  fi

  if [[ -f "${workdir}/.command.sh" ]]; then
    echo "--- .command.sh (the exact command that ran) ---"
    cat "${workdir}/.command.sh"
    echo
  fi

  echo "--- Inputs staged into this task (and which upstream task produced each one) ---"
  local found_input=0
  while IFS= read -r -d '' entry; do
    local name
    name="$(basename "$entry")"
    [[ "$name" == .command.* || "$name" == .exitcode || "$name" == .nextflow.pid ]] && continue
    if [[ -L "$entry" ]]; then
      found_input=1
      local real
      real="$(readlink -f "$entry")"
      local producer
      producer="$(find_producer "$real" "$run" || echo "original pipeline input (not produced by another task in this run)")"
      echo "  ${name}"
      echo "    -> ${real}"
      echo "    produced by: ${producer}"
    fi
  done < <(find "$workdir" -maxdepth 1 -mindepth 1 -print0)
  [[ "$found_input" -eq 0 ]] && echo "  (no staged input files found - this task takes no file inputs, or they were already cleaned up)"
  echo

  echo "--- Outputs this task produced (what the next node(s) see) ---"
  local found_output=0
  while IFS= read -r -d '' entry; do
    local name
    name="$(basename "$entry")"
    [[ "$name" == .command.* || "$name" == .exitcode || "$name" == .nextflow.pid ]] && continue
    [[ -L "$entry" ]] && continue
    found_output=1
    local size
    size="$(du -h "$entry" 2>/dev/null | cut -f1)"
    echo "  ${name}  (${size})"
  done < <(find "$workdir" -maxdepth 1 -mindepth 1 -print0)
  [[ "$found_output" -eq 0 ]] && echo "  (no output files - check .command.err below, this task may have failed before producing anything)"
  echo

  if [[ -s "${workdir}/.command.err" ]]; then
    echo "--- .command.err (full) ---"
    cat "${workdir}/.command.err"
    echo
  fi

  if [[ -s "${workdir}/.command.out" ]]; then
    echo "--- .command.out (full) ---"
    cat "${workdir}/.command.out"
    echo
  fi
}

list_tasks() {
  local run="$1"
  echo "=== Tasks in run '${run}' ==="
  echo
  printf '%-28s %-40s %-10s %-6s %-8s %-10s\n' "PROCESS" "TAG" "STATUS" "EXIT" "DURATION" "PEAK_RSS"
  nextflow log "$run" -f 'process,tag,status,exit,duration,peak_rss' 2>/dev/null | \
    while IFS=$'\t' read -r process tag status exit_code duration peak_rss; do
      printf '%-28s %-40s %-10s %-6s %-8s %-10s\n' "$process" "${tag:-"-"}" "$status" "$exit_code" "$duration" "${peak_rss:-"-"}"
    done
  echo
  echo "Deep-dive any task: bin/inspect.sh '${run}' <process-name-substring>"
}

make_bundle() {
  local run="$1"
  local run_outdir
  run_outdir="$(find_outdir "$run")"
  mkdir -p debug-bundles
  local ts
  ts="$(date +%Y%m%d_%H%M%S)"
  local bundle_dir
  bundle_dir="$(mktemp -d)"
  local out_dir="${bundle_dir}/microbox-diagnostics_${run}_${ts}"
  mkdir -p "$out_dir/pipeline_info" "$out_dir/failed_tasks"

  if [[ -f .nextflow.log ]]; then cp .nextflow.log "$out_dir/" 2>/dev/null; fi
  if [[ -d "${run_outdir}/run-report" ]]; then cp -r "${run_outdir}/run-report" "$out_dir/" 2>/dev/null; fi
  if [[ -d "${run_outdir}/pipeline_info" ]]; then cp -r "${run_outdir}/pipeline_info/." "$out_dir/pipeline_info/" 2>/dev/null; fi

  {
    echo "Run: ${run}"
    echo "Outdir used by this run: ${run_outdir}"
    echo "Bundled: $(date -Iseconds)"
    echo ""
    echo "=== All tasks ==="
    nextflow log "$run" -f 'process,tag,status,exit,duration,peak_rss,workdir' 2>/dev/null
  } > "$out_dir/manifest.txt"

  local n=0
  while IFS=$'\t' read -r process tag workdir; do
    [[ -z "$process" ]] && continue
    n=$((n + 1))
    local task_dir="${out_dir}/failed_tasks/${n}_${process}"
    mkdir -p "$task_dir"
    for f in .command.sh .command.err .command.out; do
      if [[ -f "${workdir}/${f}" ]]; then cp "${workdir}/${f}" "$task_dir/" 2>/dev/null; fi
    done
    echo "${process} (tag: ${tag}) -> original work dir: ${workdir}" > "${task_dir}/_origin.txt"
  done < <(nextflow log "$run" -f 'process,tag,workdir' -F "status == 'FAILED'" 2>/dev/null)

  local zip_path="${REPO_ROOT}/debug-bundles/microbox-diagnostics_${run}_${ts}.zip"
  (cd "$bundle_dir" && zip -qr "$zip_path" "$(basename "$out_dir")")
  rm -rf "$bundle_dir"

  echo "Diagnostics bundle written: ${zip_path}"
  echo "  ($(du -h "$zip_path" | cut -f1), ${n} failed task(s) included)"
  echo "Contains: .nextflow.log, the run-report, pipeline_info/ (trace/DAG/"
  echo "software versions/MultiQC custom-content), a manifest of every task"
  echo "this run executed, and every failed task's exact command+stderr+stdout."
  echo "Does NOT include work-dir data files (sequence data can be large) -"
  echo "for those, share the specific work dir path from the manifest, or run"
  echo "this script directly against the run on the machine that has it."
}

# ---- argument handling -----------------------------------------------------

if [[ "${1:-}" == "--bundle" ]]; then
  RUN_NAME="${2:-$(most_recent_run)}"
  if [[ -z "$RUN_NAME" ]]; then
    echo "No runs recorded here yet." >&2
    exit 1
  fi
  make_bundle "$RUN_NAME"
  exit 0
fi

RUN_NAME="${1:-}"
PROCESS_FILTER="${2:-}"

if [[ -z "$RUN_NAME" ]]; then
  echo "=== Recent runs ==="
  nextflow log 2>&1
  echo
  echo "Inspect one: bin/inspect.sh <run-name>"
  exit 0
fi

if [[ -z "$PROCESS_FILTER" ]]; then
  list_tasks "$RUN_NAME"
  exit 0
fi

MATCHES="$(nextflow log "$RUN_NAME" -f 'process,tag,workdir,status,exit' 2>/dev/null | \
  awk -F'\t' -v pat="$(echo "$PROCESS_FILTER" | tr '[:upper:]' '[:lower:]')" \
  'tolower($1) ~ pat {print}')"

if [[ -z "$MATCHES" ]]; then
  echo "No task in run '${RUN_NAME}' matches process name '${PROCESS_FILTER}'." >&2
  echo "List all tasks in this run: bin/inspect.sh '${RUN_NAME}'" >&2
  exit 1
fi

while IFS=$'\t' read -r process tag workdir status exit_code; do
  [[ -z "$process" ]] && continue
  inspect_task "$RUN_NAME" "$process" "$tag" "$workdir" "$status" "$exit_code"
done <<< "$MATCHES"
