#!/usr/bin/env bash
# Thin wrapper so the team never types Nextflow flags directly.
# Usage: ./bin/run.sh <samplesheet.csv> [--profile dev|test|prod] [--pipeline metagenomics|wgs] [--outdir <dir>]
set -euo pipefail

# Ensure Java/Nextflow are on PATH regardless of how this script was invoked
# - found 2026-09-11 click-testing the Streamlit UI end to end (owner:
# "streamlit it is", closing docs/KNOWN_ISSUES.md's long-open #4). `ui/
# app.py` launches this script via Python's subprocess.Popen(["bash", ...]),
# a non-login, non-interactive shell that never reads ~/.bashrc - so
# SDKMAN's `java` shim (bin/setup-dev.sh step 3) was never on PATH.
# `nextflow` itself still resolved (installed to /usr/local/bin), but its
# own launcher then failed outright: "java: command not found". A human's
# interactive terminal never hits this, because ~/.bashrc sources SDKMAN
# automatically on every new shell - nothing else invoking this script can
# assume that. Safe to source unconditionally: a no-op if SDKMAN isn't
# installed, or if java is already reachable some other way.
#
# `set +u`/`set -u` bracket the source deliberately: SDKMAN's own
# sdkman-init.sh (as of the version installed 2026-09-11) references at
# least one variable (SDKMAN_CANDIDATES_API) that is never set unless a
# previous SDKMAN command already ran in this shell, and dies with
# "unbound variable" under `set -u` - hit for real running this exact
# script from the UI, same underlying SDKMAN issue already worked around
# manually earlier the same session (see git history / session log for the
# Java-install step). SDKMAN is third-party and out of our control; keep
# `set -u` on for everything else in this script.
if [[ -f "$HOME/.sdkman/bin/sdkman-init.sh" ]]; then
  set +u
  # shellcheck disable=SC1090,SC1091
  source "$HOME/.sdkman/bin/sdkman-init.sh"
  set -u
fi

SAMPLESHEET="${1:?Usage: run.sh <samplesheet.csv> [--profile <env>] [--pipeline metagenomics|wgs] [--outdir <dir>] [--weblog-url <url>] [--extra-params-file <path>]}"
shift

PROFILE="dev"
PIPELINE="metagenomics"
OUTDIR=""
WEBLOG_URL=""
EXTRA_PARAMS_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:?--profile needs a value}"
      shift 2
      ;;
    --pipeline)
      # Threads straight to params.pipeline (main.nf, nextflow.config) - see
      # docs/planning/PLAN.md §6.9. Default 'metagenomics' preserves this
      # script's existing behavior for every caller that predates the WGS
      # sibling pipeline (ui/app.py included) - no flag, no change.
      PIPELINE="${2:?--pipeline needs a value (metagenomics|wgs)}"
      shift 2
      ;;
    --extra-params-file)
      # Optional - full-architecture Phase 3 (~/.claude/plans/jazzy-shimmying-wolf.md,
      # item 1: the UI-to-engine converter). server/main.py writes the real
      # skip_*/param values Composer's canvas produced to a YAML file and
      # passes it here, as a SECOND -params-file after the profile's own
      # (params/${PROFILE}.yaml, if any) - Nextflow merges multiple
      # -params-file arguments key-by-key, later wins, so Composer's explicit
      # choices override the profile's defaults for the keys it sets while
      # every other profile-level setting (input fixtures, resource caps for
      # the test profile) is untouched. Omitted entirely = today's behavior,
      # unchanged (every caller that predates Phase 3, ui/app.py included).
      EXTRA_PARAMS_FILE="${2:?--extra-params-file needs a value}"
      shift 2
      ;;
    --weblog-url)
      # Optional - full-architecture Phase 2 (docs/planning/PLAN.md §6.12,
      # ~/.claude/plans/jazzy-shimmying-wolf.md). Passed straight to
      # Nextflow's own -with-weblog so server/main.py's /api/telemetry
      # receiver gets live per-process events while a run is in progress.
      # Never the source of truth for a run's FINAL state (Nextflow's own
      # last event can drop on exit, per the seandavi/nextflow_telemetry
      # reference implementation this was modeled on) - only for live
      # progress while it's running. Omitted entirely = today's behavior,
      # unchanged (every caller that predates Phase 2, ui/app.py included).
      WEBLOG_URL="${2:?--weblog-url needs a value}"
      shift 2
      ;;
    --outdir)
      # Optional - if omitted, nextflow.config's own default ('results')
      # applies exactly as before. Added 2026-09-13 (owner: "we see all
      # previous runs, we can delete some, export some and view what we
      # select") so a caller that wants per-run history (ui/app.py, one
      # freshly-timestamped outdir per launched run) can ask for it,
      # without changing plain CLI usage's existing behavior at all -
      # bin/inspect.sh already anticipated --outdir varying per run
      # (its own find_outdir() recovers whatever value a specific past
      # run actually used, rather than assuming the fixed default).
      OUTDIR="${2:?--outdir needs a value}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Always capture full stdout/stderr to a dated log, regardless of outcome -
# covers failures that happen before main.nf's own onComplete/onError
# handler can run (e.g. config parse errors). PLAN.md §6.2, crucial
# requirement (owner, 2026-09-11): every run must leave behind something
# readable enough to diagnose without reproducing it.
mkdir -p logs
LOG_FILE="logs/run_$(date +%Y%m%d_%H%M%S).log"

PARAMS_FILE_ARG=()
if [[ -f "params/${PROFILE}.yaml" ]]; then
  PARAMS_FILE_ARG=(-params-file "params/${PROFILE}.yaml")
fi

EXTRA_PARAMS_FILE_ARG=()
if [[ -n "$EXTRA_PARAMS_FILE" ]]; then
  EXTRA_PARAMS_FILE_ARG=(-params-file "$EXTRA_PARAMS_FILE")
fi

OUTDIR_ARG=()
if [[ -n "$OUTDIR" ]]; then
  OUTDIR_ARG=(--outdir "$OUTDIR")
fi

WEBLOG_ARG=()
if [[ -n "$WEBLOG_URL" ]]; then
  WEBLOG_ARG=(-with-weblog "$WEBLOG_URL")
fi

# Exit status captured via PIPESTATUS (nextflow's, not tee's) and the `set
# +e`/`set -e` bracket around it - needed to print the bin/debug.sh hint
# below on failure *and* still propagate the real exit code afterwards
# (ui/app.py's Failed/Completed status depends on this script's own exit
# code matching Nextflow's - `set -e` alone would abort the script right
# here on failure, before either of those could happen).
set +e
nextflow run main.nf \
  -profile "${PROFILE},docker" \
  "${PARAMS_FILE_ARG[@]}" \
  "${EXTRA_PARAMS_FILE_ARG[@]}" \
  "${OUTDIR_ARG[@]}" \
  "${WEBLOG_ARG[@]}" \
  --pipeline "$PIPELINE" \
  --input "$SAMPLESHEET" \
  -resume 2>&1 | tee "$LOG_FILE"
NF_EXIT="${PIPESTATUS[0]}"
set -e

echo "Full log: $LOG_FILE"

if [[ "$NF_EXIT" -ne 0 ]]; then
  echo ""
  echo "Pipeline failed (exit ${NF_EXIT}). For a consolidated diagnosis of"
  echo "exactly what failed and why (no need to dig through logs by hand),"
  echo "run: bin/debug.sh"
fi

exit "$NF_EXIT"
