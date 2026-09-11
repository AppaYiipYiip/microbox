# metabox

*(working name — not final, see `docs/planning/PLAN.md` §6.5)*

A modular, GUI-agnostic bioinformatics pipeline toolbox for metagenomics. Every tool runs in its own pinned Docker container, orchestrated by [Nextflow](https://nextflow.io) using [nf-core](https://nf-co.re) modules where available. The default pipeline (fastp → FastQC → host depletion → assembly → taxonomic classification → viral analysis → MultiQC) is one composition out of a growing library of modules — any module can be an entry point or an exit point.

A thin [Streamlit](https://streamlit.io) UI sits on top for non-experts: pick a samplesheet, run, open the report. It's an optional convenience layer — the pipeline itself never depends on it and runs identically from the command line.

## Status

**Early development.** Repo scaffold in progress; not yet runnable end-to-end. Follow along in `docs/planning/`.

## Why this exists

This started as an implementation of a metagenomics platform for vaccine R&D. The original spec called for [DolphinNext](https://github.com/UMMS-Biocore/dolphinnext), but that platform turned out to be unmaintained and effectively dead (see the fact-check report below) — so this project keeps DolphinNext's *goals* (Docker-per-tool isolation, provenance tracking, resumable runs, one-click reports) while building on actively maintained tooling instead.

## Documentation

The full research trail lives in `docs/planning/`:
- [`PLAN.md`](docs/planning/PLAN.md) — implementation plan, environment model, and every design decision with its rationale
- [`dolphinnext-metagenomics-platform-version-1-0-specification.md`](docs/planning/dolphinnext-metagenomics-platform-version-1-0-specification.md) — the original v1.0 specification
- [`FACT-CHECK-REPORT-2026-09-11.md`](docs/planning/FACT-CHECK-REPORT-2026-09-11.md) — every external claim in the spec verified against live sources

## License

MIT — see [`LICENSE`](LICENSE).
