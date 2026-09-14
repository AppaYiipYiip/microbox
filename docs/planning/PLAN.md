# DolphinNext Metagenomics Platform — Implementation Plan

> **Status:** DRAFT — all research complete. **Platform decision made (see §7): Option B — Nextflow + a thin Streamlit GUI.** Fact-checked 2026-09-11 — corrections and sources added inline (see §8 References). Ownership model settled + WGS extensibility evaluated 2026-09-11 (§6.5, §6.9). **Seqera ruled out entirely, 2026-09-13 (owner) — see §7's resolved decision gate; production runs on a normal Windows VM on AWS, the same stack already built locally.**

**Spec:** `dolphinnext-metagenomics-platform-version-1-0-specification.md` (v1.0, 2026-09-11)
**Author:** marouane

---

> **Standing principle (owner directive, 2026-09-11) — do not trade this away for short-term ease:** "Let's not cut any corners — each decision we take now because it's easy will cause an issue in the future," specifically about (a) keeping the **pipeline** genuinely GUI-agnostic, so the UI can be switched or replaced later without touching the engine, and (b) keeping **both the pipeline and the UI modular**, so new tools can be added to the pipeline and the UI can be changed or rebuilt entirely, without either one dragging the other along. This is not a new idea — it's the architecture already committed to in §6.7 (toolbox model) and §7 (Option B, GUI-agnostic core) — but it's recorded here explicitly as a standing constraint on every future decision, not just a description of the current design: when a future change (a new tool, a new UI, a refactor) seems easier by quietly coupling the pipeline to a specific UI, or a module to another module's internals, or the UI to one specific pipeline shape, that ease is the wrong trade — treat it as a design smell to push back on, not a shortcut to take. Concretely, this means: every new tool stays a self-contained module (pinned container, typed I/O, `--run_<tool>`/`--skip_<tool>` flag — §6.7) with no changes to existing modules; the pipeline never assumes a particular UI is driving it (CLI, `run.sh`, the Streamlit app, Seqera, or a future React/React Flow builder per §6.12 must all be able to drive the exact same engine unchanged); and the UI never hardcodes pipeline internals it doesn't need to (it talks to the engine through params/YAML and published outputs, per §6.10/§6.11's converter design, not by reaching into `workflows/microbox.nf`). Any design decision that violates this should be flagged explicitly, the way §6.8 item 12 already flags the composition-GUI deviation, rather than silently accepted.

> **Standing principle (owner directive, 2026-09-12) — this project will be maintained and upgraded by someone else:** every decision here should be evaluated partly on "can a future maintainer who wasn't in this conversation pick this up and change it correctly." Concretely: `CONTRIBUTING.md` has the concrete step-by-step for the most common maintenance tasks (adding a tool, upgrading a container tag, adding a UI feature) — keep it current whenever the underlying pattern changes, don't let it drift into describing a process nobody actually follows anymore. Every non-obvious decision gets written down in this file or `docs/KNOWN_ISSUES.md`, not left implicit in code, specifically so a successor doesn't have to reverse-engineer *why* something is the way it is. `README.md` must stay accurate about the project's actual current state — a stale "early development, not runnable" status line (found and fixed 2026-09-12, after months of the project actually being fully functional) is exactly the kind of thing that actively misleads a new maintainer's very first impression, worse than no README at all.

---

## Table of contents

- [1. Context](#1-context) — [1.1 Environment model](#11-environment-model)
- [2. Research Findings](#2-research-findings) — [2.1 Container tags](#21-spec-container-tags-are-mostly-invalid--corrected-inventory-) · [2.2 DolphinNext status](#22-dolphinnext-platform-status--dead--research-complete) · [2.3 Databases/Nextflow/WSL2/Geneious](#23-databases-nextflow-wsl2-geneious--research-complete)
- [3. Scope](#3-scope)
- [4. Phases](#4-phases-from-spec-8-operationalized)
- [5. Acceptance criteria](#5-acceptance-criteria-from-spec-9)
- [6. Detailed task breakdown](#6-detailed-task-breakdown)
  - [6.1 Pre-coding decisions](#61-pre-coding-decisions-and-open-questions) · [6.2 Testing & debugging strategy](#62-testing--debugging-strategy) (→ see also `docs/TESTING.md`) · [6.3 Multi-machine & AWS](#63-multi-machine--aws-workflow)
  - [6.4 GUI-agnostic core shape](#64-target-implementation-shape-option-b--pipeline-core-is-gui-agnostic) · [6.5 Accessibility/ownership](#65-accessibility--ownership-model-owner-decision-2026-09-11) · [6.6 Design decisions settled during coding](#66-design-decisions-to-settle-during-coding-fresh-eyes-review-2026-09-11--status-updated-with-owner-answers)
  - [6.7 Flexibility architecture (toolbox model)](#67-flexibility-architecture-owner-directive-2026-09-11) · [6.8 Independent review disposition](#68-independent-review--disposition-of-open-concerns-2026-09-11) · [6.9 WGS extensibility (not in MVP)](#69-wgs-extensibility--evaluated-2026-09-11-not-in-mvp-scope)
  - [6.10 Visual pipeline composition (not built)](#610-visual-pipeline-composition--per-node-branch-and-checkpoint-editing--raised-by-owner-2026-09-11-needs-study-not-scoped-or-built) · [6.11 Multi-page UI requirements (not built)](#611-multi-page-ui-requirements--brainstormed-2026-09-11-needs-study-not-scoped-or-built) · [6.12 UI technology & connection](#612-ui-technology--ui-to-backend-connection--researched-2026-09-11)
  - [6.13 "Any node can be last" report-norms pass](#613-any-node-can-be-last-made-actually-true-and-a-real-report-norms-pass--owner-directive-2026-09-11) · [6.14 Resilience to lost connectivity](#614-resilience-to-lost-connectivity-and-multi-daysession-continuity--owner-directive-2026-09-12) · [6.15 Future composer QoL requirements](#615-quality-of-life-requirements-for-the-future-node-based-composer--brainstormed-2026-09-12-needs-study-not-scoped-or-built) · [6.16 Composer UI requirements + tool shortlist + prototype](#616-composer-ui-requirements-list--tool-shortlist--owner-directive-2026-09-13-prototype-built-and-verified-same-day)
- [7. Platform choice decision](#7-key-decision-platform-choice-owner-decision-required)
- [8. References](#8-references-all-accessed-2026-09-11)
- [9. Tool catalogue](#9-tool-catalogue--what-every-tool-does-and-why-it-matters-owner-requested-2026-09-11) — every tool wired, planned, or researched, with verified container tags
- (Later, un-numbered sections toward the end of the file cover subsequent owner requests chronologically —
  search for the relevant heading text or a distinctive phrase from a request you remember, since new
  sections get appended as they come up rather than always slotted into this numbering.)

*(GitHub renders Markdown headings as clickable anchors automatically — the links above should work as-is
in the GitHub UI; if you're reading this in a plain text editor, use the line numbers from the section list
in `README.md`'s repo-layout table instead, or just search for the heading text.)*

---

## 1. Context

This project implements the v1.0 specification: a local, Docker-based **DolphinNext** orchestration platform for metagenomics analysis (vaccine R&D). The platform:

- Provides a drag-and-drop GUI for building pipelines (DolphinNext)
- Executes each bioinformatics tool in its own isolated Docker container via **Nextflow**
- Tracks provenance (versions, parameters, inputs, outputs)
- Generates reports (HTML, MultiQC)
- Exports results in formats importable by **Geneious Prime**
- Is architected as a **modular toolbox**: the spec's pipeline is the default MVP, but the company composes their own pipelines from the available tool modules (see §6.7)

The project folder contains the specification, this plan, and the fact-check report (`FACT-CHECK-REPORT-2026-09-11.md`). This plan turns the specification into a concrete, reproducible implementation.

### 1.1 Environment model

| Environment | Host | RAM | Role |
|---|---|---|---|
| **dev** | Windows laptops (WSL2 + Docker Desktop) | 16 GB total, **~7 GB usable** (confirmed 2026-09-11 — both dev laptops cap out around 7 GB actually available to WSL2/Docker, not the 12-14 GB originally assumed achievable via `.wslconfig` tuning) | Development & pipeline building |
| **test** | AWS (flexible sizing) | flexible | End-to-end testing |
| **prod** | Private Windows VM (WSL2 + Docker Engine) | 120+ GB | Production runs |

- Storage is not an issue on all three environments.
- Docker is **not yet installed** on the dev machine — installation is part of Phase 1.
- Both dev machines are **native Windows** (not VMs) with Docker Desktop + WSL2 backend — minimal testing and UI testing happen here.
- Docker is the **transport layer** between machines: identical pinned images run on dev, AWS and prod; reference DBs and sample data move separately (download scripts / S3 / disks). Offline prod: `docker save`/`docker load` tarballs or a local registry.
- Test data: **public dataset** (small metagenomics test set) will be downloaded.
- Design consequence: one repo, parameterized per environment via Nextflow profiles + one config file.
  Prod default is `k2_standard_16_GB` (14.9 GiB RAM) — owner rule: RAM is for calculations, not the database; the full `k2_standard` (103.1 GiB RAM) is only a later accuracy upgrade.
- **Dev RAM correction (2026-09-11):** with only ~7 GB actually usable on the dev laptops, `standard_08_GB` (7.45 GiB RAM just for the DB) no longer fits once OS/Docker/other overhead is accounted for — confirmed the hard way: a fresh WSL2 VM here reported 7.5 GiB available, and a naive 36 GB process resource request (before `resourceLimits` clamping was fixed) failed outright. **Dev truth-validation is dropped from the local machines and moved entirely to AWS** (§2.3, §6.3 already run the full Kraken2 DB there as the primary test tier — the AWS phase was already doing the real accuracy validation, this just makes it official rather than dev doing a smaller/redundant version). Dev's role is now purely mechanics/smoke testing — the tiny Viral DB (0.6 GiB RAM) — never anything DB-accuracy-related locally. All per-process resource ceilings on dev/test profiles are capped ≤ 6 GB (`conf/test.config`), not sized against the old 12-14 GB assumption.
- **Real-data truth-validation caveat (2026-09-12):** the "dev truth-validation is dropped" rule above is correct as a default, but it's a per-machine capacity fact, not an absolute rule about the `dev` category — worth stating precisely so it isn't mis-applied. Confirmed on this session's WSL2 VM (11 GB total, not ~7 GB — a different, more generously provisioned machine than the two laptops the 09-11 finding was based on): `standard_08_GB` (8 GB `hash.k2d`) **did** load and classify successfully against a real 1M-read-pair ZymoBIOMICS sample, correctly identifying all 8 known mock-community bacteria (~98.5% combined Bracken abundance — see `docs/KNOWN_ISSUES.md`'s "Real-data validation" entry for the full result), but only when run **alone**, with nothing else memory-heavy active — running it concurrently with a real MEGAHIT assembly OOM-killed the assembly (Docker exit 137). So: on an 11 GB machine, `standard_08_GB` truth-validation is possible but leaves no headroom for anything else running at the same time; on a ~7 GB machine it likely still doesn't fit at all, matching the original 09-11 finding. **Practical guidance for anyone repeating this locally:** check actual free RAM (`free -h`) and serialize — don't assume a `resourceLimits` cap alone makes concurrent heavy jobs safe on a resource-constrained dev box.
- **geNomad memory finding (2026-09-12):** a second, distinct DB-loading memory ceiling, same 11 GB VM. geNomad's `mmseqs2` marker search against the full `genomad_db` (v1.9) SIGKILLed even under a 9 GB `resourceLimits` cap alone; needed geNomad's own documented remedy (`--splits 4` - "If the MMseqs2 search is failing, try to increase the number of splits", `genomad end-to-end --help`) **combined with** the 9 GB cap to actually fit. Fixed as a `withName`-scoped `resourceLimits` override on just `GENOMAD_ENDTOEND` (`conf/test.config`) rather than raising the profile's general 6 GB ceiling - keeps the zero-setup `test` profile's guarantee of working on a ~7 GB machine intact for every other process; `requires_db`-tagged tests (this one included) already assume extra setup/resources beyond that guarantee anyway, same as Kraken2's DB-dependent tests. Full writeup: `docs/KNOWN_ISSUES.md`'s "geNomad + CheckV added..." entry.

---

## 2. Research Findings

### 2.1 Spec container tags are mostly invalid — corrected inventory ✅

Verified against the Quay.io API (full tag listings + exact-match queries + registry manifests).
**Only 2 of 13 spec tags exist** (`fastqc:0.11.9--0`, `multiqc:1.14--pyhdfd78af_0`).
The other build hashes were invented (`--py38hdfd78af_0` style never existed);
`genomad:1.6.0` and `checkv:0.8.2` never existed in any form.

**Corrected pinned tags** (all amd64/linux):

| Tool | Corrected pinned tag | Notes |
|---|---|---|
| FastQC | `quay.io/biocontainers/fastqc:0.12.1--hdfd78af_0` | upstream latest is 0.12.1 |
| fastp | `quay.io/biocontainers/fastp:1.3.6--h43da1c4_0` | fallback 0.23.x: `0.23.4--h125f33a_5`; upstream released 1.3.7 (2026) — 1.3.6 tag still valid |
| Bowtie2 | `quay.io/biocontainers/bowtie2:2.5.5--ha27dd3b_0` | includes `bowtie2-build` → host indexing OK |
| MEGAHIT | `quay.io/biocontainers/megahit:1.2.9--haf24da9_8` | frozen upstream at 1.2.9 |
| metaSPAdes | `quay.io/biocontainers/spades:4.3.0--hde4eca7_1` | `metaspades.py` present (wraps `spades.py --meta`); **4.x behavior-changing** vs spec's 3.15.5. **Superseded 2026-09-12:** wired via nf-core's own `spades` module instead of this standalone tag (consistent with every other tool in this pipeline) — the module pins `community.wave.seqera.io/library/spades:4.1.0--77799c52e1d1054a`, one minor version behind this row. Not a bug, just the real tag once installed the way this project actually sources every module; §6.10 has the full writeup. |
| Kraken2 | `quay.io/biocontainers/kraken2:2.17.1--pl5321h077b44d_0` | includes `kraken2-build`; upstream jumped 2.1.6 → 2.17.0 (no 2.14 line ever existed — CHANGELOG) |
| Bracken | `quay.io/biocontainers/bracken:3.1p1--hc52dbad_0` | 3.x restructured: bash launcher (`VERSION="3.0.2"`) + C++/Python in `src/` — **not** a Python rewrite; still validate outputs |
| MultiQC | `quay.io/biocontainers/multiqc:1.35--pyhdfd78af_1` | no 2.x exists |
| geNomad | `quay.io/biocontainers/genomad:1.12.0--pyhdfd78af_0` | DB is separate download (`genomad download-database`). **Implemented 2026-09-12** via nf-core's `genomad/endtoend` module, which pins `community.wave.seqera.io/library/genomad:1.12.0--27836e6e665e84b5` - same version (1.12.0), different exact tag string since it's a Wave-built image rather than this row's plain biocontainers one. No discrepancy, both are geNomad 1.12.0. |
| CheckV | `quay.io/biocontainers/checkv:1.1.1--pyh106432d_1` | DB separate (`checkv download_database`); **1.x uses DIAMOND genome_db — <0.9 DBs incompatible**. **Correction, 2026-09-12:** nf-core's `checkv/endtoend` module (the one actually installed) pins `checkv:1.0.3--pyhdfd78af_0`, one minor version behind this row - not the 1.1.1 this row's standalone research found. Confirmed DB-compatible with checkv-db-v1.5 regardless: bioconda's own version history shows 1.0.0 released 2022-07-27, already well after the 0.9→1.0 DIAMOND-format break this row flags, and 1.0.3/1.1.1 are both within that same 1.x line - no compatibility break between them. This project installs nf-core modules verbatim (consistent with every other tool here), so 1.0.3 is what actually ships, not a bug or an unresolved discrepancy. |
| Pavian | **no biocontainers image** → `quay.io/staphb/pavian:1.2.1` | R Shiny **service** on port 3838 (`-v <data>:/data`), not a pipeline step — verified in Dockerfile: `EXPOSE 3838`, `CMD ["/usr/bin/shiny-server"]`, `WORKDIR /data`; upstream GitHub tags stop at v1.0 (image versioning is staphb's own). **Implemented 2026-09-13** via `docker-compose.yml` + `bin/run-pavian.sh` — started for real and confirmed responding (`curl` → HTTP 200, real Shiny HTML), not just "container starts". |
| QUAST | `quay.io/biocontainers/quast:5.3.0--py313pl5321h5ca1c30_2` | |
| MaxBin2 | `quay.io/biocontainers/maxbin2:2.2.7--h503566f_8` | `run_MaxBin.pl` present, no ENTRYPOINT — invoke explicitly. **Correction, 2026-09-13:** this tag doesn't exist — re-verified live against nf-core's own `maxbin2` module source (`github.com/nf-core/modules`), which pins `quay.io/biocontainers/maxbin2:2.2.7--he1b5a44_2`. **Implemented 2026-09-13** via a local module (`modules/local/maxbin2`, not the stock nf-core one — see `docs/KNOWN_ISSUES.md` for why: paired `-reads`/`-reads2` vs. the nf-core module's single-file-only interface). |

**Consequences:**
- Every process definition must use the corrected tags; spec §5 tables are aspirational, not executable.
- Bracken 3.x, SPAdes 4.x, CheckV 1.x, Kraken2 2.17 are behavior-changing majors → per-tool smoke tests must include output sanity checks, not just "image pulls".

**Re-verified 2026-09-11 (fact-check pass):** all 14 tags above exist on Quay and are **linux/amd64** (verified via Quay registry manifests + config blobs). Bioconda latest versions match every claim: fastqc 0.12.1, fastp 1.3.6 (upstream 1.3.7), bowtie2 2.5.5, megahit 1.2.9, spades 4.3.0, kraken2 2.17.1, bracken 3.1p1, multiqc 1.35 (no 2.x), genomad 1.12.0, checkv 1.1.1, quast 5.3.0, maxbin2 2.2.7. SPAdes 4.3.0 ships `metaspades.py` (symlink to `spades.py` in `src/projects/spades/pipeline/`). `kraken2-build` is in the kraken2 image (`scripts/kraken2-build` + `install_kraken2.sh`), `run_MaxBin.pl` is in the maxbin2 image (bioconda build.sh line 51: `ln -s $MAXBIN_HOME/run_MaxBin.pl $PREFIX/bin/`).

Sources: [Quay.io API](https://quay.io/api/v1/repository/biocontainers/multiqc/tag/?specificTag=1.35--pyhdfd78af_1), [Quay registry v2](https://quay.io/v2/), [bioconda package index](https://anaconda.org/bioconda/), [bioconda recipes](https://github.com/bioconda/bioconda-recipes), [SPAdes repo (v4.3.0 tarball)](https://github.com/ablab/spades/tree/v4.3.0), [Kraken2 repo](https://github.com/DerrickWood/kraken2), [kraken2 CHANGELOG](https://raw.githubusercontent.com/DerrickWood/kraken2/master/CHANGELOG.md), [Bracken repo](https://github.com/jenniferlu717/Bracken), [staphb docker-builds README](https://github.com/StaPH-B/docker-builds/blob/master/README.md), [pavian 1.2.1 Dockerfile](https://github.com/StaPH-B/docker-builds/blob/master/build-files/pavian/1.2.1/Dockerfile)

### 2.2 DolphinNext platform status — **DEAD** ✅ (research complete)

Verified against GitHub API, Docker Hub registry API, and direct URL checks (2026-09-11):

| Check | Result |
|---|---|
| `ummsbiocore/dolphinnext-studio` Docker image | Repo exists but **has zero tags** — never published |
| `github.com/UMMS-Biocore/dolphinnext-studio` (build source) | **404 — repo deleted** |
| `dolphinnext.readthedocs.io` (docs) | **404 — site gone** |
| Main repo `UMMS-Biocore/dolphinnext` | Last commit **2023-09-15** (~3 years stale), 36 open issues, 2 forks, no LICENSE file (README states GPL 3.0; fork activity not verifiable) |
| Public server dolphinnext.umassmed.edu | Redirects to **ViaFoundry** (commercial successor, access-gated) |
| Only prebuilt images left | Third-party rebuilds (newest: `jdlamstein/dolphinnext-studio:latest`, tag updated 2023-11-14, 6.04 GB, linux/amd64) on **Ubuntu 16.04 (xenial) / PHP 7.2 / Python 2**, in-container MySQL — all confirmed from the image build history (registry config blob: `apt-get install php7.2...`, `mysql-server`, `add-apt-repository ... xenial`). ⚠️ Nextflow was installed via `get.nextflow.io` at build time (image pushed 2021-12-27 → ≈ Nextflow v21.x); "pinned to 19.10.0" is **not evidenced** |

**Also learned** (matters regardless of platform choice):
- DolphinNext process definitions: Web-UI forms + `.dn` import files; `.dn` export is `JSON.stringify` + `CryptoJS.AES.encrypt(text, "")` in `pipelineModal.js` (AES with an **empty passphrase**, written verbatim by PHP into `main.dn`) — not hand-authorable; the "instance secret" claim is not evidenced in code. The real definition store is the MySQL schema (`db/dolphinnext.sql`). API v1 covers **runs only** (getRuns / getRun / createRun in `docs/dolphinNext/api.rst`) — no API to create processes.
- Execution model it wrapped: generates `main.nf` (+ `main.dn`/config) into a GitHub repo or `/export` zip, Start/Resume/Rerun UI buttons (paper), `-with-report/-trace/-timeline/-dag` (`dbfuncs.php` lines 746–755; `run.rst` shows the resulting timeline.html/dag.html/trace.txt), R Markdown + Shiny reports (paper) — **OpenCPU appears nowhere in the paper or source code**. All of these are plain Nextflow features we can use directly.

**Verdict:** the spec's §4.2 deployment command (`docker run ummsbiocore/dolphinnext-studio:latest`) **cannot work** — the image doesn't exist. Options are: (a) drop the DolphinNext GUI and build the pipeline directly in Nextflow DSL2 + nf-core modules (recommended — keeps everything else in the spec: Docker-per-tool, resume, reports, MultiQC, Geneious export, standalone script); (b) run the stale 2023 community image anyway (literal spec compliance, unpatched stack); (c) modernize DolphinNext ourselves (multi-week PHP port, high risk); (d) use a modern maintained GUI (e.g., Seqera Platform) with the nf-core pipeline. **→ Decision (owner, 2026-09-11): Option B — see §7.**

**Sources (all verified 2026-09-11):** [Docker Hub API — ummsbiocore/dolphinnext-studio (0 tags)](https://hub.docker.com/v2/repositories/ummsbiocore/dolphinnext-studio/tags/?page_size=100); [codeload: studio repo deleted (404)](https://codeload.github.com/UMMS-Biocore/dolphinnext-studio/tar.gz/refs/heads/master); [repo commit feed — last commit 2023-09-15](https://github.com/UMMS-Biocore/dolphinnext/commits/master.atom); [GitHub repo page — 36 open issues, 2 forks, no LICENSE, GPL 3.0 README](https://github.com/UMMS-Biocore/dolphinnext); [dolphinnext.readthedocs.io (404)](https://dolphinnext.readthedocs.io); [dolphinnext.umassmed.edu → viafoundry.umassmed.edu/vpipe (301)](https://dolphinnext.umassmed.edu); [Via Foundry docs — "formerly known as DolphinNext"](https://docs.viascientific.com/about/); [Docker Hub API — jdlamstein/dolphinnext-studio:latest (6.04 GB, amd64, tag 2023-11-14, image pushed 2021-12-27)](https://hub.docker.com/v2/repositories/jdlamstein/dolphinnext-studio/tags/latest/); [pipelineModal.js (.dn AES export)](https://github.com/UMMS-Biocore/dolphinnext/blob/master/public/js/pipelineModal.js); [dbfuncs.php (main.dn write, with-report/-trace/-timeline/-dag)](https://github.com/UMMS-Biocore/dolphinnext/blob/master/public/ajax/dbfuncs.php); [api.rst (runs-only API)](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/api.rst); [admin_quick.rst (docker run, /export)](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/admin_quick.rst); [run.rst (timeline.html/dag.html/trace.txt)](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/run.rst); [paper full text (PMC7168977)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7168977/)

### 2.3 Databases, Nextflow, WSL2, Geneious ✅ (research complete)

**Corrections to the spec (all verified against live sources, 2026-09-11):**

| Spec claim | Reality |
|---|---|
| `docker.volumes = [...]` in `nextflow.config` | **Not a valid key** — use `docker.runOptions = '-v ...'` or per-process `containerOptions` |
| `resume = true` in config | **CLI-only**: `nextflow run x.nf -resume` (the cache directive is on by default, so any run is resumable) |
| Kraken2 standard DB "manageable" | Full `k2_standard` (June 2026) = 79.60 GiB tarball, **103 GiB RAM** hash table |
| CheckV DB "~3 GB compressed" | `checkv-db-v1.5.tar.gz` = **1.57 GiB** (+ DIAMOND db built locally after download) |
| minikraken2 as small fallback | Obsolete (aws-indexes lists it under "Old Minikraken"; bucket files dated 2019) — use `k2_standard_08_GB` instead |
| Java Runtime 8+ for Nextflow | Nextflow v26.x requires **Java 17+** |
| Geneious import is GUI-only | Geneious has a **CLI since 2022.0**; local/shared database paths (`Local:MyProject/...`) since **2022.2** (`geneious --input f.fastq --output db:path`) — programmatic import exists |

**Database plan per environment** (storage is not an issue; RAM is the constraint):

| Database | dev (16 GB RAM) | test (AWS, flexible) | prod (120+ GB RAM) |
|---|---|---|---|
| Kraken2 | dev: `k2_viral_20260626` (0.53 GiB dl, 0.6 GiB RAM) for smoke/mechanics tests + `k2_standard_08_GB` (5.54 GiB dl, 7.45 GiB RAM) for truth-validation runs | test (AWS): prod-candidate `k2_standard_16_GB` / `k2_pluspf_16_GB` (11.2 GiB dl, 14.9 GiB RAM) + optional full-`standard` benchmark | **default: `k2_standard_16_GB` (11.17 GiB dl, 14.9 GiB RAM) or `k2_pluspf_16_GB` (11.14 GiB dl, same 14.9 GiB RAM — adds fungi+protozoa, recommended for animal samples)** — owner rule: RAM is for calculations, not the DB. Full variants (103–110 GiB RAM) only as a later accuracy upgrade if real-data tests demand it |
| Bowtie2 host index | GRCh38 no-alt: `https://genome-idx.s3.amazonaws.com/bt/GRCh38_noalt_as.zip` — 3.49 GiB (same on all; host configurable) | same | same |
| geNomad DB | v1.9 (Zenodo record 14886553 or `genomad download-database`) — ~5 GiB total | same | same |
| CheckV DB | v1.5 (`https://portal.nersc.gov/CheckV/checkv-db-v1.5.tar.gz`) — 1.57 GiB | same | same |

All DBs stored on host filesystem, mounted read-only into tool containers (per spec §10.2). Pre-extracted Kraken2 files are available directly from the S3 bucket if partial downloads are preferred (the bucket ships complete extracted trees, e.g. `kraken/standard_20260626/`).

Sources: [Kraken2 S3 bucket listing (exact sizes)](https://genome-idx.s3.amazonaws.com/?list-type=2&prefix=kraken/), [aws-indexes pre-built DB table](https://benlangmead.github.io/aws-indexes/k2), [Kraken2 manual](https://github.com/DerrickWood/kraken2/wiki/Manual) (no per-DB RAM table; RAM figures above derive from the extracted `hash.k2d` sizes), [CheckV portal](https://portal.nersc.gov/CheckV/), [CheckV README](https://bitbucket.org/berkeleylab/checkv/raw/master/README.md), [geNomad Zenodo record 14886553 (v1.9)](https://zenodo.org/records/14886553), [geNomad docs](https://portal.nersc.gov/genomad/), [Bowtie2 GRCh38 index](https://genome-idx.s3.amazonaws.com/bt/GRCh38_noalt_as.zip)

**Why the Kraken2 database exists — and whether it's permanent:**

*What Kraken2 does.* Kraken2 classifies sequencing reads taxonomically: it matches short k-mers from each read against a reference and assigns the read to a node in the NCBI taxonomy tree (lowest common ancestor). The pipeline's Kraken2 step answers "which bacteria/archaea/viruses are in this sample, and roughly how much of each"; Bracken then re-estimates abundances at species/genus level from the same database. This is the core scientific output of the pipeline: after the animal's own DNA is removed (host depletion) and genomes are assembled, classification tells the scientists *what* they found.

*Why the database is mandatory.* Kraken2 has **no built-in knowledge of organisms** — 100% of what it "knows" comes from the reference database: a hash table mapping k-mers to taxonomy IDs (built from NCBI RefSeq genomes by `kraken2-build`) plus the NCBI taxonomy files (names/nodes). Without the database, Kraken2 cannot run at all — no database, no classification. Bracken additionally requires the Kraken2 DB, because its k-mer distributions are derived from the same genomes. This is why the spec's tool tables list "External database required" for both.

*Permanent or test-only?* **Permanent.** It is a runtime dependency of every production run, in every environment, for as long as taxonomic classification is part of the workflow. What is *not* part of the project is the database **data** itself: like the Bowtie2 host index and the geNomad/CheckV databases, it is an external, versioned dataset that:
1. is downloaded separately onto each machine by `bin/download-dbs.sh` (pinned URL + md5 verification),
2. lives on the host filesystem (never inside a Docker image, never in git),
3. is mounted read-only into the Kraken2/Bracken containers at runtime.

The project owns the script, the pinned version, the path parameter and the documentation — not the data.

*RAM mechanics (why the DB choice is a RAM decision).* During classification, the database's hash table must fit in memory — that is what the 7.45 / 14.9 / 103.1 GiB figures are. The capped variants are the **same reference content** reduced to fit a memory budget. Contents per the aws-indexes table (2026-06-26 generation): **Standard** = RefSeq archaea, bacteria, viral, plasmid, human, UniVec_Core; **PlusPF** = Standard + RefSeq protozoa & fungi; **PlusPFP** = PlusPF + plant; **Viral** = RefSeq viral only; **MinusB** = archaea, viral, plasmid, human, UniVec_Core (no bacteria). Per the owner's rule (RAM is for calculations, not the DB), prod defaults to a 16 GB-capped variant; the full DB is a configurable upgrade if real-data accuracy demands it.

*Available pre-built variants (2026-06-26 generation; sizes verified 2026-09-11 via S3 HEAD/listing):*

| Variant | Contents | Archive | RAM (hash.k2d) |
|---|---|---|---|
| Viral | RefSeq viral only | 0.53 GiB | 0.60 GiB |
| MinusB | archaea, viral, plasmid, human, UniVec_Core (no bacteria) | 8.3 GB | — |
| Standard-8 | Standard capped at 8 GB | 5.54 GiB | 7.45 GiB |
| Standard-16 | Standard capped at 16 GB | 11.17 GiB | 14.90 GiB |
| Standard (full) | archaea, bacteria, viral, plasmid, human, UniVec_Core | 79.6 GB | 103.11 GiB |
| PlusPF-8 | Standard + protozoa & fungi, capped 8 GB | 5.53 GiB | 7.45 GiB |
| PlusPF-16 | Standard + protozoa & fungi, capped 16 GB | 11.14 GiB | 14.90 GiB |
| PlusPF (full) | Standard + protozoa & fungi | 84.8 GB | 109.86 GiB |
| PlusPFP-8 / -16 / full | PlusPF + plant | 5.19 / 10.53 GiB / 171.8 GiB | ≈ 7.45 / 14.90 / >110 GiB |

*Is there anything between 16 GB and 100+ GB?* **Not pre-built** — each family ships only in 8 GB / 16 GB / full sizes. However: (a) the **content families** themselves are the intermediate options (Viral is 0.5 GiB, MinusB 8.3 GB — narrower scopes at small RAM); (b) any custom intermediate size (e.g., 32 or 50 GB) can be built once with `kraken2-build --max-db-size` (the manual documents this MiniKraken-style approach) — classification RAM ≈ the resulting hash-table size. **Recommendation for animal-derived samples: `PlusPF-16` gives fungi + protozoa coverage at the same 14.9 GiB RAM as Standard-16** — strong prod-default candidate; final call with the scientists during the real-data phase (a one-line params change, no code).

Sources: [aws-indexes pre-built DB table](https://benlangmead.github.io/aws-indexes/k2); [S3 bucket listing](https://genome-idx.s3.amazonaws.com/?list-type=2&prefix=kraken/&delimiter=/); [Kraken2 manual (custom DB sizes)](https://github.com/DerrickWood/kraken2/wiki/Manual)

*Testing also needs it.* Classification cannot be tested without a database. Owner's testing split (2026-09-11): dev smoke tests use the tiny **Viral** DB (0.53 GiB / 0.6 GiB RAM) — enough to exercise mechanics (wiring, resume, reports, the Bracken step); **truth validation** uses `standard_08_GB` (7.45 GiB RAM, fits the 16 GB machine), because a mock community's bacterial reads would come back *unclassified* against a viral-only DB — mechanics can be tested with any DB, but accuracy only with a DB that contains the mock organisms. AWS deployment testing uses the prod-candidate DB and can benchmark the full standard on the same mock to quantify what the 16 GB cap misses.

*When it would go away.* The workflow is modular. If the scientists ever decide classification is not needed (e.g., viral-only analysis via geNomad/CheckV), the Kraken2+Bracken module — and with it the DB requirement — can be removed from the workflow without touching anything else. That call belongs to the company; until then, the DB is a permanent component.

**Kraken2 DB per environment & testing split (decided 2026-09-11; AWS tier confirmed 2026-09-11 — owner: dev PC stays capped, AWS runs the full DB and "the code shall adapt"):**

| Environment | DB | RAM | Purpose |
|---|---|---|---|
| Internal dev — smoke | `k2_viral_20260626` (0.53 GiB dl) | 0.6 GiB | Pipeline mechanics: wiring, resume, reports, the Bracken step |
| ~~Internal dev — truth~~ | *dropped 2026-09-11* | — | Doesn't fit anymore: dev laptops only have ~7 GB usable RAM (confirmed, not the 16 GB total), under `standard_08_GB`'s own 7.45 GiB requirement before any other overhead. Truth-validation now happens exclusively on AWS (§6.3), which already runs the full DB as its primary tier — no redundant/smaller local truth tier needed. |
| **AWS deployment test (primary)** | full `k2_standard_20260626` (79.6 GiB dl) | 103.1 GiB | The real target, per owner decision: same mock **plus a spiked rare-taxa negative control** (reads from taxa present in the full DB but absent from the capped build, identified via `kraken2-inspect` taxid comparison) — measures what a capped DB would miss, on real full-scale classification |
| AWS capped-DB comparison (secondary, same box/session) | `k2_standard_16_GB` / `k2_pluspf_16_GB` (11.2 GiB dl) | 14.9 GiB | Run on the same instance right after the full-DB run (DB already on disk via `bin/download-dbs.sh`) — gives the prod-candidate numbers to compare against full-DB truth, at near-zero extra cost |
| Prod (default) | `k2_standard_16_GB` or `k2_pluspf_16_GB` | 14.9 GiB | Owner rule: RAM is for calculations, not the DB — the capped-vs-full comparison above is what justifies keeping (or overriding) this default |

**Instance sizing for the full DB on AWS:** the 103.1 GiB hash table needs a memory-optimized instance ≥128 GiB. Verified on-demand pricing (2026-09-11, us-east-1): `r6i.4xlarge` (16 vCPU / 128 GiB) **$1.008/hr**, `r7i.4xlarge` (newer gen, same size) **$1.0584/hr**. Against the owner's $100+ expiring credits, that's 90+ hours of full-DB compute — ample for testing, provided the instance is stopped when idle (guardrail already in §6.8 item 6). Spot pricing (typically 60–70% cheaper) is worth checking at provisioning time for this specific workload, since a spot interruption mid-classification just means a re-run (no data loss — Nextflow's own task-level caching covers it), not a failure.

**Design consequence ("the code shall adapt"):** this is already how the pipeline is built, not a new requirement — `params.kraken2_db` is a runtime parameter everywhere (§2.3, "Switching to a different Kraken2 database later"), so running the personal dev PC on a capped DB and AWS on the full DB is a one-line config difference per environment (`conf/dev.config` vs `conf/test.config`), never a code branch.

Caveat behind this split: **mechanics can be tested with any DB, accuracy only with a DB that contains the mock's organisms.** A mock community is typically bacterial (e.g., ZymoBIOMICS = 8 bacteria + 2 fungi); against a viral-only DB those reads come back *unclassified*, so the viral DB proves the pipeline runs but cannot validate the numbers. Since AWS now runs the full DB as the primary test (not a follow-up benchmark), the "does the 16 GB cap miss anything important?" question (§6.8 item 13) gets answered directly from the same session's numbers.

Sources: [AWS EC2 r6i.4xlarge pricing](https://www.devzero.io/instances/aws/r6i.4xlarge), [AWS EC2 r7i.4xlarge pricing](https://cloudprice.net/aws/ec2/instances/r7i.4xlarge)

All five variants are covered by one script: `bin/download-dbs.sh viral|standard_08_GB|standard_16_GB|pluspf_16_GB|standard` (pinned URL + md5 verification per variant).

*Switching to a different Kraken2 database later (designed to be a config change, not a code change).* The DB path is a runtime parameter (`params.kraken2_db`), never hardcoded in the workflow. To switch to the full `k2_standard`, `pluspf`, or a custom DB:
1. `bin/download-dbs.sh <variant>` — download any variant from the table above (full standard = 79.6 GiB, full pluspf = 84.8 GiB; wall time depends on bandwidth), verify md5, extract to the host DB directory (≈ 2× the archive size for tarball + extracted).
2. **Bracken one-time rebuild** — `bracken-build` must be re-run against the new Kraken2 DB for the sequencing read length, because Bracken's k-mer distribution files are DB- and read-length-specific. This is a one-time batch job: minutes on the 08/16 GB variants, a few hours on the full DB.
3. Edit `params/<env>.yaml` (`kraken2_db: /path/to/new-db`) and, if the RAM footprint changes (e.g., 103.1 GiB for full standard), bump the process memory line in the profile — one line each.
4. Validate: re-run against the mock community and compare with the known composition before any real samples.

No pipeline code changes, same container images, same commands. Custom DBs (organism-specific or in-house built with `kraken2-build`) work the same way. The only real constraint is RAM: the full standard needs ~103 GiB during classification, `pluspf` ~110 GiB — which is precisely why prod defaults to `standard_16_GB`.

**Nextflow (2026 state):**
- Latest stable **v26.04.6**; requires **Java 17+** (Temurin LTS recommended); runs on Linux/macOS/Windows-via-WSL.
- Recommended `nextflow.config` skeleton (verified against docs):

```groovy
workDir = '/home/<user>/nf-work'            // ext4 INSIDE WSL2, never /mnt/c (9P is slow)
docker {
    enabled    = true
    runOptions = '-u $(id -u):$(id -g)'     // output files owned by WSL user, not root
    temp       = 'auto'
}
process {
    // no global default container — set per-process via withName (avoid wrong image on new processes)
    withName: 'BOWTIE2_HOST' { container = 'quay.io/biocontainers/bowtie2:2.5.5--ha27dd3b_0' }
    withName: 'MEGAHIT'       { container = 'quay.io/biocontainers/megahit:1.2.9--haf24da9_8' }
    // ... one withName block per tool (see §2.1)
}
```

Sources: [install docs — Java 17+ (up to 26), Temurin LTS via SDKMAN, Linux/macOS/Windows-via-WSL](https://docs.seqera.io/nextflow/install); [releases — latest v26.04.6](https://github.com/nextflow-io/nextflow/releases/latest); [docker scope reference — runOptions, temp='auto'](https://docs.seqera.io/nextflow/reference/config/docker); [cache-and-resume — -resume flag, cache on by default](https://docs.seqera.io/nextflow/cache-and-resume); [CLI reference — run (`-resume`)](https://docs.seqera.io/nextflow/reference/cli/run)

**WSL2 + Docker Desktop (dev machine):**
- Requirements: Windows 11 Pro/Ent/Edu 23H2+, WSL 2.1.5+, virtualization enabled, 8 GB RAM. Enable "Use WSL 2 based engine" + WSL Integration for the distro. (Note: Docker Desktop also still supports Windows 10 22H2 Pro/Ent/Edu; and "9P" names the Windows→Linux path — the slow `/mnt/c` path is DrvFs/cross-OS access per Microsoft.)
- Keep the Nextflow project + work dir on the ext4 side (`/home/<user>/...`); publish final results to a Windows-visible staging dir (e.g. `/mnt/c/Users/<user>/genomics_out`) for Geneious.
- Raise WSL memory via `%UserProfile%\.wslconfig` — on the 16 GB dev machine cap WSL at ~12-14 GB (WSL2 VM + Docker share this budget; default WSL cap is 50% of RAM = 8 GB, so an explicit cap is a real increase).
- Explorer access to ext4: `\\wsl.localhost\<distro>\...` (fine for occasional grabs, slow for bulk).

Sources: [Docker Desktop Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/), [Docker WSL docs](https://docs.docker.com/desktop/features/wsl/), [Microsoft — .wslconfig / WSL settings](https://learn.microsoft.com/en-us/windows/wsl/wsl-config), [Microsoft — working across file systems](https://learn.microsoft.com/en-us/windows/wsl/filesystems), [Microsoft — comparing WSL versions](https://learn.microsoft.com/en-us/windows/wsl/compare-versions)

**Geneious Prime 2026.1:**
- All spec §6.1 formats confirmed importable: FASTQ, FASTA, SAM/BAM, GFF/GTF, BED, VCF, CSV/TSV, HTML.
- Bulk import: **Import Folder** (preserves structure) or Smart NGS import (mixed types, matching IDs).
- CLI: `geneious --input file --output Local:MyProject/results` — programmatic import per file (license activated in GUI or via geneious.properties; CLI since 2022.0, database paths since 2022.2; current manual says folders not supported but the 2023.0 release notes say database folders are — verify empirically, loop over files).

Sources: [manual Import/Export](https://manual.geneious.com/en/latest/ImportExport.html), [manual CLI](https://manual.geneious.com/en/latest/CommandLineInterface.html), [release notes (full history)](https://assets.geneious.com/documentation/geneious/release_notes.html), [2022.2 release notes](https://www.geneious.com/updates/geneious-prime-2022-2), [help article: importable file types](https://help.geneious.com/hc/en-us/articles/360045072251-What-data-file-types-can-be-imported)

---

## 3. Scope

Deliver a working, reproducible deployment:

1. **Infrastructure** — Docker install guide for the dev machines (native Windows, WSL2/Docker Desktop); one-command setup scripts; Seqera Platform per the §7 decision (Cloud Basic free tier for dev/testing; self-hosted evaluation for prod) with CLI as the always-available fallback.
2. **Toolbox** — verified pinned Biocontainers images + Nextflow module definitions (nf-core modules where available, custom otherwise) for the 13 spec tools, extended over time with more open-source tools. Each tool = one module with standard inputs/outputs and a `--run_<tool>` / `--skip_<tool>` flag.
3. **Databases** — download scripts for Kraken2, geNomad, CheckV DBs + Bowtie2 host (GRCh38) index, sized per environment.
4. **Default pipeline (MVP)** — the spec's metagenomics pipeline (fastp → FastQC → Bowtie2 host depletion → MEGAHIT/metaSPAdes → Kraken2 → Bracken → QUAST → geNomad → CheckV → MultiQC) as the default composition; resume capability; standalone Nextflow script. Any module can be the entry or exit point (§6.7).
5. **Reporting/export** — MultiQC aggregation, everything published by default (export-anything), Geneious import workflow docs.
6. **Out of scope (explicit):** GxP/regulatory validation — 21 CFR Part 11, validated systems, certified audit trails. This delivery is a research tool; if the company ever needs regulatory-grade systems, that is a separate project (Seqera's "Validated" plan is a commercial pointer, not part of this work).

## 4. Phases (from spec §8, operationalized)

| Phase | Content | Effort |
|---|---|---|
| **1 — Infrastructure setup** | WSL2/Docker Desktop install on dev machines; repo scaffold (`nf-core create`); thin Streamlit UI scaffold (testing UI); persistent volumes; Seqera evaluation deferred to the handover gate | 1-2 days |
| **2 — Core tool integration** | FastQC, fastp, MEGAHIT, Kraken2, Bracken, MultiQC process definitions + per-tool smoke tests | 1-2 weeks |
| **3 — Pipeline construction** | End-to-end pipeline, resume test, reports, standalone NF export | 3-5 days |
| **4a — Specialized tools A** | geNomad, CheckV, QUAST (nf-core/validated paths), DB volumes, compatibility confirmation (geNomad 1.12.0 ↔ DB v1.9, same rigor as CheckV). **Implemented 2026-09-12** — real container tags, real DBs, real tested results; see §2.1 correction notes, §6.8 item 11, and `docs/KNOWN_ISSUES.md`'s "geNomad + CheckV added..." entry. | 2-3 weeks |
| **4b — Specialized tools B + hardening** | MaxBin2, Pavian-as-service, custom modules, per-tool sanity-check debugging (flagged behavior-changing majors), reproducibility validation. **MaxBin2 and Pavian both implemented 2026-09-13** — see `docs/KNOWN_ISSUES.md`'s "MaxBin2 added..."/"Pavian added..." entries. Completes PLAN.md §9's original tool catalogue. | 1-2 weeks |

## 5. Acceptance criteria (from spec §9)

| ID | Criterion | Verification |
|---|---|---|
| AC-01 | DolphinNext web UI loads at `http://localhost:8080/dolphinnext` | Browser access |
| AC-02 | Create pipeline and add process nodes | Manual walkthrough |
| AC-03 | Connect process nodes via type-compatible ports | Manual walkthrough |
| AC-04 | All Phase 1 tools execute as individual processes | Test each tool |
| AC-05 | End-to-end pipeline executes with sample data | Run complete pipeline |
| AC-06 | Resume from failed step without re-running completed steps | Interrupt and resume test |
| AC-07 | Reports generated from pipeline outputs | Verify report content |
| AC-08 | Data persists across container stop/start | Stop container, restart, verify |
| AC-09 | Standalone Nextflow script runs independently | Command-line execution |

> **Decision (owner, 2026-09-11): AC-01…AC-03 are formally replaced by web-interface equivalents** — AC-01′: the web interface loads and the user can sign in; AC-02′: the user can launch a pipeline run from the web interface (pipeline + samplesheet); AC-03′: the user can monitor a running pipeline and inspect its reports from the web interface. The testing UI is the thin Streamlit app (owner decision); Seqera or another UI can fulfill the same criteria at the company's choice (handover gate, §7). CLI equivalents remain for AC-04…AC-09. The original criteria assumed the DolphinNext web UI, which no longer exists.

## 6. Detailed task breakdown

Platform decision is made (§7: Option B). The numbered task list will be generated as the first coding artifact (Phase 1 kickoff); phases, testing strategy and implementation shape are already defined in §4/§6.2/§6.4. Remaining design decisions to settle during coding: §6.6.

### 6.1 Pre-coding decisions and open questions

**Platform decision — RESOLVED (2026-09-11): Option B (Nextflow DSL2 + nf-core, Seqera Platform GUI)** — the pipeline is GUI-agnostic, so CLI-first development proceeds immediately; the Seqera UI is evaluated/deployed in parallel (see §7). ⚠️ AC-01…AC-03 (web-UI based) are reinterpreted as the Seqera UI — sign-off noted in §5.

**Reuse before building:** much of this pipeline already exists, maintained:
- nf-core/mag — assembly pipeline incl. a viral subworkflow using geNomad + CheckV
- nf-core/taxprofiler — Kraken2/Bracken (+ other profilers) + MultiQC
- nf-core/funcscan — AMR screening (future option for vaccine R&D)
Build = compose nf-core modules/subworkflows + add Bowtie2 host depletion and metaSPAdes; custom modules only where nf-core has none (e.g., MaxBin2, Pavian-as-service).

**Owner answers (2026-09-11):**
1. Git: **personal account, permanently** (owner update, 2026-09-11) — this is and stays the owner's personal open-source project, public on GitHub; the company is a user, not a co-owner, and consumes it via tagged releases rather than a repo transfer (§6.5)
2. Prod: **private Windows VM** → WSL2 + Docker Engine (docker-ce inside the distro — no Docker Desktop needed, avoids Server-compat/licensing questions); `.wslconfig` RAM cap on prod as well (≥ ~112 GB for k2_standard)
3. Privacy: **yes, private** — animal-derived data. Our testing uses mock data only; the company's real-data AWS testing needs data-owner approval + private encrypted S3/IAM (§6.3)
4. Runtime budget: **none** — no SLA; resource configs sized for correctness, not speed targets
5. Host organism: **unknown — different animal species** → host depletion is fully parameterized: Bowtie2 index is a runtime parameter, no bundled genome; docs cover building an index from any genome; skip option for no-host runs
6. Geneious: **company has a license** (details unknown) — Geneious runs on their Windows machines; deliver the import SOP
7. Kraken2 DB scope: parameterized; **prod default: `k2_standard_16_GB` or `k2_pluspf_16_GB` (both 14.9 GiB RAM; pluspf adds fungi+protozoa — recommended for animal samples, confirm with scientists)** — owner rule: "RAM is for calculations, not to be wasted on the DB"; full variants only as a later accuracy upgrade. Testing split (owner, 2026-09-11): internal = Viral-only DB for smoke + `standard_08_GB` for truth runs; AWS deployment test = prod-candidate DB (+ optional full-standard benchmark)
8. Real data: **we never see it** — we build + mock-test (dev, then AWS with mock data); the company tests with real data on AWS; cutover to the local VM after sign-off

### 6.2 Testing & debugging strategy

**See `docs/TESTING.md` for the full, current testing requirements/checklist** (added 2026-09-12, researched
against current backend/frontend/integration/resilience/security testing standards) — this table is the
original high-level plan; `docs/TESTING.md` is the living, more detailed standard to actually run against
after every change, including layers this table doesn't cover yet (the UI/CLI contract boundary, chaos/
resilience testing, and a concrete post-change checklist).

| Layer | What | How |
|---|---|---|
| 0 — tool smoke tests | Each of the 13 containers runs with a tiny fixture; sane output verified (not just "image pulls" — mandatory for the behavior-changed majors: Bracken 3.x, SPAdes 4.x, CheckV 1.x, Kraken2 2.17) | Manual per tool in Phase 2; scripted later |
| 1 — module tests | Individual processes/subworkflows with fixture data | **nf-test** snapshots (nf-core standard) |
| 2 — integration test | Small **mock-community dataset with known truth** (e.g., ZymoBIOMICS mock — published expected compositions) | Kraken2/Bracken abundances vs expected; host-depletion check (human reads retained < X %). **Dev: `standard_08_GB` for truth runs** (bacterial mock reads must actually classify — a viral-only DB returns them unclassified, so it can't validate accuracy; viral-only is for smoke/mechanics only). **AWS: prod-candidate DB (`standard_16_GB`/`pluspf_16_GB`) + optional full-standard benchmark on the same mock to quantify what the 16 GB cap misses** |
| 3 — CI | Lint (`nf-core lint`), config validation, **Trivy image vulnerability scans of all pinned images** (every push + re-scan before prod cutover; CVEs → tag upgrades per runbook), small-profile test run | GitHub Actions (scaffolded by `nf-core create`) |
| 4 — reproducibility | Same command twice → identical outputs; interrupt mid-run → `-resume` skips completed tasks | On test env |
| 5 — UI tests | The thin Streamlit app: launch a run, watch status, open reports | Manual on dev; smoke before every handover |

**Debugging toolkit** (native Nextflow): `nextflow log`, `-with-trace/-with-report/-with-timeline/-with-dag`, `-dump-channels` (data-flow issues), `workDir` inspection (exact task inputs), `-resume` (iterate cheaply), `-process.debug`. MultiQC as QC gate: fastp/FastQC metrics distinguish data problems from pipeline problems early.

**Self-contained debug artifact — crucial requirement (owner, 2026-09-11).** Every run must produce a single, readable file that explains what happened well enough to diagnose an issue *without reproducing it* — not scattered raw Nextflow output someone has to dig through (this was written after exactly that happened debugging the M1 skeleton's resource-limit config). Two parts, both required, not optional polish:
1. **`bin/run.sh` always captures full stdout/stderr** to a dated log file (`logs/run_<timestamp>.log`) regardless of outcome — covers failures *before* Nextflow's own completion handler can fire (e.g. config parse errors).
2. **A `workflow.onComplete`/`onError` handler in `main.nf`** writes a structured run-summary (`results/run-report/run_<timestamp>.md` or similar) on every run: command line, profile/params used, success/failure, duration, and on failure — the failed process name, exit code, error message, and work-dir path (`workflow.errorMessage`, `workflow.errorReport`, `task.workDir` equivalents) — plus links to the trace/report/timeline files, not a replacement for them.

Applies from M1 onward, not deferred to a later phase.

### 6.3 Multi-machine & AWS workflow

- **One repo, parameterized**: `conf/base.config` + `dev/test/prod` profiles; `params/*.yaml` per environment. No machine paths or RAM hardcoded in workflows.
- **Same Nextflow everywhere**: pin `NXF_VER=26.04.6` in setup scripts.
- **Dev (native Windows + Docker Desktop/WSL2, 16 GB)**: small DBs (k2_standard_08_GB), WSL cap 12–14 GB, results staged to `/mnt/c/...` for Geneious. UI testing: the **thin Streamlit app** (local, launched with `bin/run-ui.sh`); Seqera remains an option at the handover gate but is not needed for dev.
- **Test (AWS)**: one **Linux** EC2 instance provisioned by `bin/setup-aws.sh` (Docker, Nextflow, DB downloads with checksum verification) — Linux is cheaper (no Windows license surcharge) and the pipeline is identical (all tools are Linux containers). Sized for the full Kraken2 DB (§2.3, owner decision 2026-09-11): a memory-optimized instance ≥128 GiB (`r6i.4xlarge`/`r7i.4xlarge`, ~$1.01–$1.06/hr, verified 2026-09-11) + EBS for `/work`; general pipeline-mechanics testing (wiring, resume, reports) that doesn't touch the full DB can run on the same box for simplicity. Funded by the owner's **expiring AWS credits** ($100+ covers 90+ hours at this instance size) — schedule the AWS phase while they are still valid, and stop the instance when idle. Skip AWS Batch until throughput demands it. IAM instance profile — never AWS keys on disk. The company's later real-data AWS phase uses the separate Windows EC2 "familiar computer".
- **Company real-data phase (owner decision, 2026-09-11): AWS as "just another familiar computer".** A **Windows** EC2 set up like their dev machines but with **Docker Engine (docker-ce) inside WSL2 instead of Docker Desktop** (licensing: Docker Desktop requires a paid subscription for orgs ≥250 employees or ≥$10M revenue — docker-ce avoids it entirely; same rule as prod), plus Geneious and the repo, reached over Remote Desktop — the team works on it as a normal computer and never interacts with AWS directly. Security hardening (non-negotiable for real data): RDP **not** open to the internet — restrict the security group to the office IP/VPN (or AWS SSM port forwarding); encrypted EBS volumes; private subnet; MFA. Alternatives considered and rejected for this team: Linux EC2 (cheaper/faster but unfamiliar to the users), AWS WorkSpaces/AppStream (managed virtual desktops — more cost and complexity, no benefit for one machine). Note: Windows instances cost more per hour (license) — negligible at one box. Under this model the team can also just run `run.sh` in a terminal and open MultiQC in the browser — Seqera is optional even in the AWS phase.
- **Prod**: private **Windows VM** → if it runs a **Windows 11 client SKU**, same Docker Desktop + WSL2 setup as dev; if **Windows Server**, use Docker Engine (docker-ce) inside WSL2 (Docker Desktop is unsupported on Server). `.wslconfig` RAM cap ≥ ~112 GB for k2_standard (103 GiB hash). Deployment sequence per owner: we build + mock-test (dev, then AWS with mock data) → hand repo + docs to the company → **company runs real-data tests on AWS themselves** → cutover to the local VM. Privacy: animal-derived data — AWS use requires data-owner approval; private/encrypted S3 buckets, IAM roles, no keys on disk.
- **Git hygiene**: DBs/test data never committed — only download scripts with pinned versions + md5. Secrets in git-ignored files / shared password manager.

### 6.4 Target implementation shape (Option B — pipeline core is GUI-agnostic)

```text
pipeline/
├── main.nf                 # DSL2 entry, orchestrates subworkflows
├── nextflow.config         # manifest: version, container tags
├── conf/base.config        # resources per process (cpu/mem/time)
├── conf/dev|test|prod.config
├── modules/                # nf-core-installed + custom (genomad, checkv, maxbin2)
├── subworkflows/           # qc, host_depletion, assembly, taxonomy, viral, report
├── params/*.yaml           # sample sheet, DB paths, thresholds per env
├── assets/                 # test data manifests, expected outputs
├── ui/                     # thin Streamlit app: launcher + status + open reports (testing UI)
├── bin/                    # setup-dev.sh, setup-aws.sh, download-dbs.sh, run.sh, run-ui.sh
└── docs/                   # runbook, tool-addition guide, decision log
```

**Open TODO (owner, 2026-09-11):** `bin/setup-dev.sh` and `bin/download-dbs.sh` exist and are verified (M1-M3 milestones). **`bin/setup-aws.sh` and a production setup script still need writing** — deliberately not built yet (would be guessing blind before actually touching AWS/prod), but each environment needs its own script, not one universal installer: WSL2-specific steps (DNS fix, `wsl.exe`, Docker Desktop's GUI toggle) don't apply on a Linux EC2 box or a prod VM running Docker Engine directly. Pick these up when the AWS phase (§6.3) actually starts.

Run: `nextflow run main.nf -profile prod -params-file params/prod.yaml -resume` → `results/<sample>/...` + MultiQC report + Geneious staging copy. Scaffold with `nf-core create` (lint + CI templates included); `nf-core modules install` for maintained modules.

- **Non-expert entry points:** `./bin/run.sh <samples.csv> --profile <env>` — a thin wrapper over `nextflow run` with sane defaults; `./bin/run-ui.sh` — starts the thin Streamlit UI (choose samplesheet → Run → open reports). The company's team never types Nextflow flags.
- **Retention policy:** `results/` is kept permanently (archived per run); the Nextflow work dir grows unbounded and gets a documented `nextflow clean -k` policy (after N days, keep logs) — `-resume` only works while the work dir is kept, so the policy is documented in the runbook.

### 6.5 Accessibility & ownership model (owner decision, 2026-09-11)

**This is a personal project, public on GitHub — not a company asset.** The owner keeps the repo permanently; the company is granted use, not ownership. This replaces the earlier "transfer to a company org at handover" plan.

- **No repo transfer.** The company clones/pulls the public repo like any open-source user. If the owner ever leaves the company or stops maintaining it, the repo doesn't move — it stays public and the company can fork it (public visibility is itself a bus-factor mitigation now, on top of §6.8 item 16's other points).
- **License: MIT (owner decision, 2026-09-11)** — required before the first public push, since this is now a real open-source release, not an internal tool. Matches the ecosystem this project already builds on: Bactopia, nf-core pipelines, and GATK4's BSD-3-Clause / Nextflow's Apache-2.0 are all similarly permissive — no copyleft surprises for a company using this commercially (see §6.9 for where that licensing check came from). A `LICENSE` file (standard MIT text, owner's name/year) is created at repo init, Phase 1.
- **Public/private boundary**: the public repo holds code, docs, download scripts, and pinned versions only — never real data, company-identifying details, credentials, or paths specific to the company's infrastructure (extends the existing Git-hygiene rule, §6.3, now under a stricter bar since the repo is public from day one, not just "personal account for now"). Company-specific values (their DB paths, their host species, their AWS/VM details) live in a gitignored local `params/company.yaml` or similar, never committed.
- **Release discipline, since others now depend on `main`**: the company should pin to tagged releases (`v1.0.0` etc.), not track the owner's day-to-day commits — a CHANGELOG and semantic-ish version tags mean the owner can keep developing without breaking the company's running instance. Document this explicitly in the README.
- **README quickstart**: anyone with Docker reaches first successful pipeline in ≤30 min using only the README — matters even more for a public repo, where the audience isn't just one company.
- **One-command environments**: `bin/setup-dev.sh` / `bin/setup-aws.sh` — no machine-specific tribal knowledge.
- **Pinned everything**: container tags (done), Nextflow version, DB versions + checksums, pipeline version = git tag printed in run reports.
- **CI as the safety net**: lint + test run on push keeps the pipeline working after dependency drift with no human required.
- **Decision log (ADR-style)**: why DolphinNext was dropped, why these DBs/versions/tools/layout — the "why" nobody can reconstruct from code, and now useful to any public user, not just the company.
- **Runbook docs**: how to run / add a tool / update a database / debug / export to Geneious (SOP usable by a non-bioinformatician).
- **No local-only knowledge**: the company keeps its own credentials and server details in its own password manager; no secrets in code or in the public repo.
- **Onboarding, not handover**: since there's no ownership transfer, this becomes a lighter "get the company self-sufficient" walkthrough rather than a succession ritual — still worth a recorded walkthrough so the company doesn't depend on the owner being reachable.

### 6.6 Design decisions to settle during coding (fresh-eyes review, 2026-09-11) — status updated with owner answers

1. **Pipeline DAG topology** — RESOLVED by architecture: the toolbox model (§6.7) makes every stage optional and composable; the MVP = spec order as the default flags. Assembly input choice (depleted reads vs all reads) and MEGAHIT/metaSPAdes selection are runtime params with sane defaults (depleted reads; MEGAHIT default, metaSPAdes optional).
2. **MaxBin2 / Pavian placement** — RESOLVED: both are modules in the library. MaxBin2 = optional binning stage after assembly; Pavian = standalone docker-compose service over Kraken2/Bracken reports (not a pipeline step).
3. **Sample-sheet format** — RESOLVED: follow the nf-core standard: `samplesheet.csv` with columns `sample,fastq_1,fastq_2` (gzipped FASTQ; single-end leaves fastq_2 empty; one row per library; same sample name across rows merges lanes), validated by JSON schema, passed as `--input` ([nf-core usage docs](https://nf-co.re/rnaseq/3.8/docs/usage), [nf-core schema example](https://github.com/nf-core/fetchngs/blob/c01bd0c215d1d1b0b55c099ecaa2e8c0c376664e/assets/schema_samplesheet.yml)).
4. **Read length** — ASSUMPTION (owner: assume now, ask the lab later): default **150 bp** (Illumina paired-end standard for metagenomics), also pre-built for 100 bp; exposed as `params.read_length`. Does a wrong assumption matter? Only for Bracken (its k-mer distributions are read-length-specific) — the fix is a one-time `bracken-build` re-run at the right length, no code change. Kraken2 itself is read-length-agnostic. The animal-vaccine context does not constrain the choice.
5. **Backups & retention (rephrased)** — "What happens to outputs, temporary files, raw data and logs over time, and how do we survive crashes/power cuts?" ANSWER: crash/power-cut survival is Nextflow's job — `-resume` re-runs only failed/incomplete steps, and the work dir stays on persistent storage; logs are kept always (excessive logs welcome: `.nextflow.log`, `nextflow log`, trace/report/timeline/DAG per run). The temporary work dir of *successful* runs is cleaned after N days with `nextflow clean -k` (keep logs). Open items for the company at cutover (not blocking coding): backup target for `results/` + DBs, and raw-FASTQ retention policy (default: keep everything).
6. **Geneious export list** — RESOLVED by export-anything: every module's outputs are published to `results/` by default, so any element can be the last step; a `--geneious_export` flag copies the whole run tree (or selected types) to the staging dir. The scientists pick what they import.
7. **Seqera ↔ AWS (rephrased)** — "When the company tests real data on AWS, how does the Seqera web GUI talk to their AWS machines?" ANSWER: Seqera Cloud needs a configured connection ("compute environment") + AWS IAM permissions to launch and monitor runs on their EC2. This evaluation is deferred to the handover decision gate. With the thin Streamlit UI as the testing UI, the company's real-data AWS phase simply uses the local UI (or `run.sh`) on the Windows EC2 — no Seqera wiring needed; Seqera only matters if they later choose it.
8. **AC-01…AC-03 sign-off** — RESOLVED (owner, 2026-09-11): formally replaced with Seqera equivalents (sign in / launch a run / monitor and inspect results from the web UI) — see §5 note.

**Remaining questions after the final review (2026-09-11) — owner answers:**

1. **AWS account for mock-data testing — RESOLVED**: the owner has **$100+ AWS credits expiring soon**; the Phase 3–4 AWS testing uses them. To stretch the credits, our mock-data test box runs **Linux** (no Windows license surcharge; the pipeline is identical — all tools are Linux containers). The Windows EC2 "familiar computer" is only for the company's real-data phase. Schedule the AWS phase while the credits are still valid.
   **Production deployment shape — RESOLVED (owner, 2026-09-13):** "AWS will host a normal Windows VM, just like any PC, and we will run the app on it - it's going to have both the UI and everything." Not a special cloud-native setup (no AWS Batch executor, no managed platform, no Seqera - see §7's decision gate, now resolved the same way) - the Windows EC2 instance runs the identical stack already built and validated locally (WSL2/Docker Desktop, this pipeline, `bin/run.sh`/`bin/run-ui.sh`, the Streamlit UI). `bin/setup-dev.sh` is therefore also the production setup script, not just a dev-machine one - no separate prod-provisioning script is needed unless something Windows-EC2-specific is found once that VM actually exists (e.g. Docker Desktop licensing on a server SKU, RDP/networking for reaching the UI remotely - neither investigated yet, since no VM exists to test against).
2. **Sequencing platform / read length — researched 2026-09-11** (owner: "search the web and answer it yourself"). Illumina short-read stays the default assumption — Illumina and Oxford Nanopore are the two dominant platforms in metagenomics overall, and Illumina remains the more common default across the field generally. However, this project's specific context (animal/veterinary pathogen work) is exactly where Nanopore is disproportionately strong: it's portable, real-time, and multiple veterinary studies report it detecting *more* species than Illumina from the same samples, especially viruses, fungi and mycobacteria — so the odds of the lab actually using Nanopore are higher here than in a generic metagenomics project. The finding that changes the risk calculus: **this is now a low-cost assumption to get wrong.** nf-core/mag v5.5.0 (current release, 2026-08-01) has native Nanopore and hybrid support already built in — a `long_reads`/`long_reads_platform` samplesheet column, `chopper`/`filtlong`/`nanoq` QC, and `Flye`/`metaMDBG` long-read assembly, mixable with Illumina rows in the same samplesheet. If the lab turns out to use Nanopore, switching is a samplesheet-column-and-assembler-flag change against an already-installed module, not a toolset rebuild. MVP still defaults to Illumina paired-end 150 bp (100 bp also pre-built for Bracken); read length stays `params.read_length`.
   Sources: [nf-core/mag usage docs — long_reads/long_reads_platform samplesheet, longread_filtering_tool](https://github.com/nf-core/mag/blob/5.5.0/docs/usage.md), [nf-core/mag v5.5.0 release, 2026-08-01](https://github.com/nf-core/mag/releases/tag/5.5.0), [Nanopore Sequencing in Veterinary Pathogen Detection: A Review, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13030282/), [mNGS Illumina vs Nanopore pathogen-detection comparison, PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9551279/)
3. **Backup & retention — RESOLVED**: crash protection = the previous completed step is preserved (Nextflow work dir + `-resume` — exactly the owner's model: "the backup is of the previous step in the pipeline, not the current one, if the electricity cuts off"). Outputs: **keep everything by default** — the norm for research pipelines and FAIR-friendly: raw data, results, logs and provenance are kept; FAIR does not require keeping scratch intermediates forever. The UI gets a "clean temporary files for this run" action (frees disk, keeps results + logs + provenance, requires confirmation) — never a raw-data delete. Company-level backup of `results/` + DBs remains their ops question at cutover.

**Questions for the R&D team (to be asked via the owner — answers not guaranteed; every question has a recorded assumption so the project proceeds regardless):**

| # | Question (plain language) | Assumption if unanswered |
|---|---|---|
| Q1 | Which sequencing machine/service does the lab use (e.g., Illumina, or another)? | Illumina paired-end |
| Q2 | What read length do you typically get (100? 150? other)? | 150 bp (100 also pre-built) |
| Q3 | Which animal species do the samples come from (one or several)? | Parameterized host index; none bundled |
| Q4 | What sample types (gut, blood, tissue, swabs…)? | Sample-agnostic pipeline — no assumption needed |
| Q5 | Do fungi/protozoa matter to you, or mainly bacteria + viruses? | PlusPF-16 DB candidate if yes — parameterized |
| Q6 | Which outputs do you want to view in Geneious? | Export-anything: all outputs available |
| Q7 | How many people will use the system? | Only matters if Seqera is chosen later (3-user free cap) |
| Q8 | If/when whole-genome sequencing (WGS) is added later (§6.9): sequence the animal host, or the pathogen/vaccine-candidate isolate? | Pathogen/isolate WGS assumed more relevant to vaccine R&D — not built either way until asked |

**Plain-language recap for the owner (2026-09-11):**
- **AWS credits**: used for our Linux mock-testing box (no Windows license fee = credits last longer); the Windows "familiar computer" is only for the company's real-data phase; run the AWS phase before the credits expire.
- **"Which sequencing machine does the lab use?"** is what the technical question means. Most labs use Illumina (assumed) — though researched 2026-09-11: veterinary/animal pathogen work leans more toward Nanopore than metagenomics generally, so don't be surprised if the answer comes back Nanopore. Either way it's now a cheap assumption to get wrong: the pipeline (nf-core/mag) already supports both Illumina and Nanopore, including mixed in the same run — switching is a config change, not a rebuild.
- **Backup**: if electricity cuts off, the completed previous step stays saved on disk; on restart, only the interrupted step re-runs — finished work is never redone. This is the built-in model (owner's rule).
- **Outputs**: the norm is keep everything — raw data, results, logs, provenance — which is also the FAIR-friendly choice. FAIR does not require keeping scratch/temporary files; the UI offers "clean temporary files for this run" (frees disk, keeps results + logs + provenance, asks for confirmation). Raw data is never deleted by the app.

### 6.7 Flexibility architecture (owner directive, 2026-09-11)

**Principle:** the project is a flexible, extensible toolbox of open-source bioinformatics tools — not one frozen pipeline. The spec's pipeline is the default MVP; the company composes their own pipelines from the library. More tools will be added than anyone uses ("20 options, they won't use them all").

**Design rules:**
- **One module per tool** (nf-core style): pinned container, typed inputs/outputs, version in the manifest. Adding a tool = adding a module + wiring its optional inputs/outputs + a `--run_<tool>` / `--skip_<tool>` flag — no changes to existing modules (the "add a tool" runbook covers this).
- **Any element can be first (import):** the entry point is parameterized — raw FASTQ (default), filtered reads, host-depleted reads, assembled contigs (FASTA), or an existing Kraken2 report — via `--input_type` (+ optional `--input_<stage>` params). MVP ships `fastq` and `contigs`; more entry types are added per need.
- **Any element can be last (export anything):** every module publishes its outputs to `results/` by default; no stage's outputs are silently discarded. `--geneious_export` copies the run tree to the Geneious staging dir. Any single stage can also run standalone (e.g., only taxonomy on provided contigs).
- **Tool selection:** nf-core pattern — `--run_<tool>` / `--skip_<tool>` flags validated by the params JSON schema; the MVP default = the spec pipeline.
- **Formats follow the standards:** nf-core conventions everywhere — `samplesheet.csv` (`sample,fastq_1,fastq_2`, gzipped FASTQ, one row per library, JSON-schema validated), params in YAML, outputs under `results/<tool>/`, MultiQC aggregation, and each tool's native standard formats (FASTQ/FASTA/BAM/Kraken & Bracken reports/GFF/…) — the formats other tools already use, so downstream software (Geneious, Pavian, anything else) works unchanged.
- **FAIR compliance:** unique run ID per execution; full provenance (pipeline git tag, params dump, Nextflow trace/report/timeline/DAG, pinned container tags); standard open formats; everything published by default; run summary + MultiQC as the findable index.
- **Crash/power-cut resilience:** `-resume` by default in `run.sh`; work dir on persistent storage; logs kept always; documented recovery procedure in the runbook.

### 6.8 Independent review — disposition of open concerns (2026-09-11)

An independent review raised 18 concerns. Disposition of each (all accepted or explicitly scoped out — none left silent):

| # | Concern | Disposition |
|---|---|---|
| 1 ||
| 2 | No regulatory/GxP consideration | **Explicit scope statement** — GxP/validation (21 CFR Part 11, validated systems) is out of scope for this delivery; a research tool. Separate project if ever needed. §3 item 6. |
| 3 | No container image vulnerability scanning | **Accepted.** CI adds **Trivy** scans of all pinned images (every push + re-scan before prod cutover; CVEs → tag upgrades per runbook). §6.2 layer 3. |
| 4 | Assembly-step RAM unbudgeted | **Accepted.** Assembly memory is `params.assembly_mem` per profile; dev = mock data only; AWS test = 32–64 GB instance; prod = MEGAHIT auto-manages (default `-m 0.9` of RAM, documented); Phase 3 integration runs measure peak RAM and size prod guidance from observations. |
| 5 | Test dataset still a placeholder | **Accepted.** Phase 2 task #1 = pin the mock dataset (shortlist: ZymoBIOMICS Microbial Community Standard reads + GRCh38 reads for host-depletion testing) with accession + md5 recorded like every other input; truth-composition table checked into `assets/`. |
| 6 | Post-credit AWS cost unknown | **Accepted, sized 2026-09-11.** Full-DB Kraken2 testing needs a 128 GiB memory-optimized instance (`r6i.4xlarge`/`r7i.4xlarge`, $1.01–$1.06/hr on-demand, verified against live AWS pricing); $100+ in credits covers 90+ hours, comfortably enough for the AWS test phase. Guardrails: auto-stop instances when idle (the cost driver is hours running, not calendar days), budget check before each session, spot pricing considered for the classification runs specifically. |
| 7 | WSL2 + antivirus interference | **Accepted.** Runbook troubleshooting entry: Windows Defender real-time scanning degrades WSL2 disk I/O on corporate machines; documented exclusion of the WSL vhdx / project dir. |
| 8 | Prod data-at-rest encryption missing | **Accepted.** Prod deployment checklist adds BitLocker (or host-level disk encryption) — matches the AWS EBS-encryption posture. |
| 9 | No retry strategy for transient failures | **Accepted.** nf-core-style `errorStrategy` (retry on transient signals: OOM/143/137 etc.) + `maxRetries` 1–2 for network-dependent steps (downloads, registry pulls); `-resume` remains the crash mechanism. |
| 10 | Streamlit UI access control unaddressed | **Accepted.** UI binds 127.0.0.1 (local-only) by default; on the shared AWS box: localhost + port-forwarding or a documented allow-list; multi-user auth explicitly out of scope. |
| 11 | geNomad DB/software pairing not explicitly confirmed | **Accepted.** Phase 4a adds the same explicit compatibility confirmation CheckV got (geNomad 1.12.0 ↔ DB v1.9) + pinned `download-database`; compatibility matrix in the runbook. **Satisfied 2026-09-12**: geNomad 1.12.0 (the exact version nf-core's `genomad/endtoend` module pins) ran end-to-end against a DB fetched live via `genomad download-database` (reports itself as v1.9's own database content on disk) against the real toy fixture, correctly identifying and taxonomically classifying 7 viral contigs down to family level (Coronaviridae) - not just "the container starts," a genuine confirmed-working pairing. Same real-content standard already applied to CheckV (`docs/KNOWN_ISSUES.md`'s "geNomad + CheckV added..." entry has the full result). |
| 12 | Drag-and-drop composition GUI quietly gone, not replaced | **Surfaced as an explicit deviation** — the spec's composition GUI is not replaced: Seqera and the Streamlit app are run/monitor GUIs; composition happens via CLI flags + YAML (nf-core style). Recorded as owner-acknowledged deviation to state to the company. If visual composition ever becomes a hard requirement, re-evaluate (Seqera builder capabilities unverified; not planned). |
| 13 | AWS DB-cap benchmark can't test the cap's real failure mode | **Accepted — benchmark redesigned.** Mock-only comparison would pass regardless (mock taxa are common and survive capping). New design: (a) compare taxid sets of capped vs full DB (`kraken2-inspect`), (b) spike reads from taxa present in the full but absent from the capped build into the mock, (c) check detection in full vs capped. The benchmark now measures sensitivity loss, not agreement. §2.3 table updated. |
| 14 | RAM-first DB rule vs vaccine-R&D purpose | **Reframed as a scientist sign-off.** The 16 GB default is an operational default protecting compute RAM; the sensitivity trade-off (dropping the long tail of RefSeq — the interesting/unexpected organisms) is a scientist decision, informed by the redesigned benchmark (#13), at the real-data phase. Interim pattern available: classify with 16 GB, re-classify interesting samples with the full DB on AWS. |
| 15 | Risk concentrated in Kraken2's version jump | **Accepted + fallback pin.** Named as concentrated risk (core scientific output; largest version jump in the toolset). Mitigations: truth-test before any real data; **verified fallback tag `quay.io/biocontainers/kraken2:2.1.6--pl5321h077b44d_0`** (last 2.1.x, same build-environment hash as the 2.17.1 tag) — one-line params swap if 2.17.1 misbehaves. |
| 16 | Bus factor of one | **Accepted with mitigations, updated 2026-09-11 for the public-repo model (§6.5):** (a) the repo is public on GitHub from day one — itself a mitigation, since anyone including the company can fork/continue it without anything needing to be transferred — reinforced by a second personal backup remote; (b) all knowledge continuously captured in-repo (plan, fact-check, decision log); (c) README "if the author disappears" section (how the company becomes self-sufficient — no credentials to hand over, since none of theirs should ever be in the public repo, §6.5); (d) nf-core lint/CI as a partial second pair of eyes on module code. |
| 17 | "Storage is not an issue" asserted, not verified | **Accepted.** Phase 1 adds a dev disk check (≥ 80 GB free: DBs ~20 GB + images ~30 GB + work dir); AWS EBS sized 200 GB; prod disk = 2× chosen DB + results growth; setup scripts verify disk before proceeding. |
| 18 | Phase 4 timeline vs its own flagged risks | **Accepted.** Phase 4 split into 4a (geNomad, CheckV, QUAST — nf-core/validated paths, 2–3 weeks) and 4b (MaxBin2, Pavian, custom modules + sanity-check debugging, 1–2 weeks); estimates re-checked after Phase 3 reality check. |

Two items require the company (not the owner): #12 (composition GUI deviation — state it explicitly) and #14 (DB sensitivity trade-off — scientist sign-off at the real-data phase). Both are recorded; neither blocks Phase 1.

### 6.9 WGS extensibility — evaluated 2026-09-11; **promoted to a real requirement 2026-09-14, not yet scoped/built**

**Status update, 2026-09-14 (owner directive): "option A is more work but more reward. a better result at the
end. go ahead and write that in the plan."** This followed a three-way scope choice laid out the same day
(§9.4's tool-catalogue discussion, in-conversation not yet in this doc verbatim) between (A) building this
section's pathogen/isolate WGS branch for real, (B) only exposing the tools already running hidden inside
other containers (samtools, HMMER, DIAMOND, Prodigal — §9.3) as their own standalone nodes in the *existing*
metagenomics pipeline, or (C) wiring in every §9.3 candidate tool as an available module regardless of which
workflow uses it yet. **Owner picked (A)** — this section's pathogen/isolate WGS sibling pipeline moves from
"evaluated, deliberately not built" to an actual requirement. (B) is smaller, self-contained, and still a
reasonable near-term pickup, but is *not* what was chosen this round — recorded here so it isn't confused
with what's actually in scope now.

**Also corrected the same day: this project will not be used commercially.** The licensing analysis below
(GATK4/Bactopia/DeepVariant license checks, the §9.3 "no copyleft surprises that would block the company's
commercial use" framing) was done under a commercial-use assumption that no longer holds. None of that
research is wrong or wasted — every tool checked is still fine (MIT/BSD/Apache-2.0/BSD-3-Clause, one GPLv3),
and it's actually a *more* permissive situation now, not less — but the "why we checked" framing throughout
§6.9/§9.3 is now stricter than this project actually needs. Not rewriting that history, just flagging it so
a future reader doesn't think a commercial constraint is still driving tool choice here.

**Build started 2026-09-14, plan approved (`~/.claude/plans/fluffy-wishing-sprout.md`), Phase 1 of 6
complete and verified — plumbing only, honestly reported as such, not more finished than it is.**
`main.nf` gained a `params.pipeline = 'metagenomics' | 'wgs'` selector (existing `input_type` fastq/contigs
branching nested unchanged under the metagenomics arm); `workflows/wgs.nf`, `conf/modules_wgs.config`,
`conf/test_wgs.config`, and `assets/schema_input_wgs.json` were added. **Zero real WGS tool modules exist
yet** — running `--pipeline wgs` today deliberately `error`s with "WGS pipeline has no tool stages
implemented yet," verified via a real nf-test case (`tests/main.nf.test`, tag `basic`) asserting exactly
that failure, not a fake pass. Full existing metagenomics suite (14 tests) re-run and confirmed green
alongside it — no regression from the `params.pipeline` restructuring. Real finding during this phase,
worth carrying forward for Phase 2+: `Channel.topic('versions')` (the provenance pattern `workflows/
microbox.nf` uses) only reliably closes-when-empty when a real, invoked module in the SAME running
workflow could write to it — with zero WGS modules yet, and `MICROBOX`'s own modules never invoked when
`pipeline=wgs`, a first attempt at reusing that pattern silently never fired at all (`workflow.success`
stayed `true` despite zero tasks ever running), and a value-channel workaround on top of that then hit a
second real finding: MultiQC itself exits `0` with no `multiqc_report.html` written at all when given
nothing to genuinely aggregate — full details, including why this is the SAME degenerate case `workflows/
microbox.nf` already guards against rather than a new problem, in `docs/KNOWN_ISSUES.md`'s "Fixed" #22.
**Phase 2 complete and verified, same day: BWA-MEM2 reference-guided alignment + samtools stats, the
first real WGS tool stage.** `skip_bwamem2`/`wgs_reference_fasta` params, `BWAMEM2_INDEX`/`BWAMEM2_MEM`/
`SAMTOOLS_STATS` wired into `workflows/wgs.nf`, real `publishDir`/`ext.args2` config in `conf/
modules_wgs.config`.

**Correction, same day - a real fixture was wrongly called "too large" from file size alone, without
testing it, and the owner caught it ("how is 58mb too large? are you sure about that?").** First pass
checked `nf-core/bacass`'s own real test fixture (`ERR044595`, ~115MB total R1+R2), assumed it was too
large for a fast test, and substituted this repo's own tiny SARS-CoV-2/Lambda-phage mechanics fixture
instead - without actually running it to check. **Wrong, corrected once actually measured**: downloads in
~19s, BWA-MEM2 indexes and aligns all 1M read pairs in ~20-26s on the 2cpu/6GB test ceiling - comparable to
or faster than this repo's own existing MaxBin2 test (~80s). `ERR044595` is real ENA-cataloged
*Staphylococcus aureus* data; its matching reference (`NC_007795.1`, verified via a real 90.7%-vs-0.15%
mapping-rate comparison, not assumed) is now what `assets/samplesheet_wgs_test.csv`/`conf/test_wgs.config`
actually use - real biological validation, not a mechanics stand-in. Real resource usage on THIS real
fixture (`execution_trace.txt`): peak RSS 33.1/707.9/8.2 MB for index/align/stats - comfortably under the
~7GB ceiling for one sample, though multiple parallel samples or a larger genome aren't measured. This is
real, meaningful evidence for the owner's "on by default" question now, not decisive on its own (one
sample, one organism) - `skip_bwamem2` stays `true` by default; take these numbers back to the owner rather
than deciding unilaterally. **Lesson recorded for this project generally**: verify a fixture's feasibility
by actually running it, not by eyeballing a file size - see `docs/KNOWN_ISSUES.md` #23 for the full
before/after.

A real fixture with a *known expected variant* (needed specifically for Phase 4's GATK4 test, a stronger
requirement than Phase 2's own mapping-rate check) remains a separate open item. Two real nf-test cases
added and passing (15 total suite-wide). Full writeup: `docs/KNOWN_ISSUES.md` #23.

**Phase 3 complete and verified, same day: pre-flight species/contamination screening.** Scoped only after
being asked to verify real-world usefulness first ("google to make sure we would be providing something
useful, not wasting time") - research found Kraken2 is the more common primary QC gate in real bacterial
WGS pipelines than Mash, but Mash is genuinely field-used for a different signal (fast genome-distance/
plasmid-transmission detection). **Owner decision: keep both, independently toggleable** rather than an
either/or - `skip_kraken2_wgs` (reuses the existing metagenomics Kraken2 module/DB via an `as`-aliased
include, not a new module) and `skip_mash` (against a real external RefSeq sketch DB,
`bin/download-dbs.sh mash_refseq`), plus `skip_seqkit_stats`. BLAST+ stays deferred. Several real bugs found
only by actually running the wiring, not by re-reading docs: `mash/sketch` turned out to have no role at all
(mash screen's query should be raw reads, not a pre-built sketch - a first version's wiring failed with
mash's own "reading inputs" error, fixed by removing `mash/sketch` entirely); Mash initially had zero
MultiQC contribution, which broke the pipeline's own "nothing enabled" guard for a legitimate single-stage
run (fixed with a real custom-content summary, not a workaround); that summary's first version also
captured the wrong column (a machine accession filename instead of the human-readable organism name).
**One real, materially concerning resource finding**: Mash screening the real RefSeq DB peaked at **6GB**
RAM - right at the edge of this dev machine's actual available headroom, a bigger risk than Phase 2's
BWA-MEM2 findings and worth weighing heavily against any near-term "on by default" decision independent of
the still-open general question below. Also downloaded the geNomad and CheckV DBs for real this session (at
owner request, to re-verify a previously-failing pre-existing test) - found a second, genuinely unrelated
pre-existing issue: that test's own 9GB resourceLimits override exceeds this machine's real ~6.5GB available
RAM right now, an environment constraint outside this phase's scope, left untouched. Three real nf-test
cases added (two `requires_db`, one `basic`), all asserting real observed content. Full writeup:
`docs/KNOWN_ISSUES.md` #24.

**Phase 4 complete and verified, same day: GATK4 HaplotypeCaller (GVCF mode) + GenotypeGVCFs - the final
real analysis stage of this build.** Always calls in `-ERC GVCF` mode then genotypes per-sample, the
standard GATK best-practices shape rather than a plain single-sample VCF - deliberate, owner-directed
("cover the broadest usecase... whatever they need we had it covered"), concretely justified since this
pipeline's own scenario is many isolates vs. one reference, and GVCF mode costs nothing extra for today's
one sample while keeping real cross-sample joint genotyping addable later without recalling anything. True
cross-sample combining stays an explicit follow-on - building it now, with only one real isolate fixture to
test against, would be an untestable abstraction. **Simplified the fixture question Phase 2 had flagged
open**: rather than sourcing an external "known expected variant" benchmark dataset, reused the already-
verified real `ERR044595`/`NC_007795.1` pair and ran GATK4 once to see its real output - same "run it,
assert the real value" discipline as the rest of this build. **Three real bugs found and fixed, all by
running the chain, not by reading docs more carefully**: GATK4 refuses a reference file with no recognized
fasta extension (real and reachable here, since `wgs_reference_fasta` commonly points at an extension-less
NCBI efetch URL) - fixed with a new local module (`modules/local/rename_reference`); BWA-MEM2 emits no read
group by default, which breaks GVCF mode outright with a confusing error - fixed with a real `ext.args`
read group; and **a genuinely serious one** - `GATK4_HAPLOTYPECALLER` and `GATK4_GENOTYPEGVCFS` both
defaulted to the identical output filename, and `GenotypeGVCFs` writing through its own same-named staged
input symlink silently corrupted the real GVCF data (confirmed directly: HaplotypeCaller's own log showed
it genuinely processed the whole genome, but the file on disk ended up holding GenotypeGVCFs' own
near-empty output instead - `exit:0`, no crash, a real data-loss bug hiding behind a clean-looking success)
- fixed with a distinct `ext.prefix`, the exact same class of fix as this repo's existing
`KRAKEN2_KRAKEN2_PREDEPLETION` collision fix. After the fix: 37,491 real called variants, including a
specific real homozygous SNP (`NC_007795.1:89 C>T`) confirmed and asserted in the nf-test case. Real
measured resource usage: `GATK4_HAPLOTYPECALLER` peak RSS 776.1 MB (3m23s real compute, by far the slowest
single task), `GATK4_GENOTYPEGVCFS` 459.7 MB, `GATK4_CREATESEQUENCEDICTIONARY` 247.5 MB - all comfortably
under the ~7GB dev ceiling for one sample; real production-scale verification (larger genomes, many
samples, hours-long runs) is explicitly out of scope locally and planned for AWS instead, per the owner's
own scope clarification earlier this section. Two real nf-test cases added and passing (18 total
suite-wide, one genuine memory-pressure interruption mid-suite along the way - a background test run got
killed for low system memory, unrelated to any code bug, resolved by clearing stray Docker containers and
re-running). Full writeup: `docs/KNOWN_ISSUES.md` #25.

With Phase 4 done, the module-by-module build (BWA-MEM2, Mash/Kraken2/seqkit pre-flight, GATK4 variant
calling) is complete.

**Phase 5 functionally done, same day - full assembly, all five WGS stages verified running together for
the first time.** Each phase had already been built incrementally into the same `workflows/wgs.nf`, so the
only genuinely new work was a real end-to-end test with everything enabled at once (Kraken2-WGS + Mash +
seqkit + BWA-MEM2 + GATK4 together) - previously each was only tested individually or pairwise, leaving a
real, if likely, gap: did multiple real MultiQC contributions (Kraken2's native module, Mash's custom
summary, seqkit's native module, samtools stats' native module) actually mix into one report correctly when
combined, not just individually? Verified directly, twice - once manually (`nextflow run`, all 12 tasks
succeeded in 5m44s, every stage's real result independently confirmed unchanged from its own isolated test:
same 37,491 variants, same Mash top hit, same 96.07% Kraken2-unclassified, complete real per-tool version
provenance across all five tools in one `software_versions.yml`) and once via a new `requires_db`-tagged
nf-test case asserting all of that as real content, which passed (369.6s). No new bugs found - Phase 5 was
a real verification pass, not a bug hunt, and it genuinely passed.

**One honest gap, not silently closed**: the final full `--tag basic` regression re-run (the last step this
phase's plan called for, re-confirming the whole suite including metagenomics together one more time) was
still genuinely in progress - not failed, not stuck, just slow on this dev machine - when deferred at the
owner's direction ("seems like its taking too long... note down that we need to do this later, when i moved
to a better pc"). Every individual piece that run would have re-confirmed already passed in separate runs
earlier the same session (full metagenomics suite, Phase 4's two GATK4 tests, Phase 5's own new combined
test) - genuinely low risk to defer, but recorded honestly as deferred, not claimed complete. Pick-up
command and full reasoning: `docs/KNOWN_ISSUES.md`'s "Open" section, item 10.

Remaining work is Phase 6 (docs/CI/bin-script wiring) per the approved plan; BLAST+ and true cross-sample
joint genotyping stay deliberate, explicitly flagged follow-ons, not part of this build.

**One open item flagged, not yet resolved:** whether new WGS modules default on or off. The owner's
answer when asked was "on by default," which breaks from every other optional tool added this session
(MaxBin2, geNomad, CheckV all default `--skip_*` = true, specifically because of this dev machine's ~7GB
usable-RAM ceiling, [[project_dev_ram_constraint]]) — and variant-calling-grade tools (BWA-MEM2 indexing, a
haploid variant caller) plus the Mash/BLAST+/seqkit pre-flight checks haven't had their memory footprint
sized against that ceiling the way geNomad's `--splits 4` fix (`docs/KNOWN_ISSUES.md`) was after it actually
OOM-killed a run.

**Scope clarification, 2026-09-14 (owner, after Phase 3's real 6GB Mash measurement):** "real testing will
be done on AWS where resources are not an issue... hitting the RAM limitation is an issue we need to ignore
and keep trying" locally. This reframes what the ~7GB dev ceiling actually governs — it's a local
mechanics-testing constraint (does the wiring work at all), not the basis for the final default-on/off
decision, which belongs against AWS-scale production capacity instead. Local `requires_db` tests (Mash's
real 6GB peak, §6.9 Phase 3, `docs/KNOWN_ISSUES.md` #24) are expected to sometimes sit close to or exceed
this dev machine's headroom - that's a known, acceptable local limitation to keep testing around (real,
hours-long, production-representative runs happen on AWS), not a reason to stop building, skip a stage, or
treat a real measurement as disqualifying. Still not deciding default-on/off here - just correcting which
environment's capacity that decision should actually be weighed against.

**Question raised by the owner (2026-09-11):** can this toolbox also do whole-genome sequencing (WGS), not just metagenomics? **Yes** — the Nextflow DSL2 + nf-core module architecture (§6.7) genuinely generalizes beyond metagenomics. This was fact-checked the same way as the rest of this document, not taken on faith — the claim as originally proposed got some specifics right and some wrong; corrections below.

**"WGS" hides two different projects — they need different tool stacks and fit the existing toolbox very differently:**

| | Pathogen/isolate WGS | Host-animal WGS |
|---|---|---|
| What's sequenced | A cultured/isolated bacterium or virus (haploid, Mb-scale genome) | The animal's own genome (diploid, Gb-scale) |
| Answers | "What strain is this? AMR genes? How does it compare to a reference or other isolates?" | Animal genetics — not a metagenomics-adjacent question |
| Fit with the existing toolbox | **High** — sits right next to the existing Kraken2/geNomad/CheckV/MaxBin2 branch; same scale of data, same "identify and characterize an organism" narrative | **Low-to-medium** — different sample type (host tissue, not a metagenomic community), different question, own samplesheet |
| Reference genome need | Almost always available (NCBI RefSeq bacterial/viral — the same source already used for the Kraken2/geNomad DBs) | Depends entirely on species — solid for cattle/pig/chicken/a few model organisms, thin-to-absent for others |
| Recommended pipeline | **Bactopia** (bacterial) — Nextflow-native, actively maintained, MIT license — or a lightweight custom subworkflow (aligner + haploid variant caller + annotation) for viral isolates | **nf-core/sarek** — verified (2026-09-11) to run on *any* species from just a FASTA: `--fasta <custom.fasta> --genome null --igenomes_ignore`. BQSR/known-sites are optional (`--skip_tools baserecalibrator`), so the lack of a dbSNP-equivalent for a non-model species is not a blocker — accuracy is somewhat lower without it, a normal and documented trade-off |
| Compute | Light — Mb genomes, fits the dev PC easily | Moderate — comparable to a human WGS sample (commonly 16–32 GB RAM/sample); joint calling across many samples scales further but is a later-stage concern, not a blocker |

**Corrections to the claim as originally proposed (verified 2026-09-11):**
- *"BacSeq" as a bacterial WGS option* — it's real (published, MDPI *Microorganisms* 2023, PMC10385524) — not invented, unlike some of the spec's original container tags. But it's a standalone Java-GUI pipeline, not Nextflow/DSL2-modular, so it doesn't compose into this toolbox the way the claim implied. **Bactopia is the right choice here, not BacSeq** — it's Nextflow-native and MIT-licensed, built the same way as everything else in this repo.
- *"BWA-MEM2 or Bowtie2" for alignment* — for WGS variant calling specifically, **BWA-MEM2 is the standard** (the GATK best-practices aligner; better indel/soft-clip handling, which matters for variant accuracy). Bowtie2 stays in the toolbox for its current job (host depletion) but isn't the tool for this step.
- *GATK HaplotypeCaller, DeepVariant, FreeBayes "open-source and production-grade"* — correct, and licenses were verified since this repo is public and a company will use it commercially: **GATK4 — BSD 3-Clause**, fully open including commercial use (Broad Institute's 2019 relicense — this matters because the older GATK3 *did* require a paid license for for-profit use, so getting the version right is not a technicality); **Bactopia — MIT**; **DeepVariant — Apache 2.0** (Google). No licensing landmines found.

**Geneious compatibility: a non-issue.** WGS outputs are BAM (alignments), VCF (variants), FASTA (assemblies), HTML (QC reports) — every one of these was already confirmed natively importable by Geneious Prime in the existing fact-check (spec §6.1: SAM/BAM native since 2010/2011, VCF since 2012). No new Geneious work needed.

**How it would actually sit in the repo:** not as new nodes bolted onto the existing metagenomics DAG (fastp→...→MultiQC) — it's a different scientific question with its own samplesheet schema (sarek's patient/sample/lane-style sheet vs. the metagenomics `sample,fastq_1,fastq_2`). It would be a **sibling pipeline** in the same repo, sharing the infrastructure that isn't metagenomics-specific: Docker-per-tool, pinned tags, MultiQC aggregation, the `results/` convention, provenance/trace, CI/Trivy scanning, and (with one added "which pipeline?" selector) the same thin Streamlit UI. That's a fair reading of the original claim at the infrastructure level — just not true at the "drop-in module" level implied.

**Scope decision (original, 2026-09-11):** evaluated and documented as a **supported future extension**, not added to the Phase 1–4 task breakdown or effort estimates (§4) — the spec's MVP is metagenomics. Building it now would be scope creep unless prioritized explicitly. Which flavor (pathogen vs. host) matters for when it's picked up — see Q8, §6.6. **Superseded 2026-09-14 (see status update above): pathogen/isolate WGS specifically is now an actual requirement, owner-directed** — host-animal WGS (the other flavor in the table above) is unaffected by this and stays a documented-but-unbuilt extension.

Sources: [nf-core/sarek usage docs — custom FASTA, `--skip_tools baserecalibrator`](https://nf-co.re/sarek/3.5.1/docs/usage/), [nf-core/sarek GitHub — "initially designed for Human and Mouse... can work on any species with a reference genome"](https://github.com/nf-core/sarek), [Broad Institute — GATK4 open-source BSD 3-Clause announcement](https://www.broadinstitute.org/news/broad-institute-releases-open-source-gatk4-software-genome-analysis-optimized-speed-and), [Bactopia GitHub (MIT license)](https://github.com/bactopia/bactopia), [Bactopia paper, mSystems 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7406220/), [BacSeq paper, MDPI Microorganisms 2023](https://www.mdpi.com/2076-2607/11/7/1769)

### 6.10 Visual pipeline composition / per-node branch-and-checkpoint editing — raised by owner 2026-09-11, needs study, NOT scoped or built

The owner described a workflow: save the result after every node so the pipeline can branch (e.g. after host depletion, choose MEGAHIT *or* metaSPAdes, or go straight to Kraken2); come back another day, keep steps 1..N as they were, and either swap step N+1 for a different tool or change one of its parameters — with everything downstream of that change re-running, everything upstream reused. And for this to be drag-and-drop-buildable visually, not just CLI/config-driven.

**Split this into two very different pieces:**

1. **Per-node caching + branching from a checkpoint — already true today, not a new feature.** This is exactly what Nextflow's `-resume` + work-dir hash caching already does, verified repeatedly this session: change a parameter or swap a tool, only that step and everything downstream re-executes; everything upstream is reused from cache automatically. Branching is also already real, not aspirational — Kraken2 and MEGAHIT already run as independent parallel consumers of the same post-depletion reads channel (`workflows/microbox.nf`), not a sequential chain. What's missing here is small and concrete: **metaSPAdes as an alternative to MEGAHIT** (already anticipated, §6.6 item 1 — "MEGAHIT/metaSPAdes selection are runtime params with sane defaults") isn't wired up yet; that's a same-shape addition as everything built in this phase, not a new architecture.

   **Implemented 2026-09-12** (owner: "continue implementing new features," after the real-data validation and known-issues work above): `params.assembler` (`'megahit'` default | `'metaspades'`) picked exactly this as the next feature — the smallest, most architecturally-clean gap this doc itself had already flagged. Wired via nf-core's own `spades` module (`nf-core modules install spades`) run in `--meta` mode (`ext.args = '--meta'`, `conf/modules.config` — the module has no separate "metaspades" process, only this flag distinguishes SPAdes from metaSPAdes). Genuinely same-shape, not new architecture, as predicted: SPAdes already emits a gzipped `*.contigs.fa.gz`, the exact channel shape MEGAHIT produces, so QUAST, Kraken2's `GZIP_CONTIGS` branch, and the tool-version topic-channel provenance system all picked it up with zero changes. One real finding worth a correction here: the actual nf-core module pins `community.wave.seqera.io/library/spades:4.1.0--77799c52e1d1054a`, not the `spades:4.3.0--hde4eca7_1` §2.1's standalone biocontainers research found — this project installs nf-core modules verbatim (same as every other tool here) rather than hand-picking an alternate tag, so 4.1.0 is what actually ships; §2.1's table entry is now stale on this one point (not a bug, just superseded by installing the real module instead of a standalone container reference). Second finding: verified against MultiQC's own module list (`docs.seqera.io/multiqc/modules/`) that MultiQC has **no** native SPAdes/metaSPAdes module (only MEGAHIT, HiFiasm, Supernova support assembly tools) — so unlike MEGAHIT's log, `SPADES.out.log` is deliberately *not* fed to MultiQC (it would just be silently ignored); QUAST is what actually satisfies "any node can be last and still get a report" for a metaSPAdes run, since it works from the contigs FASTA itself regardless of which assembler produced it. Tested: a toy-fixture smoke run (22 contigs, 7,443bp) plus a dedicated `nf-test` case (`tests/main.nf.test`, tag `basic`) asserting real content (contigs file exists, MEGAHIT's output does NOT exist, QUAST ran against the SPAdes assembly, `software_versions.yml` names `spades`) — full 12-test suite green. Full writeup: `docs/KNOWN_ISSUES.md`.

2. **A visual, drag-and-drop pipeline *builder*** — actually dragging/arranging nodes in a GUI, not typing `--skip_x`/editing YAML — **is a different, much bigger thing, and it is confirmed as the actual ask, not a maybe.**

   **Correction (owner, 2026-09-11, same day):** earlier this session, "drag and drop" for the UI was clarified as meaning *drag-and-drop file upload* (dragging a samplesheet onto the browser) — that's what got built into `ui/app.py`'s `st.file_uploader`. The owner has now corrected this: "drag and drop" never meant a file — it means a **Figma-like canvas**: dragging tool nodes out of a toolbox/tool list and connecting them to build the pipeline visually. This is a genuine correction of an earlier misunderstanding, not scope creep — recorded here so the reasoning isn't lost. The file-upload interaction already built stays (it's still useful, just not what "drag and drop" referred to).

   This is precisely the composition GUI PLAN.md §6.8 item #12 already flagged as an explicit, owner-acknowledged deviation from the original DolphinNext spec (composition happens via CLI flags + YAML instead; "if visual composition ever becomes a hard requirement, re-evaluate — not planned"). That re-evaluation trigger has now been pulled.

   **Confirmed, evidence-backed requirement for whatever this becomes: type-compatibility enforcement between connectable nodes.** This was already in the original spec (§3.1: "Type-compatibility enforcement between connected processes") and the owner independently re-derived it (2026-09-11) from a real bug found while building the test suite: Bracken crashes (a Python traceback, not a graceful error) if fed a contigs-derived Kraken2 report instead of a reads-derived one — now fixed in code (`workflows/microbox.nf` force-skips Bracken for `input_type=contigs`). **The subtlety a naive version of this check would miss:** file-format matching alone isn't enough. A reads-derived and a contigs-derived Kraken2 report are the *exact same file format* — Bracken would happily accept either as a file; the incompatibility is about what the data actually represents (Bracken's re-estimation math assumes ~100bp-read-scale input, not whole assembled sequences), not its shape. So a real compatibility system needs domain rules layered on top of port-type matching, not port-type matching alone — e.g. a richer type taxonomy ("reads-derived classification" vs "assembly-derived classification" as distinct types despite identical file format) or an explicit per-pair compatibility rule set. Neither is designed yet; flagging the shape of the problem for whoever scopes this.

   **Honest technical read, since the owner explicitly asked "if that's not feasible in streamlit we can do it in another library":** a real Figma-style node-and-connector canvas — smooth dragging, live connector lines, click-to-select, a properties panel — is fundamentally a client-side interactive-graphics problem. Streamlit's whole model (Python re-runs the entire script top-to-bottom on every interaction, server-rendered) is a poor natural fit for that specific interaction pattern, even though third-party Streamlit components attempting it exist (e.g. wrappers around React Flow) — they're less mature than the JS ecosystem's purpose-built tools and tend to feel laggy compared to a native implementation. The tool actually built for this job is **React Flow** (a mature, widely-used node-editor library — what tools like n8n's visual builder are built on), which means a proper implementation is realistically a **separate small React frontend**, not an extension of the Streamlit app — a genuinely bigger stack decision (a JS build pipeline, a different skill-set to maintain long-term) than anything built so far, worth weighing deliberately rather than defaulting into.

### 6.11 Multi-page UI requirements — brainstormed 2026-09-11, needs study, NOT scoped or built

Same status as §6.10: a requirements brainstorm, not a design or implementation plan. Core principle, stated by the owner this round: the pipeline *engine* stays GUI-agnostic (§7 Option B — runs identically via CLI), but that was never meant to mean opaque. The GUI's job is to make the pipeline **fully inspectable and operable without feeling like a blackbox** — and a lot of what got built this session already produces exactly the data a UI could surface, without anyone framing it as a UI requirement at the time: the FAIR run-report (`results/run-report/run_<ts>.md` — run ID, session ID, git revision, full params dump, tool versions, written by `main.nf`'s `onComplete`/`onError` sections), Nextflow's trace/report/timeline files, and `docs/KNOWN_ISSUES.md`'s whole transparency culture.

**The owner's two starting ideas, validated:**

- **Pipeline page** — click a node to open a parameter dialog, hover for a tooltip showing current values. A sound, standard pattern (matches node-based editors generally — Blender's shader editor, n8n, ComfyUI). Refinements to weigh when this is actually designed, not decided now: tooltips should show *current* values, not defaults; nodes need a visual distinction between default and user-overridden parameters; node state (enabled/skipped/incompatible-connection, tying into §6.10's type-compatibility requirement) needs to be visible, not just silently enforced; modal dialog vs. a persistent side panel is open; and *building/saving a pipeline configuration* (a template, no samples) is arguably a different thing from *launching a run* (template + samplesheet + go) — could be one page or two.

- **History page** — past runs, rename/copy/duplicate/delete, internally referenced by a unique ID. This maps almost exactly onto data that already exists: `workflow.runName`/`workflow.sessionId` are already captured in every run-report, so "unique ID" isn't new work, just a UI over what's already there. Clicking into a run should open a **Run Detail view** — embed the MultiQC report, show the run-report's provenance section as-is, link to trace/timeline/report.html, and on failure surface the already-captured error text directly instead of a generic "run failed." This is where "not a blackbox" pays off most directly for work already done.

**Other pages brainstormed (unprioritized, not scoped):**

| Page | Why |
|---|---|
| Dashboard / Home | Recent runs, quick-launch, one-line environment health so problems surface before a run is attempted, not after |
| Databases / References | UI over `bin/download-dbs.sh` — what's downloaded, checksum status, trigger a new download with visible progress. Plausibly higher-value than it sounds: most of this session's friction was DB/environment management, not the pipeline itself |
| Environment / System Health | Docker daemon status, Nextflow/Java versions, disk space, WSL distro status — directly informed by lived experience this session (`docs/KNOWN_ISSUES.md` is full of exactly this class of problem) |
| Module / Tool Library | Every available tool module, its pinned container tag/version, a short description — lets an R&D scientist see exactly what ran without reading `workflows/microbox.nf` |
| Samplesheet Manager | Form/table UI to build a samplesheet against `assets/schema_input*.json` instead of hand-writing CSV |
| Compare runs | Possibly a History feature, not its own page — diff two runs' params and matching-stage tables (e.g. Kraken2/Bracken) side by side, for "did we get consistent results" trust-building |
| Export | UI action (likely from Run Detail) over the spec's `--geneious_export` concept |
| Settings | Output directory, default profile, resource limits as form fields over what's currently YAML/CLI-only |
| Help / Docs | README, a non-technical cut of `docs/KNOWN_ISSUES.md`, the runbook — so a non-expert can get unstuck without opening the repo |

All of the above need a persistent nav element (sidebar/top bar) once there are more pages than tabs comfortably hold — not designed, just noted as a requirement once page count grows.

**Additional requirement, raised by the owner 2026-09-11: exporting interactive visualizations as static images, not just files.** Prompted specifically by Pavian (spec §5.2, PLAN.md §6.7 — a live interactive R/Shiny session over Kraken2/Bracken output, a standalone service, not yet built this session), but the principle generalizes: *anything interactive the UI shows* — Pavian's sankey/tree views, the eventual Pipeline canvas itself (for documentation/sharing), any future chart component — should be savable as a static artifact (image, ideally also the underlying data as CSV/similar), not just viewable live. This is the same instinct as the FAIR run-report: a moment of insight shouldn't only exist in a live session that disappears when the tab closes. **Open, unverified — check when Pavian is actually scoped:** whether Pavian itself ships a native "download as PNG/SVG" affordance per panel (common in Shiny apps built on plotly/htmlwidgets) or whether the wrapping UI would need to provide its own capture mechanism (e.g. screenshotting an embedded iframe) — not researched this round, deliberately deferred.

**Additional requirement, raised by the owner 2026-09-11: save/import/export a pipeline configuration as a portable file.** Not the same thing as a *run* (a template + samples + results) — this is the template itself: which tools, how they're connected, their parameter values, and (since it's a visual canvas) each node's on-screen position. Same pattern several established tools already solve (Figma files, n8n/ComfyUI workflow JSON, draw.io diagrams) — worth deliberately looking at how they do it once this gets designed, rather than inventing from scratch. Breaking down what "everything" needs to cover:
- **Graph structure**: which nodes exist, which tool/module each maps to, and the edges (connections) between them.
- **Per-node parameter values** — both the ones left at default and the ones overridden (ties to the "visually distinguish default vs. overridden" refinement already noted above for the Pipeline page itself).
- **Per-node visual position** on the canvas — flagged explicitly by the owner as needing care: **different screen sizes/resolutions are a real risk here, not a hypothetical.** If node positions are saved as raw screen pixels, importing the same file on a smaller laptop screen than the one it was saved on can put nodes off-screen, overlapping, or oddly scaled. The standard fix (how Figma/draw.io/n8n handle this) is to store positions in a canvas-native logical coordinate space independent of the viewport, keep the canvas itself pannable/zoomable, and give import an explicit "fit to screen" step that re-centers/re-scales the *view* without touching the saved coordinates — not designed here, just the shape of the fix to reach for later.
- **Metadata worth including**: a name/description, a format-schema version (so a future UI version can detect and handle an older saved-file format instead of breaking silently), and possibly which tool/module *versions* each node was built against — a saved pipeline referencing a module that's since changed or been removed needs some validation/migration story, not a silent failure.
- **Correction (owner, 2026-09-11, same day):** the point above undersold this. The export is **not** just a visual/cosmetic snapshot with the real definition living elsewhere — it must be a complete, self-sufficient package. Importing it into a *different* microbox instance should reconstruct the pipeline **exactly as if it had been built there natively**: same canvas (nodes, connections, positions), and immediately runnable, not a partial/view-only copy requiring anything to be rebuilt or re-entered by hand. So one file, two sections that travel together: a **functional core** (module selection, connections, every parameter value — the part that maps directly onto what the engine already consumes via `-params-file`, so the exact same pipeline is genuinely runnable on the new instance, not just displayable) plus a **presentation layer** (node positions and similar) that only the UI reads. The engine stays GUI-agnostic not because the visual part is *missing* from the export, but because the engine simply *ignores* the presentation section it doesn't need — the CLI-only path never has to know it exists, while the GUI path gets full fidelity from the same file.
- **A concrete payoff already implied by an earlier ask this session**: this is exactly the mechanism for the "working across multiple machines" need raised earlier (§6.5-adjacent, not written there) — export a pipeline configuration on one PC, import it on another, and it's both visually identical *and* immediately runnable, no rebuilding anything by hand. If the format is plain JSON (fits this project's whole "everything human-readable, everything in git" ethos already established for configs), a saved pipeline could even be checked into the repo itself as a named, reusable template.
- **Lightly worth a mention, not designed:** basic sanity validation on import (a malformed or hostile file shouldn't be trusted blindly, given it can carry file paths and parameter values); and autosave/undo within an editing session is a related but distinct concern from explicit file export.
- **This means an actual UI-to-engine converter needs to exist (owner, 2026-09-11)** — correct, and it sharpens a fork this section had already flagged without fully connecting to it. The size of that converter depends entirely on which of two very different things the canvas turns out to be:
  - **(A) A visual front-end over the fixed pipeline shape that already exists.** `workflows/microbox.nf`'s DAG (fastp → FastQC → Bowtie2 → MEGAHIT/QUAST, Kraken2 → Bracken as an independent branch) is hand-written and doesn't change; what's already flexible is *which* of those pre-defined stages run and with what parameters, via `params.skip_*` flags. Under this reading, the converter is small and well-scoped: read canvas state (which nodes are enabled, their parameter values) and serialize it into the params YAML the engine already consumes — a translation over a fixed vocabulary, not a compiler.
  - **(B) A true visual-programming surface** where connections between arbitrary nodes, in arbitrary combinations, define the DAG itself. Under this reading, the converter has to be a genuine compiler — turning an arbitrary user-drawn graph into new, dynamically-generated Nextflow DSL2 wiring (or an equivalent interpretable execution graph) not anticipated in advance. This is a dramatically bigger problem — roughly what Galaxy, Seqera Platform's builder, or DolphinNext itself attempted — measured in months, not a feature alongside everything else built this session.
  - **Decided (owner, 2026-09-11): (A).** Reasoning: the toolbox is inherently bounded (~20 nodes at most, matching this plan's own existing framing of it — §6.7, "20 options, they won't use them all") and many combinations are invalid by real domain constraints anyway (exactly what the Bracken/contigs bug demonstrated) — so a curated, bounded set of valid arrangements is an honest fit for what this actually is, not an artificial limitation. Earlier in the same conversation the owner had asked for "arbitrary tool reordering... test all combinations", which read closer to (B); this decision supersedes that reading.
  - **Cons of (A), asked for explicitly and answered honestly, not glossed over:**
    1. The canvas can only ever expose combinations someone has already built — new tools or genuinely novel valid arrangements still need real engineering work first (fetching a module, wiring channels, handling type mismatches — exactly what every tool addition took this session). It's "visually configure from a curated menu," not "visually invent anything" — worth managing expectations against, since the Figma comparison implies more freedom than this delivers.
    2. **Two-sources-of-truth risk**: if the canvas shows which connections are valid (the type-compatibility requirement from the Bracken bug), that ruleset has to be maintained somewhere. Hand-maintained separately from what `workflows/microbox.nf` actually enforces, the two can drift — the UI could show something as fine that fails at runtime, or block something that would've worked.

       **Decided (owner, 2026-09-11): hardcode the compatibility rules independently in both the UI and the pipeline, and rely on comprehensive testing rather than a shared schema.** Weighed deliberately, not a default: given the bounded scale here (~20 nodes, real domain structure limiting most nodes to 1-3 plausible partners — so the actual rule count is dozens, not hundreds), this avoids the upfront engineering cost of a shared metadata format between what may end up being different tech stacks entirely (Groovy/Nextflow vs. Python/Streamlit or JS, §6.10). It's simpler to build now. **What it does not remove, and testing alone doesn't fix by default:** the drift risk is structural — a normal test suite covering "does the pipeline behave correctly" and, separately, "does the UI look right" will not by itself notice the UI allowing a connection the pipeline would actually reject (or vice versa), unless a test is specifically written to cross-check the UI's rule set against the pipeline's real behavior. **That cross-checking test is the one piece this decision still requires** to make "test all combinations" actually cover this risk, not just imply it does — not built yet, noted here so it isn't forgotten once the UI exists to test against.
    3. Doesn't flex for a genuinely unanticipated combination — (A) does cover what was described earlier (MEGAHIT *or* metaSPAdes *or* Kraken2 after host depletion is exactly a curated valid branch-point), but if someone wants wiring the toolbox was never built to support, (A) can't discover it on its own; it needs a developer.

**What an R&D team specifically needs, as a framing check (not engineering-driven):** launch a run without touching a CLI; trust the results (reports/tables presented clearly, not a pile of files); understand *what happened*, in plain language, when something fails; compare runs over time to build confidence the pipeline behaves consistently. Every page above maps to one of those four except Module Library and Databases, which are more "make the black box glass" for anyone curious, technical or not.

**Explicitly not decided here:** which pages are must-have vs. nice-to-have for a first pass (deliberately unprioritized); Streamlit vs. another frontend stack for anything beyond the existing thin launcher (still §6.10's open, unresolved question); any interaction detail marked "open" above (modal vs. panel, exact nav layout, etc.).

   **Not scoped, not estimated, not started yet — still needs study, per the owner's own framing.** Open questions before it can be scoped: does the canvas need to be a general-purpose graph editor, or would a much simpler guided flow (pick tool A, pick tool B, see the resulting command, in the existing Streamlit app) satisfy the actual need at a fraction of the cost? Which parameter combinations are valid to expose per node (a raw parameter surface per tool is large and mostly not meant for a non-expert to touch directly)? How does "come back another day and edit step X" reconcile with runs already being immutable/hashed by Nextflow's own caching model? Does the canvas need to *generate* the actual Nextflow DSL2 wiring (a much bigger compiler-shaped problem), or just assemble CLI flags/a params file against the fixed pipeline shape that already exists? None of this is answered yet.

### 6.12 UI technology & UI-to-backend connection — researched 2026-09-11

Following on directly from §6.10/§6.11 now that the shape of the UI is clearer (Option A converter, a real node canvas, multi-page app). Actually researched this time (owner: "go ahead and think and google"), not reasoned from memory alone.

**Canvas library: React + React Flow, now confirmed rather than assumed.** Verified 2026-09-11: **MIT-licensed**, genuinely free/open-source at the core (a separate "Pro" subscription exists for premium templates/support, not for the library itself) — current package is `@xyflow/react` (React Flow v12+; the maintainer, xyflow, also ships `@xyflow/svelte` for teams on Svelte instead). Confirmed as an active, current choice specifically for this use case, not just a plausible guess — 2026-dated sources describe it as the natural fit for "workflow automation, AI builders, node-based UI," which is exactly this project's need, and it integrates with layout engines (ELK/Dagre/D3) that would help with the "different screen sizes" concern from §6.11 (auto-layout/fit-to-screen). Checked alternatives for completeness: **Rete.js** (71k weekly downloads, 12.2k GitHub stars, framework-agnostic, built specifically for visual-programming node editors) is the most credible runner-up; **litegraph.js** is far less active (1.6k weekly downloads) and not a serious contender. No reason found to prefer an alternative over React Flow given the team would already be building a React frontend.
Sources: [React Flow — Node-Based UIs in React](https://reactflow.dev/), [React Flow Pro (confirms core library is separate from the paid tier)](https://reactflow.dev/pro), [@xyflow/react on npm](https://www.npmjs.com/package/@xyflow/react?activeTab=versions), [React Flow examples for workflow automation, 2026 edition](https://dev.to/azimahmed/react-flow-examples-for-workflow-automation-ai-builders-node-based-ui-2026-edition-3joi), [Rete.js vs litegraph.js download/star comparison](https://www.libhunt.com/r/rete)

**Backend: a Python API server (FastAPI) between the React UI and the actual Nextflow execution.** A browser can't shell out to `nextflow run` directly — something server-side has to do that, the way `ui/app.py`'s `subprocess.Popen` already does today. FastAPI is the natural choice for that server: async-native, Python (keeps the whole stack in one language the project already uses everywhere else — `bin/*.sh` aside — rather than adding Node.js as a second backend language), and it's a live, current, actively-recommended choice for exactly "React frontend + Python backend + real-time updates" as of 2026 sources.
Sources: [FastAPI WebSockets guide (2026-02)](https://oneuptime.com/blog/post/2026-02-02-fastapi-websockets/view), [FastAPI official WebSockets docs](https://fastapi.tiangolo.com/advanced/websockets/)

**Backend-to-Nextflow connection: Nextflow already has a built-in mechanism for this — `-with-weblog <url>`.** Not something to build from scratch: Nextflow POSTs live JSON HTTP events (`started`, `process_submitted`, `process_started`, `process_completed`, `error`, `completed`, each with trace/metadata) to any URL given via this flag, as the run progresses. A backend just needs one endpoint to receive them. **Found a real, working reference implementation** (`seandavi/nextflow_telemetry`) that is structurally close to what this project would need: FastAPI backend, `POST /telemetry` receiving weblog events, stored as JSONB in Postgres, with a React dashboard reading them back out. **A real caveat, not hypothetical:** weblog delivery is best-effort and async — Nextflow doesn't confirm all HTTP messages were received before exiting, so the very last event(s) at process completion can be dropped. Mitigation, not yet built: don't treat weblog as the source of truth for *final* state — use it only for *live* progress display, and treat the pipeline's own already-built FAIR run-report (`results/run-report/run_<ts>.md`, written unconditionally by `main.nf`'s `onComplete`/`onError`) as the authoritative record once a run finishes, since that gets written regardless of whether every weblog packet landed.
Sources: [nf-weblog plugin (official)](https://github.com/nextflow-io/nf-weblog), [seandavi/nextflow_telemetry — real FastAPI+Postgres+React implementation](https://github.com/seandavi/nextflow_telemetry), [GitHub issue confirming weblog can drop messages on exit](https://github.com/nextflow-io/nextflow/issues/1010)

**Frontend update mechanism: polling over WebSocket, as a default worth deliberately choosing, not assuming.** The one real comparable implementation found (`nextflow_telemetry` above) calls itself a monitoring dashboard but actually just **polls every 30 seconds**, not WebSocket or SSE — and that's a reasonable, deliberate engineering choice, not a shortcut: WebSocket adds real complexity (connection lifecycle, reconnect handling, an auth handshake per connection per current guides) that mainly pays off at multi-user, multi-tenant scale. This project's own already-decided scope is the opposite of that — §6.8 item 10: UI binds `127.0.0.1`, multi-user auth explicitly out of scope. Simple polling is the right-sized default to reach for first here; WebSocket remains an option later if live per-second updates turn out to matter enough to justify the added complexity. Not mandated — just the honest, precedented default rather than defaulting to the more impressive-sounding option.
Sources: same as above (`nextflow_telemetry`'s documented 30s polling); [PLAN.md §6.8 item 10 — multi-user auth out of scope]

**Where this leaves the existing Streamlit app (`ui/app.py`):** unchanged, not replaced. It's a small, already-built, already-tested thin launcher and stays exactly that. Everything in this section describes what a genuine multi-page visual-builder UI (§6.11) would need underneath — a separate, larger build, not an extension of the Streamlit app, consistent with what §6.10 already flagged about Streamlit's fit for this kind of interaction.

**Not decided here:** exact API endpoint shapes, database choice for run history (Postgres, SQLite, or just reading the filesystem's existing `results/run-report/` files directly — the last option might avoid needing a database at all, worth weighing once this is actually designed), auth/session handling if this ever needs it, and deployment shape (one process serving both API and static frontend, vs. separate).

### 6.13 "Any node can be last" made actually true, and a real report-norms pass — owner directive, 2026-09-11

**The problem, stated plainly by the owner:** "with 6 unique tools I would expect more than 16 tests. And if each of these nodes is the last step we should be able to write a report, no matter what was the last node." Both halves checked out as real gaps, not misunderstandings — found by re-reading the actual code, not assumed:

1. **fastp, FastQC, and MEGAHIT had no `skip_*` flag at all** and always ran unconditionally on the `fastq` entry point. Only `skip_host_removal`, `skip_kraken2`, `skip_bracken`, `skip_quast` existed. That directly contradicted §6.7's own principle ("any element can be first/last") and undercounted the pipeline's real combinatorial space — with those three genuinely independent, the fastq entry point alone has **72 distinct behavioral configurations** (2 fastp × 2 fastqc × 2 host-removal × 3 effective megahit/quast joint states × 3 effective kraken2/bracken joint states), not 12; **76 total** with the 4 contigs-entry configs. Not all 76 are exhaustively tested one-by-one in `tests/main.nf.test` — no major bioinformatics test suite (nf-core, Galaxy) does exhaustive combinatorial testing either — but every flag is now toggled independently at least once and every cascading interaction the code implements is exercised at least once (standard pairwise/boundary coverage).
2. **MEGAHIT's own output never reached MultiQC at all**, and nothing captured per-tool versions anywhere retrievable, despite PLAN.md §7.2 promising "tool versions" as part of FAIR compliance. So a run where MEGAHIT genuinely was the last meaningful stage (`skip_quast=true`) produced *no* MultiQC content for the assembly itself — a real, reachable "last node, no report" failure of the §6.7 promise, not a hypothetical.

**What "the norm" actually is — researched 2026-09-11, not assumed:**
- **Galaxy**: records the exact tool *and dependency* version for every step it runs, alongside inputs/parameters/outputs, packaged for reproducibility (RO-Crate export). Source: [Galaxy provenance overview](https://pmc.ncbi.nlm.nih.gov/articles/PMC4071198/), [gxformat2 workflow spec](https://galaxyproject.github.io/gxformat2/v19_09.html).
- **nf-core** is migrating *every* pipeline in 2026 to exactly the pattern this repo's modules already emit but never consumed: each module publishes `tuple(process, tool, version)` to a `versions` **topic channel** (Nextflow 25.04+ stable feature), the workflow subscribes once and collates it — replacing the older per-module `versions.yml` + `CUSTOM_DUMPSOFTWAREVERSIONS` module pattern. Sources: [nf-core topic-channel migration guide](https://nf-co.re/docs/tutorials/migrate_to_topics/update_pipelines), [nf-core blog — Topics, 2025](https://nf-co.re/blog/2025/version_topics), [CUSTOM_DUMPSOFTWAREVERSIONS module](https://nf-co.re/modules/custom_dumpsoftwareversions/).
- **Snakemake**'s `--report` produces one self-contained HTML with runtime stats, provenance, a rule-dependency graph (topology diagram), and results — the topology diagram specifically corroborated the DAG decision below. Source: [Snakemake reporting docs](https://snakemake.readthedocs.io/en/stable/snakefiles/reporting.html).
- **MultiQC already ships a native MEGAHIT module** — content-sniffs any file for a `" - MEGAHIT v"` header in its first 5 lines (no special filename required), extracting memory/time/contig stats. It was simply never fed MEGAHIT's log. Source: [MultiQC MEGAHIT module](https://docs.seqera.io/multiqc/modules/megahit).

**Decisions taken (owner: "take all the decisions as long as you are not cutting corners"):**
1. **`skip_fastp`, `skip_fastqc`, `skip_megahit` added** as genuine independent toggles (`nextflow.config`, wired in `workflows/microbox.nf`). Skipping fastp means FastQC/host-depletion/assembly run on raw reads instead of trimmed ones — a legitimate, if unusual, shape, matching common nf-core convention (many pipelines ship `--skip_trimming`-style flags).
2. **`skip_megahit=true` auto-force-skips QUAST** (with a `log.warn`, not a silent no-op and not a hard error) — QUAST has nothing to QC without contigs. Same "inapplicable combination made to not-happen automatically" pattern already established for `skip_host_removal`-on-contigs and Bracken-on-contigs.
3. **MEGAHIT's log is now mixed into the MultiQC file channel** — closes the "MEGAHIT-as-last-node produces no report" gap directly, using MultiQC's existing native support rather than inventing a custom summary.
4. **Tool-version collection wired up**: `workflows/microbox.nf` now subscribes to `Channel.topic('versions')` and produces two outputs — `pipeline_info/software_versions.yml` (plain per-process listing, referenced from the FAIR run-report) and `pipeline_info/software_versions_mqc.yml` (MultiQC custom-content table, auto-detected via the `_mqc.yml` suffix — no `--config` needed). Both are keyed by **`"process (tool)"`**, not by process or tool alone — a single process can report several tools (e.g. `BOWTIE2_ALIGN` reports bowtie2 + samtools + pigz) and a single tool can be reported by several processes (bowtie2 by both `BOWTIE2_BUILD` and `BOWTIE2_ALIGN`); either alone produces duplicate YAML keys, found and fixed twice in a row while smoke-testing this change before it shipped, verified valid by actually parsing the output YAML with a Python parser, not by inspection alone. Deliberately mixed into the MultiQC channel *after* the existing "nothing enabled" guard, not before — this channel always emits one file even when zero processes ran, which would otherwise silently defeat that guard.
5. **Pipeline DAG generation enabled by default** (`dag { enabled = true; file = "pipeline_dag.html" }` in `nextflow.config`) — was listed in §6.2's debugging toolkit but never actually switched on. Nextflow's `.html` DAG output is a self-contained Mermaid diagram, no Graphviz or other system dependency, consistent with every other report artifact here being one portable file. Same "always on, not opt-in" reasoning already applied to trace/report/timeline.
6. **New cosmetic Nextflow quirk found and recorded, not chased**: every guarded failure (the "nothing enabled" error, on both entry points) also prints `ERROR ~ Invalid method invocation 'doCall' with arguments: null on _closure6 type` from Nextflow's own internal `Session.notifyError`/`WorkflowMetadata.invokeOnError` machinery. Confirmed present before any of today's changes too (same symptom appeared during the earlier network-flake test failures), confirmed cosmetic (the `onError:` handler's own message still prints, the run-report still writes, the exit code is still correctly non-zero) — same class of upstream issue as the already-documented `nextflow-io/nextflow#5445`/`#5261` (`docs/KNOWN_ISSUES.md` Fixed #5), evidently not fully closed by the existing `onComplete:`/`onError:` labeled-section workaround. Logged in `docs/KNOWN_ISSUES.md` rather than silently ignored.

Sources: see inline links above (all accessed 2026-09-11).

### 6.14 Resilience to lost connectivity and multi-day/session continuity — owner directive, 2026-09-12

**The requirement, stated plainly by the owner:** "what if they lose internet, what if they go home and comeback the next day - so many things we need to consider." A standing requirement, not a one-off bug report — every future change to how runs are launched/supervised (UI or CLI) should be checked against it, the same way GUI-agnosticism (§0/standing principle at the top of this doc) is checked against every change.

**What's already real, not aspirational, verified this session:**
- **Task-level network loss**: `bin/run.sh` always passes `-resume`, and Nextflow's own work-dir hash caching means a task that fails partway through (a dropped connection mid-fetch, e.g. `host_fasta` over HTTPS, or a DB download) only needs *that* task retried, not the whole run - real, not theoretical, exercised repeatedly this session recovering from real network blips (the CheckV NERSC portal, an NCBI eutils connection reset during nf-test, both mid-session).
- **A resumed download doesn't restart from zero**: `bin/download-dbs.sh`'s curl path uses `-C -` (resume partial download), added after the real CheckV slow-download incident.
- **A killed/restarted run resumes, doesn't repeat work**: because of `-resume`, even a run killed outright (machine sleep, shutdown, terminal closed - see §6.15's WSL2 finding below) picks back up from cached progress on the next invocation of the same command.
- **A finished run's result survives a UI session ending**: Fixed #21 (`docs/KNOWN_ISSUES.md`) - the report is a file, not something living only in one browser tab's memory.
- **A *still-running* run's status survives a UI session ending**: the PID-file reattachment mechanism added 2026-09-12 (`docs/KNOWN_ISSUES.md`'s "Three... UI quality-of-life additions" entry) - a fresh session (reload, new tab, different device) can tell "still running" from "finished" from "never started," not just the latter two.

**What's a real, found-not-assumed gap, not yet closed:** WSL2 tears down its entire VM (killing every process in it, pipeline included) shortly after the last `wsl.exe` client disconnects - closing the terminal window that launched the UI, not just closing a browser tab pointed at it, kills an in-progress run outright regardless of any Linux-side process-detaching trick (`setsid`/`nohup`/`disown` all tried, verified not sufficient). The practical mitigation today is not fully closing that terminal window (minimizing it is fine); the real fix (`vmIdleTimeout` in `%USERPROFILE%\.wslconfig`) is a machine-wide Windows setting outside this repo, deliberately left for whoever sets up a given machine to add themselves rather than applied silently. Full writeup: `docs/KNOWN_ISSUES.md`'s "WSL2 VM lifecycle..." entry.

**Not yet built, real future work if this needs to go further:** fully unattended recovery (a run that survives an actual machine reboot with zero human action to restart it) would need a real supervising service - a systemd unit, a Windows Scheduled Task, or similar - watching for "was a run in progress when this machine last shut down cleanly/uncleanly" and re-invoking `bin/run.sh` automatically. Nothing this session built does that; it's a genuinely different, larger piece of infrastructure than a thin launcher script, not a quick addition - scope it properly before building it if the team decides they need it, rather than bolting on a partial version.

### 6.15 Quality-of-life requirements for the future node-based composer — brainstormed 2026-09-12, needs study, NOT scoped or built

Same status as §6.10/§6.11: a requirements brainstorm, not a design or implementation plan - recorded now (owner: "make sure to write it down... very important quality of life changes") so it isn't lost before the visual composer itself gets scoped. None of this is implementable against the *current* thin Streamlit launcher, which has no node-selection concept at all (just samplesheet + environment + Run) - it all depends on §6.10's not-yet-built drag-and-drop pipeline canvas existing first.

1. **Per-node resource/timeline warnings at selection time** (the owner's explicit ask): when a user is choosing which tool/node to add to their pipeline, show - before they commit to it - the RAM it needs (ideally both a "typical" figure and the real worst-case this project has already measured, e.g. geNomad's mmseqs2 step genuinely needing ~9GB even with `--splits` applied, `docs/KNOWN_ISSUES.md`), an estimated runtime for the current input size, and a clear warning if the machine the pipeline is about to run on doesn't have enough headroom for it. This directly builds on real data this project already collects: nf-core's `process_low/medium/high` resource labels (`conf/base.config`) are an existing *declared* per-tool ceiling; Nextflow's own trace file (`pipeline_info/execution_trace.txt`, already generated every run) records *actual* per-task peak memory and realtime - a history of real runs could turn "estimated timeline" from a static guess into a genuine data-backed estimate over time, the same way this session had to discover several tools' real memory needs empirically (Kraken2, geNomad) rather than trusting the advertised label.
   **Workflow ordering + a two-tier warning split, refined 2026-09-13 (owner):** the composer's natural flow is build the pipeline (pick nodes) first, choose the input file afterward - this resolves part of the "not decided here" ambiguity below by splitting warnings into two kinds with different timing: (a) **node-intrinsic/machine-dependent warnings** - a node's own declared or measured RAM ceiling against *this machine's* available RAM (e.g. "this combination of nodes needs 7.5GB / 8GB available") - are knowable the instant nodes are selected, independent of which file will eventually run through them, so show these live during pipeline-building, before any file is chosen; (b) **file-dependent warnings** - anything that scales with input size (a DB pre-flight sized to the actual file, a runtime estimate, disk headroom for that specific file's outputs, item 4 below) - are structurally impossible to show until a file is actually selected, so these only appear once step 2 (file selection) happens, not before. Don't force a fake/placeholder estimate for (b) just to show *something* during pipeline-building - an honest "depends on the file you choose" beats a number with no real basis.
2. **Live per-stage progress, not just a spinner** - the current UI's "Running..." state shows a raw log tail (real signal, but noisy); a node-based composer's natural richer view would highlight which node is currently executing and how long it's been running, using the same trace-file/log data §1 already wants collected.
3. **DB/reference-file presence pre-flight**, not just disk space (§ below) - if a node needs a database (Kraken2, geNomad, CheckV) that hasn't been downloaded yet, catch that before the run starts with a clear "run `bin/download-dbs.sh <variant>` first" message instead of a Nextflow `checkIfExists` stack trace partway through a run. Not wireable into the *current* UI (it doesn't expose per-tool DB-path params at all yet); belongs with the composer once individual nodes' params are user-editable.
4. **Disk-space awareness scaled to the actual selection**, not just a flat floor - the flat 10GB warning added 2026-09-12 (`docs/KNOWN_ISSUES.md`) is a stopgap; a real per-run estimate (sum of the DBs/outputs the *specific selected nodes* will need) belongs here, once the composer knows what's actually selected.
5. **A working Cancel that's node-aware** - the flat process-group Cancel added 2026-09-12 stops the whole run; a composer showing individual node status could offer to let already-finished upstream nodes' outputs survive a cancellation (they're already cached via `-resume` regardless - the composer would just need to surface that rather than presenting Cancel as "throw away everything").
6. **Export/import fidelity carrying this metadata too** - §6.11's existing export-format requirement (functional core + presentation layer, one file, fully reconstructable elsewhere) should eventually also carry each node's last-known resource/timeline stats forward, so re-opening an exported pipeline shows the same estimates without needing a fresh run first.
7. **An in-app helper/guide for adding a tool or getting oriented - explicitly a "nice to have," not a requirement** (owner, 2026-09-12: "as a nice requirement we can have a build a plugin or add a tool to the app helper or web page to guide them or make it very easy. this is not a necessity just a nice to have"). Two different things this could mean, both worth keeping open rather than picking one prematurely: (a) an in-app wizard/onboarding flow inside the eventual composer UI itself - closest analogue already decided is Nielsen heuristic 10 in `docs/TESTING.md` §4.1 ("help and documentation"), which already flags the *current* thin UI has zero in-app help; a composer-era version of this would be a real guided flow, not just a help link; (b) a separate documentation site/portal (e.g. a static docs site built from `docs/`) rather than (or alongside) in-app help - lower engineering cost, easier to keep current, but doesn't help someone who's already inside the app and stuck. **What already exists that partially covers the underlying need, today, without waiting for the composer**: `CONTRIBUTING.md` (added 2026-09-12) is exactly this guidance in written form for the most common maintenance task ("how do I add a tool") - not in-app, not interactive, but real and current. Revisit this item once the composer (§6.10) is actually being scoped, since an in-app wizard only makes sense once there's an app-with-nodes to be guided through in the first place.

8. **Edit-as-copy + rename, for both a run's pipeline and any saved pipeline** (owner, 2026-09-14, raised
   while discussing Run History's planned mini pipeline-shape view): a pen/edit icon next to a past run (or any
   saved pipeline configuration) should open it in the Composer as an independent, editable copy - the
   original run's own config is never mutated in place, since a run's actual output already happened against
   whatever it was configured with at the time and must stay a truthful record of that. Also needs a rename
   capability - today a run only has its auto-generated `run_<timestamp>` id and a saved pipeline snapshot
   (§6.11's Save/Import) has no name field at all, so there's currently nothing to even rename. Depends on
   §6.11's export/import format gaining a name field (noted there as a gap: "no name/description metadata on a
   saved pipeline") and, for runs specifically, on Run History having somewhere to persist a per-run display
   name (today `RunSummary` is just `{ id, startedAt, hasReport }`, sourced from the run directory's name -
   `serve-results-plugin.ts` - not a separate metadata store). Not scoped or built - recorded now so it isn't
   lost before Run History's mini pipeline-shape view (also raised 2026-09-14, see the composer-ui README once
   built) gets designed.

**Not decided here:** exactly how "estimated timeline" should be computed (a static per-tool table vs. a real historical-runs database vs. something scaling with detected input size) - though item 1's timing split above at least settles *when* each kind of warning can honestly appear; what "the machine's headroom" means precisely when the pipeline might run on a different, more capable machine than the one composing it (dev laptop composing a pipeline meant for the AWS `test` environment or the `prod` VM - PLAN.md §1.1's environment model already treats these as genuinely different capacity tiers - now also the normal Windows EC2 VM per §7/§6.6's resolved deployment decision); and whether any of this needs new instrumentation beyond what Nextflow's trace file already provides.

### 6.16 Composer UI requirements list + tool shortlist — owner directive, 2026-09-13; prototype built and verified same day

**Owner's request, verbatim in shape:** a Figma-like node canvas, drag nodes from a categorized palette
(visualization, classification, etc.) onto the canvas, each node clickable and hoverable, a navigation menu
between different pages, and **French/English language switching called out as very important**. Asked
explicitly for a requirements list first (Must-have / Nice-to-have / Don't-need), *then* to use it to find
the right tool - not the other way around, then ("go ahead and do further testing, then select an option and
start coding. no need for my input") explicit authorization to pick from the shortlist and build a real
prototype without further sign-off.

**Status update, same day: a real, working prototype now exists at `composer-ui/`** (a separate React app -
see its own `composer-ui/README.md` for the full detail, not duplicated here). Selected the already-shortlisted
stack (React Flow / React Router v8 / react-i18next) and built a genuine vertical slice: the categorized
draggable palette (real tool catalog mirroring `workflows/microbox.nf`, not invented examples), a working
canvas (drag-drop node creation, click-to-select with a detail panel, hover tooltips, connectable edges),
multi-page navigation (Composer + a placeholder History page), and live French/English switching covering
every string including already-placed canvas nodes. **Verified for real, not just written**: manual browser
testing via `claude-in-chrome` against the actual running dev server (drag-drop, click-select, live language
switching, real client-side route navigation all separately confirmed working), a 13-test Vitest suite (i18n
key-parity between locales, catalog-to-translation cross-checks, a real language-switch assertion, a real
route-navigation assertion), a clean `tsc -b`, a clean `oxlint` pass, and a successful production build.

**What this prototype deliberately does NOT do** (scoped intentionally, not an oversight - see
`composer-ui/README.md` for the full list): no backend connection to actually run the pipeline (the FastAPI/
`-with-weblog` piece from §6.12 is separate, unbuilt scope); no save/load of a pipeline configuration (§6.11's
full export/import fidelity requirement); no type-compatibility enforcement between connected nodes (§6.10's
confirmed requirement - any node can currently connect to any other node); the History page is a literal
placeholder proving only that routing works, not a real feature.

**This is still not the same thing as "the composer is scoped and being built as a product"** - it's a
requirements-list-plus-verified-prototype pass, same spirit as every other item in this document marked
"needs study." The remaining open questions from §6.10/§6.11 (does the canvas need to *generate* Nextflow
wiring or just assemble a params file against the fixed pipeline shape; how "come back another day and edit
step X" reconciles with Nextflow's immutable run-hashing; exact page inventory beyond Composer/History) are
all still genuinely open - a working UI shell doesn't answer them, it just gives something concrete to answer
them against.

**Important context carried forward, not re-derived from scratch:** §6.12 (2026-09-11) already researched
and confirmed **React Flow (`@xyflow/react`)** as the canvas library for exactly this "Figma-like node
editor" need - MIT-licensed, the standard tool for this in the current React ecosystem. That research is
re-verified below, not redone. What's genuinely new in this request and *not* covered by §6.12: the
categorized drag-source palette, multi-page navigation, and i18n - none of which were part of the earlier
canvas-only research.

#### Requirements

**Canvas / node editing**
- *Must-have*: drag nodes from a palette onto a canvas; connect nodes with edges; pan/zoom; click a node to
  select/inspect it; hover a node for a quick-info tooltip; visually distinguish node state (default vs.
  overridden params, enabled vs. skipped, valid vs. incompatible connection - all already required by
  §6.10's type-compatibility finding and §6.11's Pipeline-page refinements, carried forward here rather than
  restated as new).
- *Nice-to-have*: auto-layout/auto-arrange, a minimap, undo/redo, keyboard shortcuts.
- *Don't need*: real-time multi-user collaborative editing (Figma's actual signature feature) - out of
  scope, consistent with §6.8 item 10 (multi-user auth explicitly not needed); canvas performance at
  thousands-of-nodes scale (this toolbox is ~20 nodes total, per §6.10's own bounded-scale reasoning).

**Node palette / categorization**
- *Must-have*: nodes grouped into categories (QC, assembly, classification, visualization, etc., per the
  owner's own examples) in a side panel; each node draggable onto the canvas from there.
- *Nice-to-have*: search/filter within the palette, collapsible category groups, per-node icons.
- *Don't need*: a plugin/marketplace system for arbitrary third-party nodes - the toolbox is curated and
  bounded (§6.10's Option A decision), not an open extension platform.

**Navigation / app shell**
- *Must-have*: a persistent navigation menu between distinct pages/views - already flagged as a requirement
  in §6.11 once page count grows (Pipeline/Composer, Run History, Run Detail, at minimum).
- *Nice-to-have*: bookmarkable/shareable URLs per page or per run; breadcrumbs.
- *Don't need*: role-based/permissioned navigation - no multi-user model exists or is planned.

**Internationalization (French/English) - called out explicitly as very important**
- *Must-have*: a real i18n architecture from the start (not bolted on later) covering all UI chrome, node
  names/descriptions/tooltips, and navigation - a live toggle between French and English, not a
  build-time-only choice.
- *Nice-to-have*: designed so a third language is cheap to add later (a proper key/locale-file structure
  rather than hardcoded strings), even though only two are needed now.
- *Don't need*: automatic translation of dynamic pipeline output (tool logs, error text from Nextflow/the
  underlying bioinformatics tools) - that text is English-only from upstream and machine-translating it
  would risk misrepresenting a real scientific error message; translate the *UI*, not tool output.

**Persistence / export** (cross-reference, not new - §6.11 already requires this in full)
- *Must-have*: save/load a complete pipeline configuration (functional core + presentation layer, one
  portable file, fully reconstructable on another machine) - already specified in detail in §6.11, repeated
  here only as a reminder that whatever tool is chosen must support serializing canvas state cleanly.
- *Don't need*: cloud sync/real-time multi-device sync - no cloud UI exists or is planned (§7's resolved
  Seqera decision).

**Platform / deployment fit**
- *Must-have*: runs entirely locally, no internet dependency at runtime (aligns with the resilience
  requirement, `docs/planning/PLAN.md` §6.14) - a browser-based app is fine since it's OS-agnostic and the
  production target is a normal Windows VM (§7's resolved deployment decision), but all assets must be
  self-hostable, not CDN-only.
- *Must-have*: the GUI-agnostic contract stays intact - the pipeline engine is untouched, and this UI talks
  to it the same way `ui/app.py` does today (CLI/params-file in, `results/` files out), not by reaching into
  `workflows/microbox.nf` directly.
- *Don't need*: mobile-responsive design for v1 - a desktop scientific tool, not a phone-first product.

**License / cost**
- *Must-have*: free and open-source at the core, no per-seat licensing - matches this project's whole
  ethos and its explicit rejection of paid platforms (Seqera Platform ruled out, §7).
- *Don't need*: any paid "Pro" tier - React Flow's core is MIT-licensed and sufficient (§6.12), and nothing
  in the requirements above needs its paid tier's premium templates/support.

#### Tool shortlist (verified live 2026-09-13, not assumed from §6.12's 2026-09-11 research alone)

- **Canvas: React Flow, now published as `@xyflow/react`, re-confirmed still active and current.** Its own
  official docs demonstrate exactly the categorized-sidebar-drag-to-canvas pattern this request describes
  (a custom `Sidebar` component holding draggable node templates, dropped onto the `ReactFlow` pane) - this
  is a documented, first-class use case, not something to build against the grain of the library.
  Source: [React Flow — Drag and Drop example](https://reactflow.dev/examples/interaction/drag-and-drop),
  [xyflow/xyflow discussion — sidebar with draggable node templates](https://github.com/xyflow/xyflow/discussions/2928).
- **Navigation: React Router, now at v8 (confirmed current as of August 2026)** - the standard React routing
  library, actively maintained; note for whoever implements this: `react-router-dom` no longer exists as a
  separate package as of v8, it's folded into `react-router` itself - don't reference the old package name.
  Source: [React Router v8 release coverage, InfoQ, 2026-08](https://www.infoq.com/news/2026/08/react-route-v8/),
  [React Router changelog](https://reactrouter.com/changelog).
- **Internationalization: `react-i18next`** - the dominant choice for React i18n (~8M weekly downloads, by
  far the largest ecosystem of the alternatives), explicitly supports dynamic runtime language switching
  and namespace-based translation-file organization - directly satisfies "switching between French and
  English is very important" plus the "cheap to add a third language later" nice-to-have via its locale-file
  structure. `react-intl`/FormatJS (ICU-standard, more enterprise-formatting-focused) and LinguiJS (smallest
  bundle, ~3KB) are credible alternatives if bundle size or ICU compliance ever become a deciding factor,
  but neither has a compelling reason to be preferred here over the ecosystem-standard choice.
  Source: [react-i18next vs react-intl comparison, locize, 2026](https://www.locize.com/blog/react-intl-vs-react-i18next),
  [Best i18n libraries for React 2026, PkgPulse](https://www.pkgpulse.com/guides/best-i18n-libraries-react-2026).

**What this does NOT decide:** whether to actually build this (still §6.10/§6.11's open "needs study, NOT
scoped or built" status - a requirements list and a tool shortlist are inputs to that decision, not the
decision itself); the FastAPI backend/weblog architecture from §6.12 is unaffected by any of this and still
stands as the separately-researched plan for the UI-to-pipeline connection; exact page inventory beyond what
§6.11 already brainstormed; and how the "curated bounded toolbox" (§6.10 Option A) maps onto the specific
category names the owner used as examples (visualization, classification) - those need to be enumerated
against the real current toolbox once this is actually scoped.

### 6.17 Run results view — critiqued and researched 2026-09-14, needs study, NOT scoped or built

Follows on from §6.15 item 8 (edit-as-copy pen icon, already logged there). Owner's starting proposal: a
Run History entry opens a smaller reproduction of the pipeline shape the user actually drew (same layout,
via canvas snapshot replay); clicking a node scrolls the page to that node's result section, or opens a new
tab if the result "needs its own page"; a pen icon next to the run opens its pipeline in the Composer as an
independent editable copy (never mutating the original run's record).

**Open question the owner raised, and the driver for everything below:** does the result view show every
node's output, or only the final node(s)? Resolved by reasoning from this project's own standing principle
(PLAN.md line 10: the GUI's job is to make the pipeline "fully inspectable... without feeling like a
blackbox") plus the fact that the engine already publishes every tool into its own `results/<tool>/`
directory (`conf/modules.config`) - the data already exists per-node, it just isn't surfaced yet. **Decided
direction: per-node, not final-only**, with final/aggregate (MultiQC/Pavian) staying the rollup view, not
the only view.

#### Critiques of the initial proposal

1. **Inconsistent interaction model** - nothing specifies which nodes scroll in-page vs. open a new tab;
   that was left as an ad hoc per-build judgment call, which drifts inconsistent as more tools get added.
2. **Doesn't actually solve node disambiguation** - a mini-map alone only disambiguates two same-tool nodes
   (the pipeline already has this exact case: the pre-/post-depletion Kraken2/Bracken pass,
   `conf/modules.config` lines ~60-82) if it's keyed by node instance ID, not tool name. As proposed,
   clicking "Kraken2" is still ambiguous when two exist.
3. **No run-status encoding** - a results view implies a completed (or partially completed) run, but nothing
   color-codes success/failed/skipped per node; composer already has an enabled/skipped concept at build
   time (§6.16), a results view with no equivalent at run time is a step backward.
4. **"The result of a node" is ambiguous for multi-artifact tools** - e.g. Kraken2 alone produces a report, a
   classified-reads file, and a MultiQC contribution; undefined which of those "the result" means per tool.
5. **No handling for non-viewable/binary outputs** - assembly outputs (`metaspades`/`megahit`) are FASTA/BAM
   scale; "scroll to the result" implies renderable content, which has to degrade to a summary-stat +
   download for these.
6. **Mini-map fidelity isn't guaranteed** - composer already has its own auto-layout engine
   (`composer-ui/src/utils/autoLayout.ts`); if the results mini-map re-runs that instead of replaying the
   saved canvas snapshot (`importCanvasSnapshot.ts`), "same shape as they made" silently stops being true.
7. **Performance risk from eager inline rendering** - History already embeds one MultiQC report in an
   `<iframe>` (`HistoryPage.tsx`); N per-node reports all mounted on one page for a 15-20 node pipeline needs
   lazy-loading (render on scroll-into-view/click), not eager mount-all.
8. **No deep-linking** - nothing lets a specific node's result in a specific run be bookmarked/shared
   directly; inconsistent with this project's existing FAIR/reproducibility culture (run-report, git
   revision + params dump on every run, per §6.13).
9. **Edit-as-copy inherits an already-logged gap** - §6.15 item 8 already flags that saved pipelines have no
   name/description field; a copy of a nameless thing is still nameless.
10. **Undefined scope for parameters vs. topology on copy** - does edit-as-copy carry the run's actual
    parameter overrides forward, or just node/edge shape? Not deciding this is fine, leaving it silently
    unaddressed is not.
11. **No accessibility path** - click-only navigation on a node graph excludes keyboard navigation between
    results, inconsistent with the Nielsen-heuristic accessibility bar `docs/TESTING.md` already applies.
12. **Live/in-progress runs unaddressed** - fine to defer, but should be an explicit v1-out-of-scope note,
    not a silent gap discovered later.

#### Requirements this produces

1. **Key every node's results by node instance ID, not tool name.** The mini-map replays the saved canvas
   snapshot (reusing `importCanvasSnapshot.ts`); every click/scroll/highlight target resolves against a
   unique node ID, so duplicate-tool nodes stay distinguishable.
2. **The engine should emit outputs keyed by node ID**, via the still-open UI-to-engine converter (§6.11),
   rather than the current pattern of a hand-written `withName` override + `ext.prefix` suffix per known
   duplicate (today's `_predepletion` fix, `conf/modules.config`) - that pattern doesn't scale to a general
   composer where a user can draw a duplicate anywhere.
3. **Define a per-tool "result contract"**: primary artifact(s), display mode, and whether it's inline or
   new-tab - a property of the tool catalog entry (`composer-ui/src/data/toolCatalog.ts`), not an ad hoc call
   per build. See the visualization-vs-values split below for what that display mode should actually be, per
   tool.
4. **Encode run status per node in the mini-map** - success/failed/skipped/not-yet-run, visually distinct.
5. **Lazy-load per-node result content** - mount only when scrolled into view or opened.
6. **Give every node result a stable, shareable URL** (route or hash per node ID).
7. **Extend export/import + Run History metadata with a name/description field**, and make edit-as-copy state
   explicitly whether it copies topology only or topology + parameter overrides.
8. **Support keyboard navigation between nodes/results**, not mouse-only.
9. **Explicitly scope v1 to completed runs only**; log live/in-progress result viewing as a separate,
   deliberately deferred future item.

#### What the toolbox for this project (§9.1) needs to show, researched against real pathogen-discovery
   practice and this project's actual R&D use case (vaccine-relevant pathogen/viral candidate discovery),
   not assumed

Owner supplied three reference images (a Sankey taxonomy-flow diagram and two Krona radial charts) as the
expected shape for Kraken2/Bracken results - both are confirmed, real, purpose-built outputs already
produced by tools in this space (Pavian renders Sankey diagrams from Kraken2/Bracken/MetaPhlAn4 input
specifically; Krona is the standard interactive radial drill-down), not something invented for this project.
Researched every other node the same way rather than assuming a chart is always warranted - **not every node
needs a visualization; several just need a values/stat table, which is intentionally the smaller build.**

**Nodes that earn a real chart** (the data is structurally/relationally shaped - a table would lose the
signal):
- **kraken2 / bracken** - Sankey diagram (Pavian-style, read-count flow across taxonomic ranks) **and** a
  Krona radial chart (interactive per-sample drill-down) - both, not one, per the owner's reference images;
  shown for the pre- **and** post-depletion pass separately, since the delta between them is itself the
  useful QC signal (if the taxonomic profile barely changes after host depletion, depletion likely
  underperformed).
- **fastp / fastqc** - per-base quality line plot and adapter-content curve (both already produced by
  MultiQC's fastp/FastQC modules from JSON/report input) - trend-over-read-position is the signal a single
  number can't show (e.g. adapter content rising specifically toward the 3' end).
- **megahit / metaspades + quast** - cumulative-length curve at minimum (QUAST's own Icarus contig viewer if
  budget allows) - contiguity is a distribution (many similar contigs vs. one dominant one), not a scalar;
  N50 alone doesn't distinguish those cases.

**Nodes that only need a values/stat table** (deliberately no chart - confirmed by researching each tool's
own typical output that no standard/canonical plot exists, or that a table is what practitioners actually
use):
- **bowtie2 (host depletion)** - % reads aligned to host / % remaining per sample. Sample-type dependent in a
  way worth showing as a plain number for comparison against known ranges (e.g. stool <0.5% host is normal,
  a nasal/respiratory sample >90% host is also normal - the number needs context, not a chart).
- **genomad (viral discovery)** - sortable table: contig ID, virus score (0-1, calibrated probability, 0.7
  is geNomad's own default pass threshold), marker enrichment. No canonical plot exists in geNomad's own
  documentation; this is the primary triage output a vaccine-relevant candidate search would act on directly,
  so sortability by score matters more than a visualization would.
- **checkv (viral genome QC)** - sortable table: contig ID, completeness %, contamination flag, confidence
  tier (high/medium/low, CheckV's own tiers based on median unsigned error). Gate before trusting a geNomad
  hit enough to act on it - a high-score geNomad hit with low CheckV completeness is a materially different
  finding than a high-score, high-completeness one, so these two tools' outputs should be joined in one row
  per candidate, not shown as two separate unrelated node panels.
- **maxbin2 (binning)** - table: bin ID, estimated completeness, genome size, GC%, coverage - and explicitly
  flagged in the UI as an internal/optimistic estimate (MaxBin2's own completeness estimate is known to run
  optimistic; CheckM is the usual independent second opinion, not currently in this pipeline), so it isn't
  presented with the same authority as CheckV's database-calibrated numbers.
- **multiqc / pavian (reporting)** - stays the rollup/aggregate view, not a per-node values table; its job is
  spotting a sample-specific or pipeline-wide outlier, from which the user clicks into the specific node
  that's off.

**Further research into what the team would actually expect, beyond the display format:**
- **A real deployed product doing the same job (CZ ID / IDseq, Chan Zuckerberg Initiative's open-source
  mNGS pathogen-detection platform) confirms the shape of a good taxon-level result view goes beyond a
  chart alone**: its Sample Report table shows two alignment-confidence metrics per taxon (NT and NR
  database alignment, not just a single count), supports filtering to a taxon category (bacteria/virus/
  eukaryote) and a "known pathogen" tag pulled from a curated pathogen list, and a cross-sample heatmap
  colored by relative abundance for comparing multiple runs at once. Directly relevant precedent for this
  project's kraken2/bracken and genomad result views: a sortable/filterable table alongside the chart, with
  a pathogen-relevance flag, is what a real team in this exact space actually uses day to day - not the
  chart in isolation.
- **This pipeline's real place in a vaccine R&D workflow is upstream triage, not final antigen selection** -
  reverse-vaccinology candidate-selection criteria (antigenicity, surface exposure, cross-strain
  conservation, host-protein dissimilarity) are a separate, downstream analysis this pipeline does not
  perform and has no node for. What this pipeline's result view needs to get right is handing off a clean,
  well-flagged, **exportable** candidate list (genomad score + checkv completeness/contamination/confidence
  joined per contig) to whatever reverse-vaccinology tooling comes next - export fidelity on the
  genomad/checkv table matters more here than it would for a purely informational node, since real downstream
  work depends on it leaving this UI intact.
- **QC-dashboard literature (QuaC and related clinical-NGS QC-standardization work) reinforces the
  go/no-go-per-node requirement already listed above**: the recurring failure mode called out across that
  literature is QC output scattered across multiple tools with no standardized review, so downstream users
  proceed unaware of a real QC issue. A "Sample QC Review System"-style flag per node (this project's
  requirement #4 above) is exactly the mitigation that literature converges on, not a nice-to-have.

**Not decided here:** exact chart library/rendering approach for the Sankey/Krona/cumulative-length
visualizations (reuse Pavian/Krona's own JS, or build against a charting library already in scope for this
stack - unresearched); whether the genomad+checkv joined-candidate table needs its own export format beyond
whatever §6.11's general export/import fidelity requirement already covers; exact wording/placement of the
per-node go/no-go indicator described in requirement #4.

## 7. Key decision: platform choice (owner decision required)

The spec (§2, §4.2) mandates DolphinNext, but research (§2.2) proves the official image/repo/docs no longer exist. Options:

| Option | What it means | Risk / effort |
|---|---|---|
| **A. Nextflow DSL2 + nf-core (no GUI)** | Build the pipeline directly in Nextflow DSL2 using maintained nf-core modules; CLI-driven. Keeps every spec goal except the web GUI: Docker-per-tool, resume, reports, MultiQC, provenance (git + Nextflow traces), standalone script, Geneious export | Low risk, days to working pipeline |
| **B. Modern GUI on top (e.g., Seqera Platform) + nf-core pipeline** | Same pipeline as A, plus a maintained web GUI for monitoring/runs — closest modern equivalent of DolphinNext's GUI + provenance | Needs a short evaluation of free-tier/self-hosted options |
| **C. Stale DolphinNext community rebuild** | Run the 2023 third-party image (`jdlamstein/dolphinnext-studio`, ~6 GB) — literal spec compliance incl. GUI | High risk: Ubuntu 16.04 / PHP 7.2 EOL, no security support, Nextflow baked in via `get.nextflow.io` at build time (Dec 2021 ≈ v21.x), likely breaks with modern Nextflow |
| **D. Modernize DolphinNext in-house** | Fork + port the PHP/Python2 app to a modern stack (PHP 8, MariaDB, Python 3) | Multi-week effort, uncertain outcome, no upstream |

→ **Decision (owner, 2026-09-11): Option B — GUI-agnostic Nextflow DSL2 + nf-core pipeline; the testing UI is a small thin Streamlit app (owner, 2026-09-11); Seqera (or another UI) remains an option at the handover decision gate.**

→ **Decision gate RESOLVED (owner, 2026-09-13): Seqera is not needed at all, in any form.** "AWS will host a normal Windows VM, just like any PC, and we will run the app on it - it's going to have both the UI and everything. I don't think we need Seqera cloud at all. No need to do anything for it." Production deployment is the exact same stack already built and validated locally (WSL2/Docker Desktop + this pipeline + the Streamlit UI, `bin/run.sh`/`bin/run-ui.sh`) run on a Windows EC2 instance instead of a local PC - not a Nextflow AWS Batch/cloud-executor setup, not a managed platform, no new architecture. The whole "Seqera deployment options"/"decision gate at handover" discussion below is now moot - kept in this document for its research value (what was considered and why it was ruled out) but no longer an open decision. The Streamlit UI (`ui/app.py`) is the permanent UI, not a placeholder pending a later choice.

Seqera deployment options — evaluation deferred to the handover decision gate (verified 2026-09-11 via https://seqera.io/pricing/):
- **Seqera Cloud "Basic" — free tier** ("Sign Up for Free"): 3 users, 3 concurrent runs, 250-run history, 100 vCPUs, usage-based beyond that; the UI runs in Seqera's cloud and drives your own compute (AWS/on-prem).
- **Self-hosted** on the prod VM (docker-compose/Kubernetes) — currently an **Enterprise plan** item (custom quote); the former "Community Edition" page 404s. Confirm with Seqera during Phase 1.
- **Academic Program** — free expanded access for qualifying academic institutions (check eligibility; likely N/A for a company).
- **Fallback that always works:** the pipeline is **GUI-agnostic** — identical runs via plain CLI; the GUI is an optional overlay that can be added at any time. Dev/mock testing: free tier or CLI; company's real-data AWS phase: Cloud Basic; prod cutover: depends on the self-hosted quote.

**Is Seqera fully free for us? — honest assessment + UI decision gate (owner question, answered 2026-09-11):**

*Free tier, exactly (from the pricing page, 2026-09-11):* 3 users, 3 concurrent runs, 250-run history, 100 datasets (10 MB upload size), 100 vCPUs of managed compute, 5 managed compute environments; usage-based charges beyond (CPU $0.10/hour, memory $0.025/GiB-hour, storage $0.025/GB-month). No SSO, no audit logging, no SOC 2/HIPAA on Basic (Enterprise features). The UI itself runs in Seqera's cloud — run metadata/workspace live there, while the actual sequence data stays on the company's own compute.

*Verdict:* free and sufficient for development and mock-data testing (well inside all caps). For the company's production use, "fully free forever" is **not guaranteed**: the 3-user / 3-concurrent-run / 250-run-history caps can bite as usage grows, and a fully local UI requires the paid Enterprise self-hosted plan (custom quote). The pipeline itself is unaffected — the GUI is an overlay.

*Options compared (verified 2026-09-11; no maintained open-source Nextflow web UI was found):*

| Option | Cost | Effort | Limits / notes |
|---|---|---|---|
| Seqera Cloud Basic | Free tier → usage-based | Zero build | Caps above; UI in Seqera's cloud (company must accept); no offline guarantee |
| Seqera self-hosted | Enterprise quote (paid) | Setup only | Local, private, unlimited — but recurring cost; get quote in Phase 1 |
| DIY thin UI (Streamlit or similar) | Free forever | Days (launcher) to weeks (monitor) | 100% local/offline/private, no caps, tailor-made for the team ("choose samplesheet → Run → open report"); we build and maintain it — handover burden. **Chosen by the owner as the testing UI (2026-09-11)** |
| No UI (CLI + MultiQC reports) | Free | Zero | Always works; reports are HTML in the browser |

*Decision gate (at handover, after real-data AWS phase):* if the free tier still fits and the company accepts a cloud-hosted UI → Seqera Cloud Basic; if they want local/offline/unlimited → ship the thin Streamlit UI (already built for testing) or get the Enterprise quote. Because the pipeline is GUI-agnostic, none of these paths changes the core code — the decision can be made late.

**RESOLVED, 2026-09-13 (owner):** local/offline/unlimited was chosen - the Streamlit UI, already built, ships as-is. No Seqera evaluation, quote, or account was ever needed.

## 8. References (all accessed 2026-09-11)

**DolphinNext platform**
- Spec: `dolphinnext-metagenomics-platform-version-1-0-specification.md` §11–12 (paper, Nextflow docs, Docker docs, Biocontainers, Geneious manuals)
- https://github.com/UMMS-Biocore/dolphinnext (README: GPL 3.0; 36 open issues; 2 forks; no LICENSE; 1,243 commits)
- https://github.com/UMMS-Biocore/dolphinnext/commits/master.atom (last commit 2023-09-15)
- https://codeload.github.com/UMMS-Biocore/dolphinnext-studio/tar.gz/refs/heads/master (HTTP 404 — repo deleted)
- Paper: https://doi.org/10.1186/s12864-020-6714-x — Yukselen et al., BMC Genomics 21:310 (2020), CC BY 4.0; full text PMC7168977: https://pmc.ncbi.nlm.nih.gov/articles/PMC7168977/
- In-repo docs: https://github.com/UMMS-Biocore/dolphinnext/tree/master/docs/dolphinNext (admin_quick.rst, admin_faq.rst, api.rst, run.rst, overview.rst, profile.rst)
- In-repo code: https://github.com/UMMS-Biocore/dolphinnext/blob/master/public/ajax/dbfuncs.php (with-report/-trace/-timeline/-dag, main.nf/main.dn writes), https://github.com/UMMS-Biocore/dolphinnext/blob/master/public/js/pipelineModal.js (.dn AES export)
- https://dolphinnext.readthedocs.io (HTTP 404 — docs site gone)
- https://dolphinnext.umassmed.edu (HTTP 301 → https://viafoundry.umassmed.edu/vpipe/)
- https://docs.viascientific.com/about/ ("Via Foundry, formerly known as DolphinNext"; developed by UMMS Bioinformatics Core)
- https://hub.docker.com/v2/repositories/ummsbiocore/dolphinnext-studio/tags/?page_size=100 (count: 0 — never published)
- https://hub.docker.com/v2/repositories/jdlamstein/dolphinnext-studio/tags/latest/ (6.04 GB, linux/amd64, tag updated 2023-11-14, image pushed 2021-12-27)

**Tool images / versions**
- Quay API + registry: https://quay.io/api/v1/repository/biocontainers/<repo>/tag/?specificTag=<tag> ; https://quay.io/v2/ (manifests + config blobs — all PLAN tags linux/amd64)
- Biocontainers: https://biocontainers.pro/ ; bioconda: https://anaconda.org/bioconda/ ; recipes: https://github.com/bioconda/bioconda-recipes
- SPAdes: https://github.com/ablab/spades/tree/v4.3.0 (metaspades.py → spades.py)
- Kraken2: https://github.com/DerrickWood/kraken2 (scripts/kraken2-build; CHANGELOG 2.1.6 → 2.17.0)
- Bracken: https://github.com/jenniferlu717/Bracken (bash launcher VERSION="3.0.2"; src/ = C++/Python)
- Pavian: https://github.com/StaPH-B/docker-builds/blob/master/build-files/pavian/1.2.1/Dockerfile (EXPOSE 3838, CMD shiny-server, WORKDIR /data)

**Nextflow**
- https://docs.seqera.io/nextflow/install (Java 17+, Temurin LTS recommended)
- https://docs.seqera.io/nextflow/cache-and-resume ; https://docs.seqera.io/nextflow/reference/config/docker ; https://docs.seqera.io/nextflow/reference/cli/run
- https://github.com/nextflow-io/nextflow/releases/latest (v26.04.6)
- (nextflow.io/docs URLs in the spec redirect to docs.seqera.io)

**Geneious**
- https://manual.geneious.com/en/latest/ImportExport.html ; https://manual.geneious.com/en/latest/CommandLineInterface.html
- https://assets.geneious.com/documentation/geneious/release_notes.html (SAM 5.0, BAM/BED 5.4, VCF 6.0, GFF 4.6; mixed bulk import 11.1; CLI 2022.0; database paths 2022.2)
- https://help.geneious.com/hc/en-us/articles/360045072251-What-data-file-types-can-be-imported (replaces dead article 360045069731)

**Databases**
- Kraken2 S3: https://genome-idx.s3.amazonaws.com/?list-type=2&prefix=kraken/ ; pre-built table: https://benlangmead.github.io/aws-indexes/k2 ; manual: https://github.com/DerrickWood/kraken2/wiki/Manual
- CheckV: https://portal.nersc.gov/CheckV/ ; https://bitbucket.org/berkeleylab/checkv/raw/master/README.md
- geNomad: https://zenodo.org/records/14886553 (DB v1.9, 2025-02-18, ~5.04 GB total) ; https://portal.nersc.gov/genomad/
- Bowtie2 index: https://genome-idx.s3.amazonaws.com/bt/GRCh38_noalt_as.zip (3.49 GiB)

**WSL / Docker Desktop**
- https://docs.docker.com/desktop/setup/install/windows-install/ ; https://docs.docker.com/desktop/features/wsl/
- https://learn.microsoft.com/en-us/windows/wsl/wsl-config ; https://learn.microsoft.com/en-us/windows/wsl/filesystems ; https://learn.microsoft.com/en-us/windows/wsl/compare-versions

---

## 9. Tool catalogue — what every tool does and why it matters (owner-requested, 2026-09-11)

**Why this section exists.** The toolbox model (§6.7) is explicit that this project keeps growing — "more tools will be added than anyone uses" — and the owner asked for two things: (1) a plain-language pass over every tool discussed so far, since "I myself don't know much about R&D and vaccine making, but we are trying to cover all the needs that the team might need," and (2) confirmation that any tool the team later requests can genuinely be added. §2.1/§8 already cover the *mechanics* (pinned container tags, verified against Quay/bioconda); this section covers the *what and why* in plain terms, and extends the inventory with tools not yet in the plan at all. Same citation rigor as everywhere else in this document — every version/tag/license claim below was verified live on 2026-09-11 against an official source (GitHub releases, Quay.io API, bioconda), not guessed. No invented tags, per this project's own founding lesson (§2.1: 11 of the original spec's 13 container tags never existed).

### 9.1 Tools already wired into the pipeline (`workflows/microbox.nf`)

| Tool | What it does, in plain terms | Stage |
|---|---|---|
| **fastp** | Cleans up raw sequencer output: trims low-quality bases and adapter contamination from each read, and produces a QC report. Always the first step — nothing downstream is trustworthy until this runs. | QC/trim |
| **FastQC** | A second, independent QC report (per-base quality, GC content, overrepresented sequences) run on fastp's *output* — a sanity check that trimming actually worked, not a duplicate of fastp's own report. | QC |
| **Bowtie2** (`bowtie2-build` + `bowtie2-align`) | Aligns reads against a reference genome. Here it's used for **host depletion**: build an index of the animal's genome, align the sample's reads to it, and keep only the reads that *don't* match — i.e. strip out the animal's own DNA so what's left is the microbial/viral community actually being studied. | Host depletion |
| **MEGAHIT** | *De novo* assembly: stitches overlapping short reads back together into longer contiguous sequences ("contigs") without needing a reference genome — necessary because a metagenomic sample is a mix of many unknown organisms, not one known genome. | Assembly |
| **Kraken2** | Taxonomic classification: matches short DNA fragments (k-mers) from reads or contigs against a reference database to answer "which organism did this piece of DNA come from?" This is the core scientific output — see PLAN.md §2.3 for the full discussion of why its database is mandatory and how it's sized per environment. | Classification |
| **Bracken** | Takes Kraken2's per-read classifications and statistically re-estimates *how much* of each species is actually present (Kraken2 alone under/over-counts certain taxa due to how k-mer matching distributes across a taxonomy tree; Bracken corrects for that). | Abundance re-estimation |
| **QUAST** | Assembly quality control: reports on the contigs MEGAHIT produced (how many, how long, N50, etc.) — did the assembly actually work, independent of what organisms are in it. | Assembly QC |
| **MultiQC** | Aggregates every other tool's QC/report output (fastp, FastQC, Bowtie2, Kraken2, Bracken, QUAST) into one browsable HTML report — the single file a scientist actually opens after a run. | Reporting |

Verified pinned tags for all eight: §2.1. Module source code (what each actually runs, argument-by-argument): `modules/nf-core/<tool>/main.nf` in this repo.

#### WGS sibling pipeline tools (`workflows/wgs.nf`, §6.9) — built 2026-09-14, Phases 1–5

A separate table, not merged into the list above - these run in the WGS sibling pipeline
(`--pipeline wgs`), not the metagenomics one, and answer a different question (one isolate vs. a
reference, not a mixed community).

| Tool | What it does, in plain terms | Real container tag (verified at install time) |
|---|---|---|
| **BWA-MEM2** | Aligns an isolate's reads against a reference genome - the GATK best-practices aligner, chosen specifically because downstream variant calling needs its indel/soft-clip handling (unlike Bowtie2, which stays on host-depletion duty in the metagenomics pipeline). | `community.wave.seqera.io/library/bwa-mem2_htslib_samtools:db98f81f55b64113` |
| **samtools** (`faidx`/`stats`) | Reference indexing (`.fai`, needed by GATK4) and real alignment QC stats (mapped %, error rate) that feed MultiQC, since BWA-MEM2 itself has no native MultiQC module. | `community.wave.seqera.io/library/htslib_samtools:1.24--d697cfb9dce007cd` |
| **Kraken2** (reused) | Same tool, same DB, same job as the metagenomics pipeline's own Kraken2 (§9.1) - species/contamination screening on an isolate's raw reads, wired via an `as`-aliased include, not a second copy. | Same as §9.1's Kraken2 entry. |
| **Mash** (`screen`) | Fast genome-distance/species-ID screening against a real external RefSeq sketch database (~91k genomes) - a different, independent signal from Kraken2 (MinHash containment vs. k-mer classification), both kept since research showed each is genuinely used in the field for different reasons (§6.9 Phase 3). | `quay.io/biocontainers/mash:2.3--he348c14_1` |
| **seqkit** (`stats`) | Real per-file read-count/length/quality statistics (Q20/Q30/GC%/N50) on raw reads, with native MultiQC support. | `community.wave.seqera.io/library/seqkit:2.13.0--05c0a96bf9fb2751` |
| **GATK4** (`CreateSequenceDictionary`/`HaplotypeCaller`/`GenotypeGVCFs`) | Reference dictionary prep, then variant calling: `HaplotypeCaller` always runs in GVCF mode (`-ERC GVCF`) and `GenotypeGVCFs` genotypes per-sample - the GATK best-practices shape, chosen to cover the broadest real use case (many isolates vs. one reference is this pipeline's own stated scenario) without recalling anything once real cross-sample joint genotyping is added later. | `community.wave.seqera.io/library/gatk4-main_gcnvkernel:961440660027ec01` |
| **RENAME_REFERENCE** (local module, not a real "tool") | Fixes a real bug: GATK4 refuses a reference file whose staged name has no recognized fasta extension (common when `wgs_reference_fasta` is an NCBI efetch URL). Renames/copies once so every downstream consumer gets one consistent `reference.fasta`. | Reuses `bowtie2_htslib_samtools_pigz` (§9.1) - no new image for one `cp` call. |

Real, published-container versions confirmed at `nf-core modules install` time (2026-09-14), not assumed
from earlier research (this project's own recurring lesson - see the SPAdes 4.3.0-vs-4.1.0 correction
above). Real, verified fixture: Staphylococcus aureus (`ERR044595` vs. `NC_007795.1`) - 90.7% mapping rate,
37,491 real called variants including a confirmed real SNP (`NC_007795.1:89 C>T`). Real measured resource
usage, deliberately concerning where it is: `MASH_SCREEN` peaked at **6GB RAM** against the real RefSeq DB
(§6.9 Phase 3); `GATK4_HAPLOTYPECALLER` took 3m23s real compute for one ~2.86 Mb genome (§6.9 Phase 4). Full
build history, every real bug found and fixed along the way: `docs/KNOWN_ISSUES.md` #22-#25.

### 9.2 Pinned in the plan, not yet wired into a module

| Tool | What it does, in plain terms | Why it's not in `workflows/microbox.nf` yet |
|---|---|---|
| **metaSPAdes** (`spades` package — see note below) | An alternative *de novo* assembler to MEGAHIT, generally more accurate but slower/more memory-hungry. Same job as MEGAHIT, different speed/accuracy trade-off — a runtime choice, not a replacement. | **Implemented 2026-09-12** as `params.assembler` (`'megahit'` \| `'metaspades'`). |
| **geNomad** | Identifies viral and plasmid sequences within assembled contigs — separates "this is a phage/virus" from "this is a bacterial chromosome fragment" in a mixed metagenomic assembly. | **Implemented 2026-09-12** (`params.skip_genomad`, default `true` — needs a separate DB download). |
| **CheckV** | Quality-checks viral genomes/contigs (completeness, contamination) the way QUAST does for assemblies generally — specifically tuned for viral sequence characteristics. Typically run right after geNomad. | **Implemented 2026-09-12** (`params.skip_checkv`, default `true` — needs a separate DB download). |
| **MaxBin2** | Genome binning: groups contigs from a mixed metagenomic assembly into per-organism clusters ("this set of contigs probably all came from the same bacterium") using coverage and composition signals — a step toward reconstructing individual genomes from a community sample. | **Implemented 2026-09-13** (`params.skip_maxbin2`, default `true` — optional by design, no DB needed). See `docs/KNOWN_ISSUES.md`. |
| **Pavian** | An interactive R/Shiny web app for browsing Kraken2/Bracken results visually (sankey diagrams, comparison tables) — a standalone service over existing output files, not a pipeline processing step. | **Implemented 2026-09-13** as `docker-compose.yml` + `bin/run-pavian.sh` (§6.6 item 2) — not a Nextflow process. See `docs/KNOWN_ISSUES.md`. |

**Note on "SPAdes core" vs "metaSPAdes":** these are the same container and the same underlying program. SPAdes is a general-purpose assembler; `metaspades.py` is SPAdes run in its metagenomics-tuned mode (a symlink to `spades.py --meta` internally, confirmed in the v4.3.0 source tree, §2.1). There is no separate "SPAdes core" tool/tag to add — `quay.io/biocontainers/spades:4.3.0--hde4eca7_1` (§2.1) covers both.

### 9.3 New candidate tools — researched 2026-09-11 (owner ask: cover the team's likely future needs)

**Update 2026-09-14: four of these nine (BWA-MEM2, samtools, seqkit, Mash) are now implemented** — the WGS
sibling pipeline needed exactly them, per each row's own "where it would matter here" prediction (see the
"Implemented" notes inline below, and §9.1's own WGS tools table for the real installed tags/full detail).
The remaining five (HMMER, DIAMOND, BLAST+, BBTools, Prodigal) are still not pinned anywhere in this repo.
They were researched to the same standard as everything above — version and container tag each verified
live against Quay.io/bioconda/GitHub releases on 2026-09-11 — so they're ready to add the moment the team
asks, or the moment a future module needs them. Of the original nine, only HMMER and DIAMOND lack a
maintained **nf-core module** and would need a small custom one (same "reuse before building" rule as §6.1,
applied honestly where reuse isn't available).

| Tool | What it does, in plain terms | Where it would matter here |
|---|---|---|
| **BWA-MEM2** | Aligns reads to a reference genome — same job as Bowtie2, but it's the field-standard aligner specifically for *variant calling* (which mutations does this genome have vs. a reference), not host depletion. | **Implemented 2026-09-14** (§6.9 Phase 2, `params.skip_bwamem2`) — feeds GATK4, as predicted here. Real installed tag differs from this row's 2026-09-11 research (`community.wave.seqera.io/library/bwa-mem2_htslib_samtools:db98f81f55b64113`, not the standalone `quay.io/biocontainers/bwa-mem2` tag below) — same "install the real module, don't hand-pick the researched tag" lesson as SPAdes (§9.2). |
| **samtools** | The standard toolkit for manipulating alignment files (SAM/BAM/CRAM): sort, index, filter, merge, compute coverage/depth stats. Not a pipeline stage on its own — it's plumbing other alignment-based tools already depend on. | **Implemented 2026-09-14** (§6.9 Phases 2/4, `samtools/faidx` + `samtools/stats`) — real BAM QC feeding MultiQC and reference indexing for GATK4, both predicted uses here. Real tag: `community.wave.seqera.io/library/htslib_samtools:1.24--d697cfb9dce007cd`. |
| **seqkit** | A fast, general-purpose FASTA/FASTQ utility belt: sequence stats (length, GC%, N50), subsetting/filtering by ID, dedup, sampling, format conversion — the sequence-level equivalent of samtools' alignment-level utility belt. | **Implemented 2026-09-14** (§6.9 Phase 3, `params.skip_seqkit_stats`) — real per-file read stats feeding MultiQC. Real tag: `community.wave.seqera.io/library/seqkit:2.13.0--05c0a96bf9fb2751`. |
| **HMMER** | Searches sequences against *profile* models (built from a family of related proteins) rather than raw sequence-to-sequence comparison like BLAST — catches distant relatives that plain similarity search misses (e.g. "does this protein contain a known toxin domain?" even with low sequence identity). | Already riding along invisibly — CheckV's own container bundles HMMER as a runtime dependency (§2.1). As a standalone module: functional/domain annotation of assembled contigs — screening for virulence factors, toxins, or antigen-relevant domains, directly relevant to vaccine R&D. |
| **DIAMOND** | A BLAST-compatible aligner built for speed at scale — commonly hundreds of times faster than BLAST on large protein datasets, at a small sensitivity cost. Same job as BLAST+, different engineering trade-off. | Also already inside CheckV's container (it builds a local DIAMOND database from `checkv_reps.faa` on demand — confirmed in the existing fact-check report, §2.1). Standalone: fast large-scale functional/taxonomic annotation of contigs at a scale where BLAST+ would be too slow. |
| **BLAST+** | NCBI's classic, general-purpose sequence similarity search suite — "how similar is this sequence to anything in a reference database?" Slower than DIAMOND at scale but the long-standing standard with the widest ecosystem support. | Third tool riding along inside CheckV's dependencies. Standalone: smaller, precision-focused lookups — confirming a specific contig's closest known relative, or reference-based strain ID. |
| **BBTools** (BBDuk / BBNorm / BBMap) | A suite of 90+ tools for sequence data. The three relevant here: **BBDuk** (adapter/contaminant trimming — an alternative to fastp), **BBNorm** (k-mer-based read normalization/downsampling, useful for cutting assembly compute on very deep datasets before MEGAHIT), **BBMap** (an alternative aligner to Bowtie2 for host depletion). | Swappable alternatives at the QC and host-depletion stages — a second option if fastp/Bowtie2 behave oddly on a given dataset, a standard bioinformatics cross-check pattern, not a replacement. |
| **Prodigal** | Predicts protein-coding genes in bacterial/archaeal genomes or assembled contigs — turns "a pile of assembled DNA" into "here are the genes on it," a prerequisite for any downstream functional/antigen search with HMMER or DIAMOND. | Direct gene-calling on any contigs this pipeline produces. **Correction to this document's own fact-check report:** that report states CheckV/geNomad depend on "Prodigal" — current bioconda recipes for both actually pin `pyrodigal-gv`, a separate Cython-accelerated reimplementation (different maintainer, adds viral-specific training models for geNomad's use case), not the classic binary. Worth fixing in §2.1's dependency notes; doesn't block adding classic Prodigal as its own standalone module. |
| **Mash** | Estimates how similar two genomes (or a genome and a sample) are, extremely fast, by reducing each to a small "sketch" (MinHash signature) instead of a full alignment — a fingerprint instead of a full comparison. `mash screen` in particular checks whether known genomes are present in a raw read set. | **Implemented 2026-09-14** (§6.9 Phase 3, `params.skip_mash`) — real finding while wiring it: `mash screen`'s query must be raw reads directly, not a pre-built sketch (`mash/sketch` turned out to have no role here at all, despite being installed for it initially — `docs/KNOWN_ISSUES.md` #24). Real tag: `quay.io/biocontainers/mash:2.3--he348c14_1` (matches this row's own 2026-09-11 research exactly, no drift this time). |

**Verified facts** (all checked live 2026-09-11; sources inline):

| Tool | Version | Container tag (verified) | License |
|---|---|---|---|
| BWA-MEM2 | v2.3 ([GitHub releases](https://github.com/bwa-mem2/bwa-mem2/releases/latest)) | `quay.io/biocontainers/bwa-mem2:2.3--he70b90d_0` ([Quay API](https://quay.io/api/v1/repository/biocontainers/bwa-mem2/tag/?specificTag=2.3--he70b90d_0)) | MIT |
| samtools | 1.24 ([GitHub releases](https://github.com/samtools/samtools/releases/latest)) | `quay.io/biocontainers/samtools:1.24--h9dcdb79_1` ([Quay API](https://quay.io/api/v1/repository/biocontainers/samtools/tag/?specificTag=1.24--h9dcdb79_1)) | MIT/Expat |
| seqkit | v2.13.0 ([GitHub releases](https://github.com/shenwei356/seqkit/releases)) | `quay.io/biocontainers/seqkit:2.13.0--he881be0_0` ([Quay API](https://quay.io/api/v1/repository/biocontainers/seqkit/tag/?specificTag=2.13.0--he881be0_0)) | MIT |
| HMMER | 3.4 ([release note](http://cryptogenomicon.org/hmmer-3-4-release.html)) | `quay.io/biocontainers/hmmer:3.4--h7d74f8d_5` ([Quay API](https://quay.io/api/v1/repository/biocontainers/hmmer/tag/)) | BSD-3-Clause |
| DIAMOND | v2.2.6 ([GitHub API](https://api.github.com/repos/bbuchfink/diamond/releases/latest)) | `quay.io/biocontainers/diamond:2.2.6--he361c42_0` ([Quay API](https://quay.io/api/v1/repository/biocontainers/diamond/tag/)) | GPLv3 |
| BLAST+ | 2.17.0+ ([NCBI FTP](https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/LATEST/)) | `quay.io/biocontainers/blast:2.17.0--hb02a186_1` ([Quay API](https://quay.io/api/v1/repository/biocontainers/blast/tag/)) | Public domain (US govt work, NCBI) |
| BBTools | 40.02 ([bioconda](https://anaconda.org/bioconda/bbmap)) | `quay.io/biocontainers/bbmap:40.02--h09cc210_0` ([Quay API](https://quay.io/api/v1/repository/biocontainers/bbmap/tag/?limit=5&onlyActiveTags=true)) | BSD-3-Clause-LBNL — permissive, explicitly allows commercial use |
| Prodigal | v2.6.3 ([GitHub releases](https://github.com/hyattpd/Prodigal/releases)) | `quay.io/biocontainers/prodigal:2.6.3--h577a1d6_11` ([Quay API](https://quay.io/api/v1/repository/biocontainers/prodigal/tag/?limit=5&onlyActiveTags=true)) | GPLv3 (copyleft — note, unlike most of this toolbox) |
| Mash | v2.3 ([GitHub API](https://api.github.com/repos/marbl/Mash/releases/latest)) | `quay.io/biocontainers/mash:2.3--hf85e966_11` ([Quay API](https://quay.io/api/v1/repository/biocontainers/mash/tag/?limit=5&onlyActiveTags=true)) | BSD-3-Clause |

**nf-core module availability:** BWA-MEM2 (`bwamem2/index`, `bwamem2/mem`), samtools (~20 subcommand modules), seqkit (`stats`, `seq`, `grep`, `sample`, `sort`, `rmdup`, `split2`, `translate`, …), BLAST+ (`blastn`, `blastp`, `makeblastdb`, …), BBTools (11 submodules under `nf-core/modules/bbmap/`), Prodigal, and Mash (`sketch`, `dist`, `screen`) all have ready-made, current nf-core modules — verified against [github.com/nf-core/modules](https://github.com/nf-core/modules/tree/master/modules/nf-core). **HMMER and DIAMOND have no nf-core module** — adding either would be a small custom module (same shape as MaxBin2/Pavian already planned in §6.7, not a new category of work).

### 9.4 What this means for "can we add any tool the team requests?"

Yes, by construction — this is what the toolbox architecture (§6.7) is *for*. Every tool above (old or new) follows the same recipe: pin a verified container tag, wire it as one Nextflow module with typed inputs/outputs, add a `--run_<tool>`/`--skip_<tool>` flag. Nine of the eleven new tools in §9.3 already have a maintained nf-core module ready to fetch — for those, adding the tool is a wiring job of the same size as everything built this session (a day or so per tool, not a redesign). The other two (HMMER, DIAMOND) need a small hand-written module, the same amount of custom work MaxBin2 and Pavian already require. **The one real constraint is licensing, not engineering:** everything in §9.3 is either permissive (MIT/BSD) or GPLv3 (DIAMOND, Prodigal) or public-domain (BLAST+) — no copyleft surprises that would block the company's commercial use, consistent with the licensing check already done for the WGS extension (§6.9). If the team names a tool not on this list at all, the same recipe applies: verify it exists and is licensed compatibly, pin a real container tag (never invent one, §2.1's founding lesson), and add one module.
