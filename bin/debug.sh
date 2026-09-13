#!/usr/bin/env bash
# Finds the most recent FAILED Nextflow task and prints everything needed to
# diagnose it without reproducing it: the exact command that ran, its full
# stderr/stdout, its exit code, and its work directory. Automates the manual
# "grep .nextflow.log for FAILED, extract the work-dir hash, cd in, cat
# .command.err" workflow this project's own bug hunts have done by hand all
# through development - most of docs/KNOWN_ISSUES.md was found exactly this
# way. Owner request, 2026-09-11: "add debugging, to make fixing bugs
# easier."
#
# Works for both a normal pipeline run (bin/run.sh / a plain `nextflow run`)
# and an nf-test run - both are recorded in this repo's own .nextflow/cache
# (nf-test's `-w <isolated dir>` only relocates where task work dirs live,
# not where the run's session/cache is tracked from - confirmed by reading
# the actual `nextflow log` output during this session, not assumed).
#
# Usage:
#   bin/debug.sh                  # auto-find the most recent run with a failed task
#   bin/debug.sh <run-name>       # a specific run (list names with: nextflow log)
#   bin/debug.sh --tail 100       # show more of .command.err/.command.out (default 40)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Same defensive sourcing as bin/run.sh, same reason: this script shells out
# to `nextflow` directly, and both the UI (a non-login, non-interactive
# Python subprocess that never reads ~/.bashrc) and a plain CI/cron
# invocation can't be assumed to already have SDKMAN's `java` shim on PATH
# the way an interactive terminal does. `set +u`/`set -u` bracket it because
# sdkman-init.sh itself dies under `set -u` (docs/KNOWN_ISSUES.md #18).
if [[ -f "$HOME/.sdkman/bin/sdkman-init.sh" ]]; then
  set +u
  # shellcheck disable=SC1090,SC1091
  source "$HOME/.sdkman/bin/sdkman-init.sh"
  set -u
fi

TAIL_N=40
RUN_NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tail)
      TAIL_N="${2:?--tail needs a number}"
      shift 2
      ;;
    *)
      RUN_NAME="$1"
      shift
      ;;
  esac
done

if ! command -v nextflow >/dev/null 2>&1; then
  echo "nextflow not found on PATH - can't query run history." >&2
  exit 1
fi

if [[ ! -d .nextflow/cache ]]; then
  echo "No .nextflow/cache in ${REPO_ROOT} - no runs recorded here yet." >&2
  exit 1
fi

# Walk run names newest-first (nextflow log lists oldest-first) and stop at
# the first one that actually has a failed task - avoids querying every run
# ever executed just to find the most recent problem. Uses process
# substitution (not a trailing pipe) so `return` actually returns from this
# function rather than just a pipeline subshell.
find_run_with_failure() {
  local name
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    if nextflow log "$name" -f process -F "status == 'FAILED'" 2>/dev/null | grep -q .; then
      printf '%s\n' "$name"
      return 0
    fi
  done < <(nextflow log 2>/dev/null | tac | awk -F'\t' '{print $3}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  return 1
}

if [[ -z "$RUN_NAME" ]]; then
  echo "No run specified - searching recent runs for a failed task..."
  RUN_NAME="$(find_run_with_failure || true)"
  if [[ -z "$RUN_NAME" ]]; then
    echo "No failed tasks found in any recorded run here. Nothing to debug."
    echo "(List all recorded runs with: nextflow log)"
    exit 0
  fi
  echo "Found: run '${RUN_NAME}'"
  echo
fi

FAILED_TASKS="$(nextflow log "$RUN_NAME" -f 'process,exit,workdir' -F "status == 'FAILED'" 2>/dev/null || true)"

if [[ -z "$FAILED_TASKS" ]]; then
  echo "Run '${RUN_NAME}' has no failed tasks (it may have succeeded, or the name is wrong)."
  echo "List available run names with: nextflow log"
  exit 0
fi

echo "=== Failed task(s) in run '${RUN_NAME}' ==="
echo

while IFS=$'\t' read -r process exit_code workdir; do
  [[ -z "$process" ]] && continue
  echo "------------------------------------------------------------------------"
  echo "Process    : ${process}"
  echo "Exit code  : ${exit_code}"
  echo "Work dir   : ${workdir}"
  echo "------------------------------------------------------------------------"

  if [[ -f "${workdir}/.command.sh" ]]; then
    echo "--- .command.sh (the exact command that ran) ---"
    cat "${workdir}/.command.sh"
    echo
  fi

  if [[ -s "${workdir}/.command.err" ]]; then
    echo "--- .command.err (last ${TAIL_N} lines) ---"
    tail -n "${TAIL_N}" "${workdir}/.command.err"
    echo
  fi

  if [[ -s "${workdir}/.command.out" ]]; then
    echo "--- .command.out (last ${TAIL_N} lines) ---"
    tail -n "${TAIL_N}" "${workdir}/.command.out"
    echo
  fi

  echo "Full work dir (staged inputs, .command.run, etc.): ${workdir}"
  echo
done <<< "$FAILED_TASKS"

echo "Tip: fix, then re-run with '-resume' - everything except this task"
echo "     (and anything downstream of it) is still cached."
