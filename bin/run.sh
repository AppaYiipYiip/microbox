#!/usr/bin/env bash
# Thin wrapper so the team never types Nextflow flags directly.
# Usage: ./bin/run.sh <samplesheet.csv> [--profile dev|test|test_aws|prod]
set -euo pipefail

SAMPLESHEET="${1:?Usage: run.sh <samplesheet.csv> [--profile <env>]}"
shift

PROFILE="dev"
if [[ "${1:-}" == "--profile" ]]; then
  PROFILE="${2:?--profile needs a value}"
fi

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

nextflow run main.nf \
  -profile "${PROFILE},docker" \
  "${PARAMS_FILE_ARG[@]}" \
  --input "$SAMPLESHEET" \
  -resume 2>&1 | tee "$LOG_FILE"

echo "Full log: $LOG_FILE"
