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

nextflow run main.nf \
  -profile "${PROFILE},docker" \
  -params-file "params/${PROFILE}.yaml" \
  --input "$SAMPLESHEET" \
  -resume
