#!/usr/bin/env bash
# Launches the thin Streamlit UI, bound to localhost only. Multi-user auth is
# explicitly out of scope (PLAN.md §6.8 item 10) — this is not meant to be
# reachable beyond the machine it runs on without a deliberate port-forward.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

streamlit run ui/app.py --server.address 127.0.0.1 --server.port 8501
