# Software Bill of Materials & license inventory

Generated 2026-09-13, closing the gap flagged in `docs/TESTING.md` §6 ("no SBOM/license inventory exists").
See `docs/KNOWN_ISSUES.md` for the container-vulnerability scan (a separate but related exercise, run the
same day) and `CONTRIBUTING.md` §2 for when to re-run both.

## Method

[`syft`](https://github.com/anchore/syft) (Anchore, open-source, no login required — unlike Docker Scout,
see `docs/KNOWN_ISSUES.md`) v1.51.1, installed from the project's official GitHub release **as a verified
`.deb` package**, not a piped install script: downloaded `syft_1.51.1_linux_amd64.deb` and
`syft_1.51.1_checksums.txt` from `github.com/anchore/syft/releases`, confirmed the file's real `sha256sum`
matched the published checksum exactly before running `dpkg -i` — the same "never trust a downloaded
artifact without verifying it" standard this project already applies to container tags (`CONTRIBUTING.md`
§2).

Ran `syft scan <source> -o cyclonedx-json=<file>.json` against:
- All 11 unique pinned container images this pipeline depends on (same list as the Trivy scan in
  `docs/KNOWN_ISSUES.md` — verified by grepping every `modules/**/main.nf`'s `container` line).
- The UI's Python environment (`dir:.venv-ui`), covering `streamlit` and every package it pulls in.

To regenerate (from WSL, with Docker running so images are accessible locally):
```bash
for img in <image:tag> ...; do
  syft scan "$img" -o cyclonedx-json=<output>.json
done
syft scan dir:.venv-ui -o cyclonedx-json=venv-ui.json
```
Full raw CycloneDX JSON (thousands of lines per container image — a full base-OS package inventory, not
just this project's direct dependencies) is **not committed to the repo** — regenerate on demand with the
command above rather than trusting a stale copy. This document is the durable, human-readable summary.

## Component counts

| Source | Components found |
|---|---|
| `bowtie2_htslib_samtools_pigz` | 2,401 |
| `bracken` | 2,515 |
| `fastp` | 2,358 |
| `genomad` | 2,708 |
| `kraken2_coreutils_pigz` | 2,401 |
| `megahit_pigz` | 2,598 |
| `multiqc` | 3,256 |
| `quast` | 3,365 |
| `spades` | 2,395 |
| `checkv` | 177 |
| `fastqc` | 27 |
| `ui/.venv-ui` (Python) | 168 |

The nine `community.wave.seqera.io` images are Seqera Wave/pixi-built and each bundle a **full Ubuntu 24.04
base OS layer** (`apt`, `bash`, `coreutils`, `dpkg`, etc.) alongside the actual bioinformatics tool — that's
why their counts run into the thousands and are so similar to each other. `checkv` and `fastqc` are lean
biocontainers images with little beyond the tool itself and its direct Python/Perl dependencies — no shell,
no package manager layer — which is also why their vulnerability surface in the Trivy scan was so much
smaller.

## License findings

**No AGPL found anywhere** — the one license family that would matter most if this UI were ever a
network-served product rather than `127.0.0.1`-only (`docs/planning/PLAN.md` §6.8 item 10).

The nine large conda/wave images each carry a near-identical GPL/LGPL cluster (~60× `GPL-2.0-only`, ~50×
`GPL-2.0-or-later`, ~30× `LGPL-2.1-only`, plus `GPL-3.0`/`LGPL-3.0` variants and `GPL`/`X11`/`Expat`) —
**every one of these is a base Ubuntu OS package** (`bash`, `coreutils`, `dpkg`, `findutils`, `grep`,
`gzip`, `hostname`, `libacl1`, `e2fsprogs`, and similar system libraries), not code this project or the
pipeline's own tooling wrote, modified, or is distributing as a combined work. `checkv`, `fastqc`, and the
Python UI venv are overwhelmingly `MIT`/`BSD-3-Clause`/`Apache-2.0` (the standard scientific-Python/PyPI
norm), with one **MPL-2.0** component appearing in every Python environment scanned (container and venv
alike): `certifi` — genuinely MPL-2.0 licensed upstream, not a scan error.

**Why none of this currently creates an obligation for this project**: copyleft source-disclosure terms
(GPL/LGPL/MPL) are triggered by *distributing* a modified or combined work containing that code. This
project does not build or publish its own container images — it references upstream `biocontainers`/
`community.wave.seqera.io` tags directly by digest-pinned tag (`CONTRIBUTING.md` §2) — and the Streamlit UI
is run locally, not served over a network to other people (`PLAN.md` §6.8). Under today's actual usage,
nothing here needs a NOTICE file, source offer, or license-compatibility review.

**When to re-review this** (a genuine, not hypothetical, trigger list for a future maintainer):
1. If this project ever builds and publishes its *own* container images bundling these tools (rather than
   referencing upstream tags) — that's a combined work being distributed, and the GPL/LGPL components
   above would need real attribution/compliance handling.
2. If the Streamlit UI stops being a local single-user tool and becomes a hosted/multi-tenant service —
   revisit the "no AGPL" finding specifically, since that's the license family with network-use disclosure
   terms.
3. Whenever a new tool/dependency is added (`CONTRIBUTING.md` §1) — regenerate this document rather than
   assuming a new pinned tag's licensing looks like the others.

## One scan artifact, noted not investigated further

A small number of components in `checkv` and `ui/.venv-ui` report a `sha256:...`-shaped string as their
license field instead of a real license identifier — a known class of upstream package-metadata quirk (a
package's own `METADATA`/`PKG-INFO` had a malformed or placeholder license field), not a `syft` bug and not
something this project's own files control. Affects a single-digit number of components in each source;
not worth chasing further unless a compliance review ever needs a fully clean 100% attribution for every
single component.
