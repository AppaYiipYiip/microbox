# microbox

A modular, GUI-agnostic bioinformatics pipeline toolbox for metagenomics. Every tool runs in its own
pinned Docker container, orchestrated by [Nextflow](https://nextflow.io) using [nf-core](https://nf-co.re)
modules where available. Any module can be an entry point or an exit point — the default composition
(fastp → FastQC → host depletion → assembly → taxonomic classification → viral discovery → MultiQC) is one
composition out of a growing library, not a fixed chain.

A thin [Streamlit](https://streamlit.io) UI sits on top for non-experts: pick a samplesheet, run, open the
report. It's an optional convenience layer — the pipeline itself never depends on it and runs identically
from the command line. See ["How this stays GUI-agnostic"](#how-this-stays-gui-agnostic) below.

## Status

**Functional, real-data-validated, actively developed.** The default pipeline runs end to end, has been
tested against real production-representative data (a real ZymoBIOMICS Mock Community sequencing run, not
just toy fixtures), and its taxonomic/viral-discovery output has been checked against known ground truth
(correctly classified all 8 known mock-community bacteria; correctly identified and taxonomically classified
real viral sequence down to family level). The Streamlit UI is click-tested and functional. See
[`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) for exactly what's been verified and what's still open —
it is kept current, unlike this status line, so trust it over this file for anything time-sensitive.

## Quick start

```bash
# One-time setup (installs Nextflow, Java/SDKMAN, Docker config, nf-test, the UI's venv)
bin/setup-dev.sh

# Run from the CLI
bin/run.sh assets/samplesheet_test.csv --profile test

# ...or launch the UI (detached from your terminal - safe to keep the window open, see below)
bin/run-ui.sh
# then open http://localhost:8501
```

Real database-dependent tools (Kraken2, geNomad, CheckV) need their reference databases downloaded once
first — see `bin/download-dbs.sh` (run it with no arguments for the list of variants).

## Tool catalogue

| Stage | Tool | Status |
|---|---|---|
| Read QC/trim | fastp | wired, on by default |
| Read QC report | FastQC | wired, on by default |
| Host depletion | Bowtie2 | wired, off by default (needs `--host_fasta`) |
| Assembly | MEGAHIT (default) / metaSPAdes | wired, `--assembler megahit\|metaspades` |
| Taxonomic classification | Kraken2 + Bracken | wired, off by default (needs a downloaded DB) |
| Assembly QC | QUAST | wired, on by default |
| Viral/plasmid discovery | geNomad | wired, off by default (needs a downloaded DB) |
| Viral genome quality | CheckV | wired, off by default (needs a downloaded DB) |
| Genome binning | MaxBin2 | wired, off by default (`--skip_maxbin2 false`, no DB needed) |
| Aggregate report | MultiQC | wired, always runs |
| Interactive Kraken2 report viewer | Pavian | wired, standalone `docker-compose` service — `bin/run-pavian.sh` (not a pipeline step) |

Every stage is independently toggleable (`--skip_<stage>`); `docs/planning/PLAN.md` §9 has the full
catalogue including every candidate tool researched but not yet added, with verified container tags.

## Repository layout

```
main.nf                  Entry point - dispatches on --input_type, calls the workflow
workflows/microbox.nf     The actual pipeline logic - every stage, every skip_* flag
modules/nf-core/          Installed nf-core modules (fastp, kraken2, genomad, ...) - don't hand-edit
modules/local/            This project's own modules (GZIP_CONTIGS, MAXBIN2)
conf/                     base.config (resource defaults), modules.config (publishDir), test.config
nextflow.config           All pipeline params, declared once with a comment each
bin/                      run.sh, run-ui.sh, download-dbs.sh, debug.sh, inspect.sh, setup-dev.sh, run-pavian.sh
docker-compose.yml        Pavian - standalone Kraken2/Bracken report viewer, NOT part of the pipeline
ui/app.py                 The Streamlit UI - talks to the pipeline ONLY via bin/run.sh + results/ files
tests/main.nf.test        nf-test suite - tags: "basic" (fast, no DB) / "requires_db" (real DBs needed)
docs/planning/PLAN.md     Every design decision, with rationale - the deep-dive reference
docs/KNOWN_ISSUES.md      Bug log + "decisions worth remembering" - what's actually been verified
docs/TESTING.md           Testing requirements/checklist - run its §10 checklist after every change
docs/SBOM.md              SBOM / license inventory for every pinned container image + the UI's Python env
CONTRIBUTING.md           How to add a tool, upgrade a container tag, and other common maintenance tasks
```

## How this stays GUI-agnostic

The pipeline never imports, calls, or assumes anything about the UI. The only contract between them is:
CLI flags / `-params-file` YAML in, `results/<tool>/...` files out. `ui/app.py` talks to the pipeline
exactly the way a human at a terminal would — by shelling out to `bin/run.sh` and reading files it
publishes — never through pipeline internals. This means the UI can be replaced entirely (a different
framework, a CLI-only workflow, a future node-based composer) without touching `main.nf` or
`workflows/microbox.nf` at all. See `docs/planning/PLAN.md`'s standing principle (top of the file) for the
full rationale, and `docs/TESTING.md` §3 for how this contract gets tested.

## Documentation map

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — **start here for making a change**: how to add a tool, upgrade a
  container tag, the dev-environment quirks you need to know about.
- [`docs/planning/PLAN.md`](docs/planning/PLAN.md) — every design decision with its rationale, the full
  tool catalogue and research, and the standing architectural principles. Has a table of contents at the
  top — use it rather than reading linearly.
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) — the living bug/decision log. **Read this before assuming
  something is broken or unverified** — it's kept more current than this README.
- [`docs/TESTING.md`](docs/TESTING.md) — testing requirements and the post-change checklist (§10). Run the
  relevant items after every change.
- [`docs/SBOM.md`](docs/SBOM.md) — SBOM/license inventory for every pinned container image and the UI's
  Python environment, plus the container-vulnerability scan pointer. Regenerate whenever a tool/tag changes.
- [`CHANGELOG.md`](CHANGELOG.md) — what shipped, in brief, release by release.
- [`docs/planning/dolphinnext-metagenomics-platform-version-1-0-specification.md`](docs/planning/dolphinnext-metagenomics-platform-version-1-0-specification.md) —
  the original spec this project's goals derive from.
- [`docs/planning/FACT-CHECK-REPORT-2026-09-11.md`](docs/planning/FACT-CHECK-REPORT-2026-09-11.md) — every
  external claim in that spec verified against live sources.

## Why this exists

This started as an implementation of a metagenomics platform for vaccine R&D. The original spec called for
[DolphinNext](https://github.com/UMMS-Biocore/dolphinnext), but that platform turned out to be unmaintained
and effectively dead (see the fact-check report above) — so this project keeps DolphinNext's *goals*
(Docker-per-tool isolation, provenance tracking, resumable runs, one-click reports) while building on
actively maintained tooling instead.

## License

MIT — see [`LICENSE`](LICENSE).
