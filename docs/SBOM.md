# Software Bill of Materials & license inventory

Generated 2026-09-13, closing the gap flagged in `docs/TESTING.md` §6 ("no SBOM/license inventory exists").
See `docs/KNOWN_ISSUES.md` for the container-vulnerability scan (a separate but related exercise, run the
same day) and `CONTRIBUTING.md` §2 for when to re-run both.

**Updated 2026-09-14** to cover the WGS sibling pipeline's new container images (PLAN.md §6.9, Phases
2-4) - `syft` re-verified as v1.51.1 (same version, no drift) via the same checksum-verified `.deb` install,
and the 5 genuinely new images scanned (Kraken2-WGS and `RENAME_REFERENCE` reuse images already covered
above - no new scan needed for those).

## Method

[`syft`](https://github.com/anchore/syft) (Anchore, open-source, no login required — unlike Docker Scout,
see `docs/KNOWN_ISSUES.md`) v1.51.1, installed from the project's official GitHub release **as a verified
`.deb` package**, not a piped install script: downloaded `syft_1.51.1_linux_amd64.deb` and
`syft_1.51.1_checksums.txt` from `github.com/anchore/syft/releases`, confirmed the file's real `sha256sum`
matched the published checksum exactly before running `dpkg -i` — the same "never trust a downloaded
artifact without verifying it" standard this project already applies to container tags (`CONTRIBUTING.md`
§2).

Ran `syft scan <source> -o cyclonedx-json=<file>.json` against:
- All 11 unique pinned container images the metagenomics pipeline depends on (same list as the Trivy scan
  in `docs/KNOWN_ISSUES.md` — verified by grepping every `modules/**/main.nf`'s `container` line).
- The UI's Python environment (`dir:.venv-ui`), covering `streamlit` and every package it pulls in.
- **Added 2026-09-14**: the 5 genuinely new container images the WGS sibling pipeline introduces —
  `bwa-mem2_htslib_samtools`, `gatk4-main_gcnvkernel`, `htslib_samtools:1.24` (samtools/faidx and
  samtools/stats share this one image), `seqkit:2.13.0`, and `mash:2.3` — verified by the same
  `container` line grep, restricted to `modules/nf-core/{bwamem2,samtools,mash,seqkit,gatk4}/**` and
  `modules/local/rename_reference`. Kraken2-WGS (`KRAKEN2_KRAKEN2` reused via an `as`-aliased include) and
  `RENAME_REFERENCE` (reuses the existing `bowtie2_htslib_samtools_pigz` image) introduce no new images —
  already covered by the 11 above.

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
| `bwa-mem2_htslib_samtools` | 2,362 |
| `gatk4-main_gcnvkernel` | 3,892 |
| `htslib_samtools:1.24` | 2,367 |
| `seqkit:2.13.0` | 2,353 |
| `mash:2.3` | 5 |

The `community.wave.seqera.io` images (now thirteen, including the four new WGS ones) are Seqera Wave/pixi-
built and each bundle a **full Ubuntu 24.04 base OS layer** (`apt`, `bash`, `coreutils`, `dpkg`, etc.)
alongside the actual bioinformatics tool — that's why their counts run into the thousands and are so similar
to each other; `gatk4-main_gcnvkernel`'s 3,892 is the largest of any image scanned so far, consistent with
GATK4's own large Java/Picard/HTSJDK dependency tree. `checkv` and `fastqc` are lean biocontainers images
with little beyond the tool itself and its direct Python/Perl dependencies — no shell, no package manager
layer — which is also why their vulnerability surface in the Trivy scan was so much smaller.

**`mash:2.3`'s count of 5 is a real scan gap, not a "lean image" finding like `checkv`/`fastqc` above** —
found while regenerating this document, not assumed. All 5 detected components are base-OS packages
(`bash`, `busybox`, `debian`) with **no license metadata attached at all**; `mash` itself never appears as
its own scanned component, because it's compiled from source inside the image without package-manager
metadata `syft` can detect. Mash's real license (BSD-3-Clause, per its own upstream repository) is not
reflected in this scan at all — noted here rather than silently implying the automated scan gives complete
coverage of this one image the way it does for the others.

## License findings

**No AGPL found anywhere** — the one license family that would matter most if this UI were ever a
network-served product rather than `127.0.0.1`-only (`docs/planning/PLAN.md` §6.8 item 10). Re-confirmed
2026-09-14 across the 4 new large WGS images too (`mash`'s scan gap above means it wasn't part of this
check — its own real license is BSD-3-Clause, separately verified, not AGPL).

The now-thirteen large conda/wave images each carry a near-identical GPL/LGPL cluster (~250× `GPL-2.0-only`,
~220× `GPL-2.0-or-later`, ~125× `LGPL-2.1-only`, plus `GPL-3.0`/`LGPL-3.0` variants and `GPL`/`X11`/`Expat`) —
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
