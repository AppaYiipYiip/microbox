# Changelog

All notable changes to this project are documented here, in the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
format. This is the terse, chronological "what shipped" record — for *why*, see `docs/planning/PLAN.md`;
for bug-level detail and everything still open, see `docs/KNOWN_ISSUES.md`. Versions follow
[Semantic Versioning](https://semver.org/) once tagged releases start; nothing has been formally released
yet (`nextflow.config`'s `manifest.version` is still `0.1.0`), so everything to date lives under
**Unreleased**.

## [Unreleased]

### Added
- Default metagenomics pipeline: fastp → FastQC → Bowtie2 host depletion → assembly → Kraken2/Bracken
  classification → QUAST assembly QC → geNomad viral/plasmid discovery → CheckV genome quality → MaxBin2
  genome binning → MultiQC.
- Two entry points (`fastq` and `contigs`) and independent `skip_*` flags for every stage — any stage can
  be the first or last node in a run.
- `metaSPAdes` as an alternative assembler to MEGAHIT (`--assembler megahit|metaspades`).
- `MaxBin2` as an optional post-assembly genome-binning stage (`--skip_maxbin2 false`), via a local module
  (`modules/local/maxbin2`) rather than the stock nf-core one, to support paired-read coverage estimation.
- `docker-compose.yml` + `bin/run-pavian.sh` — Pavian, a standalone R/Shiny viewer for Kraken2/Bracken
  reports (read-only mount of `results/`, port 3838). Not a pipeline step, run independently.
- `bin/inspect.sh` — deep-dive any task in any run: exact command, staged inputs traced back to the
  upstream task that produced each one, and outputs. `--bundle` mode packages a run's logs/reports/manifest
  for sharing. Covers the case `bin/debug.sh` can't: a run that succeeds but produces an unexpected result.
- Thin Streamlit UI (`ui/app.py`) — upload a samplesheet, pick an environment, run, view the MultiQC
  report in-page. Talks to the pipeline only via `bin/run.sh` and `results/` files (GUI-agnostic contract).
- Live-run reattachment, a working Cancel button, and a disk-space preflight warning in the UI.
- FAIR provenance: a self-contained run-report per run (`results/run-report/`), tool-version tracking
  (`pipeline_info/software_versions.yml`), and a pipeline DAG diagram, generated automatically every run.
- `bin/setup-dev.sh`, `bin/run.sh`, `bin/run-ui.sh`, `bin/debug.sh`, `bin/download-dbs.sh` — the full
  dev-environment and operational tooling.
- `tests/main.nf.test` — an `nf-test` suite covering the full toolbox's combinatorial space, tagged `basic`
  (no external DB needed) and `requires_db` (real Kraken2/geNomad/CheckV databases).
- `ui/test_app.py` — a `pytest` + Streamlit `AppTest` suite (8 tests) covering the UI's run-state machine,
  PID-file reattachment, and Cancel-button behavior without needing a browser.
- `docs/TESTING.md`, `CONTRIBUTING.md`, `CHANGELOG.md` — testing standards, a maintenance playbook, and
  this file.
- `docs/SBOM.md` — a full SBOM/license inventory (all pinned container images + the UI's Python
  environment), generated with `syft`.
- `composer-ui/` — a prototype node-based pipeline composer (separate React app: React Flow, React
  Router v8, react-i18next). Categorized draggable node palette, a working canvas, multi-page nav, live
  French/English switching. Not yet connected to actually running the pipeline — see its own README.md.
- `.github/workflows/ci.yml` — CI wiring: the `basic` nf-test suite, UI `ruff`/`pytest`, `shellcheck`, and a
  `gitleaks` secrets scan, on every push/PR.
- `ui/requirements-dev.txt` — pinned dev tooling (`pytest`, `ruff`) for the UI, installed automatically by
  `bin/setup-dev.sh`.

### Changed
- `README.md` rewritten to reflect the project's actual current (functional, validated) state.

### Fixed
- Streamlit UI: a completed run's report became invisible after any page reload; the launching terminal
  closing could silently kill an in-progress run; `bin/run-ui.sh` assumed `streamlit` was on `PATH`.
- Three static-analysis findings in `ui/app.py` (Ruff): a non-timezone-aware datetime, an implicit
  `subprocess.run` check argument, and a documented exception for one deliberate non-issue.
- `nf-core pipelines lint` crashed outright on a real bug: `manifest.name` in `nextflow.config` needs an
  `<org>/<pipeline>` slash format, which this project's `'microbox'` wasn't.
- `docs/planning/PLAN.md`, `docs/KNOWN_ISSUES.md`, `docs/TESTING.md`, `CONTRIBUTING.md` — the project's
  full decision history, bug/verification log, testing standard, and maintenance playbook.

### Validated
- Full pipeline run against real production-representative data (ZymoBIOMICS Mock Community, ENA
  ERR2984773) across 8 CLI/UI flag combinations.
- Taxonomic classification checked against known ground truth: all 8 expected mock-community bacteria
  correctly identified (Kraken2 + Bracken, real `standard_08_GB` database).
- Viral discovery checked against known ground truth: real viral sequence in the test fixture correctly
  identified and taxonomically classified down to family level (geNomad + CheckV).
- MaxBin2 genome binning validated against the same real ZymoBIOMICS mock-community assembly (13 bins from
  8 known species — a normal, expected over-binning outcome, not a red flag).
- Pavian started for real and confirmed responding to an actual HTTP request (200, genuine Shiny HTML) —
  not just "the container starts".
- `composer-ui/` verified via real browser testing (drag-drop node creation, click-to-select, live
  French/English switching, real client-side navigation) plus a 13-test Vitest suite and a successful
  production build.
- All 11 pinned container images scanned for vulnerabilities (`trivy`) and inventoried for license
  compliance (`syft`, `docs/SBOM.md`) — see `docs/KNOWN_ISSUES.md` for findings.

### Known limitations
See `docs/KNOWN_ISSUES.md`'s Open section for the current list, and its "Decisions worth remembering"
section for real constraints found and accepted (e.g. a concurrency-driven memory ceiling on constrained
dev machines, a WSL2 VM-lifecycle behavior that ends a run if the launching terminal is fully closed).
CI (`.github/workflows/ci.yml`) has not yet been observed running on a real GitHub Actions push.
