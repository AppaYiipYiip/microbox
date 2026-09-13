#!/usr/bin/env bash
# Launches Pavian (github.com/fbreitwieser/pavian) via docker-compose.yml -
# an interactive R/Shiny viewer for Kraken2/Bracken reports. PLAN.md §6.6
# item 2: "Pavian = standalone docker-compose service over Kraken2/Bracken
# reports, not a pipeline step" - deliberately NOT wired into main.nf/
# workflows/microbox.nf. Run this any time, independently of the pipeline,
# against whatever's already in results/.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -d results/kraken2 && ! -d results/bracken ]]; then
  echo "WARNING: no results/kraken2 or results/bracken directory found yet."
  echo "Pavian will still start, but there will be nothing to browse until"
  echo "the pipeline has run with --skip_kraken2 false at least once."
  echo ""
fi

docker compose up -d pavian

echo ""
echo "Pavian starting at http://localhost:3838 (results/ mounted read-only as /data)."
echo "Use its file browser to open a report under results/kraken2/ or results/bracken/."
echo "Stop it with: docker compose down"
