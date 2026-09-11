# DolphinNext Metagenomics Platform — Implementation Plan

> **Status:** DRAFT — all research complete. **Platform decision made (see §7): Option B — Nextflow + Seqera GUI.** Fact-checked 2026-09-11 — corrections and sources added inline (see §8 References). Ownership model settled + WGS extensibility evaluated 2026-09-11 (§6.5, §6.9).

**Spec:** `dolphinnext-metagenomics-platform-version-1-0-specification.md` (v1.0, 2026-09-11)
**Author:** marouane

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
| metaSPAdes | `quay.io/biocontainers/spades:4.3.0--hde4eca7_1` | `metaspades.py` present (wraps `spades.py --meta`); **4.x behavior-changing** vs spec's 3.15.5 |
| Kraken2 | `quay.io/biocontainers/kraken2:2.17.1--pl5321h077b44d_0` | includes `kraken2-build`; upstream jumped 2.1.6 → 2.17.0 (no 2.14 line ever existed — CHANGELOG) |
| Bracken | `quay.io/biocontainers/bracken:3.1p1--hc52dbad_0` | 3.x restructured: bash launcher (`VERSION="3.0.2"`) + C++/Python in `src/` — **not** a Python rewrite; still validate outputs |
| MultiQC | `quay.io/biocontainers/multiqc:1.35--pyhdfd78af_1` | no 2.x exists |
| geNomad | `quay.io/biocontainers/genomad:1.12.0--pyhdfd78af_0` | DB is separate download (`genomad download-database`) |
| CheckV | `quay.io/biocontainers/checkv:1.1.1--pyh106432d_1` | DB separate (`checkv download_database`); **1.x uses DIAMOND genome_db — <0.9 DBs incompatible** |
| Pavian | **no biocontainers image** → `quay.io/staphb/pavian:1.2.1` | R Shiny **service** on port 3838 (`-v <data>:/data`), not a pipeline step — verified in Dockerfile: `EXPOSE 3838`, `CMD ["/usr/bin/shiny-server"]`, `WORKDIR /data`; upstream GitHub tags stop at v1.0 (image versioning is staphb's own) |
| QUAST | `quay.io/biocontainers/quast:5.3.0--py313pl5321h5ca1c30_2` | |
| MaxBin2 | `quay.io/biocontainers/maxbin2:2.2.7--h503566f_8` | `run_MaxBin.pl` present, no ENTRYPOINT — invoke explicitly |

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
| **4a — Specialized tools A** | geNomad, CheckV, QUAST (nf-core/validated paths), DB volumes, compatibility confirmation (geNomad 1.12.0 ↔ DB v1.9, same rigor as CheckV) | 2-3 weeks |
| **4b — Specialized tools B + hardening** | MaxBin2, Pavian-as-service, custom modules, per-tool sanity-check debugging (flagged behavior-changing majors), reproducibility validation | 1-2 weeks |

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
| 11 | geNomad DB/software pairing not explicitly confirmed | **Accepted.** Phase 4a adds the same explicit compatibility confirmation CheckV got (geNomad 1.12.0 ↔ DB v1.9) + pinned `download-database`; compatibility matrix in the runbook. |
| 12 | Drag-and-drop composition GUI quietly gone, not replaced | **Surfaced as an explicit deviation** — the spec's composition GUI is not replaced: Seqera and the Streamlit app are run/monitor GUIs; composition happens via CLI flags + YAML (nf-core style). Recorded as owner-acknowledged deviation to state to the company. If visual composition ever becomes a hard requirement, re-evaluate (Seqera builder capabilities unverified; not planned). |
| 13 | AWS DB-cap benchmark can't test the cap's real failure mode | **Accepted — benchmark redesigned.** Mock-only comparison would pass regardless (mock taxa are common and survive capping). New design: (a) compare taxid sets of capped vs full DB (`kraken2-inspect`), (b) spike reads from taxa present in the full but absent from the capped build into the mock, (c) check detection in full vs capped. The benchmark now measures sensitivity loss, not agreement. §2.3 table updated. |
| 14 | RAM-first DB rule vs vaccine-R&D purpose | **Reframed as a scientist sign-off.** The 16 GB default is an operational default protecting compute RAM; the sensitivity trade-off (dropping the long tail of RefSeq — the interesting/unexpected organisms) is a scientist decision, informed by the redesigned benchmark (#13), at the real-data phase. Interim pattern available: classify with 16 GB, re-classify interesting samples with the full DB on AWS. |
| 15 | Risk concentrated in Kraken2's version jump | **Accepted + fallback pin.** Named as concentrated risk (core scientific output; largest version jump in the toolset). Mitigations: truth-test before any real data; **verified fallback tag `quay.io/biocontainers/kraken2:2.1.6--pl5321h077b44d_0`** (last 2.1.x, same build-environment hash as the 2.17.1 tag) — one-line params swap if 2.17.1 misbehaves. |
| 16 | Bus factor of one | **Accepted with mitigations, updated 2026-09-11 for the public-repo model (§6.5):** (a) the repo is public on GitHub from day one — itself a mitigation, since anyone including the company can fork/continue it without anything needing to be transferred — reinforced by a second personal backup remote; (b) all knowledge continuously captured in-repo (plan, fact-check, decision log); (c) README "if the author disappears" section (how the company becomes self-sufficient — no credentials to hand over, since none of theirs should ever be in the public repo, §6.5); (d) nf-core lint/CI as a partial second pair of eyes on module code. |
| 17 | "Storage is not an issue" asserted, not verified | **Accepted.** Phase 1 adds a dev disk check (≥ 80 GB free: DBs ~20 GB + images ~30 GB + work dir); AWS EBS sized 200 GB; prod disk = 2× chosen DB + results growth; setup scripts verify disk before proceeding. |
| 18 | Phase 4 timeline vs its own flagged risks | **Accepted.** Phase 4 split into 4a (geNomad, CheckV, QUAST — nf-core/validated paths, 2–3 weeks) and 4b (MaxBin2, Pavian, custom modules + sanity-check debugging, 1–2 weeks); estimates re-checked after Phase 3 reality check. |

Two items require the company (not the owner): #12 (composition GUI deviation — state it explicitly) and #14 (DB sensitivity trade-off — scientist sign-off at the real-data phase). Both are recorded; neither blocks Phase 1.

### 6.9 WGS extensibility — evaluated 2026-09-11, not in MVP scope

**Question raised by the owner:** can this toolbox also do whole-genome sequencing (WGS), not just metagenomics? **Yes** — the Nextflow DSL2 + nf-core module architecture (§6.7) genuinely generalizes beyond metagenomics. This was fact-checked the same way as the rest of this document, not taken on faith — the claim as originally proposed got some specifics right and some wrong; corrections below.

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

**Scope decision:** evaluated and documented as a **supported future extension**, not added to the Phase 1–4 task breakdown or effort estimates (§4) — the spec's MVP is metagenomics. Building it now would be scope creep unless prioritized explicitly. Which flavor (pathogen vs. host) matters for when it's picked up — see Q8, §6.6.

Sources: [nf-core/sarek usage docs — custom FASTA, `--skip_tools baserecalibrator`](https://nf-co.re/sarek/3.5.1/docs/usage/), [nf-core/sarek GitHub — "initially designed for Human and Mouse... can work on any species with a reference genome"](https://github.com/nf-core/sarek), [Broad Institute — GATK4 open-source BSD 3-Clause announcement](https://www.broadinstitute.org/news/broad-institute-releases-open-source-gatk4-software-genome-analysis-optimized-speed-and), [Bactopia GitHub (MIT license)](https://github.com/bactopia/bactopia), [Bactopia paper, mSystems 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7406220/), [BacSeq paper, MDPI Microorganisms 2023](https://www.mdpi.com/2076-2607/11/7/1769)

### 6.10 Visual pipeline composition / per-node branch-and-checkpoint editing — raised by owner 2026-09-11, needs study, NOT scoped or built

The owner described a workflow: save the result after every node so the pipeline can branch (e.g. after host depletion, choose MEGAHIT *or* metaSPAdes, or go straight to Kraken2); come back another day, keep steps 1..N as they were, and either swap step N+1 for a different tool or change one of its parameters — with everything downstream of that change re-running, everything upstream reused. And for this to be drag-and-drop-buildable visually, not just CLI/config-driven.

**Split this into two very different pieces:**

1. **Per-node caching + branching from a checkpoint — already true today, not a new feature.** This is exactly what Nextflow's `-resume` + work-dir hash caching already does, verified repeatedly this session: change a parameter or swap a tool, only that step and everything downstream re-executes; everything upstream is reused from cache automatically. Branching is also already real, not aspirational — Kraken2 and MEGAHIT already run as independent parallel consumers of the same post-depletion reads channel (`workflows/microbox.nf`), not a sequential chain. What's missing here is small and concrete: **metaSPAdes as an alternative to MEGAHIT** (already anticipated, §6.6 item 1 — "MEGAHIT/metaSPAdes selection are runtime params with sane defaults") isn't wired up yet; that's a same-shape addition as everything built in this phase, not a new architecture.

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
  - **Earlier in this same conversation the owner asked for "both multiple entry points and arbitrary tool reordering... test all combinations"**, which reads closer to (B) than (A) — but everything actually built and tested this session (the skip-flag toggles, the `input_type` entry points) follows (A)'s model. This is a real fork, not a wording nuance, and worth the owner's explicit call before any of this gets designed further — not decided here.

**What an R&D team specifically needs, as a framing check (not engineering-driven):** launch a run without touching a CLI; trust the results (reports/tables presented clearly, not a pile of files); understand *what happened*, in plain language, when something fails; compare runs over time to build confidence the pipeline behaves consistently. Every page above maps to one of those four except Module Library and Databases, which are more "make the black box glass" for anyone curious, technical or not.

**Explicitly not decided here:** which pages are must-have vs. nice-to-have for a first pass (deliberately unprioritized); Streamlit vs. another frontend stack for anything beyond the existing thin launcher (still §6.10's open, unresolved question); any interaction detail marked "open" above (modal vs. panel, exact nav layout, etc.).

   **Not scoped, not estimated, not started yet — still needs study, per the owner's own framing.** Open questions before it can be scoped: does the canvas need to be a general-purpose graph editor, or would a much simpler guided flow (pick tool A, pick tool B, see the resulting command, in the existing Streamlit app) satisfy the actual need at a fraction of the cost? Which parameter combinations are valid to expose per node (a raw parameter surface per tool is large and mostly not meant for a non-expert to touch directly)? How does "come back another day and edit step X" reconcile with runs already being immutable/hashed by Nextflow's own caching model? Does the canvas need to *generate* the actual Nextflow DSL2 wiring (a much bigger compiler-shaped problem), or just assemble CLI flags/a params file against the fixed pipeline shape that already exists? None of this is answered yet.

## 7. Key decision: platform choice (owner decision required)

The spec (§2, §4.2) mandates DolphinNext, but research (§2.2) proves the official image/repo/docs no longer exist. Options:

| Option | What it means | Risk / effort |
|---|---|---|
| **A. Nextflow DSL2 + nf-core (no GUI)** | Build the pipeline directly in Nextflow DSL2 using maintained nf-core modules; CLI-driven. Keeps every spec goal except the web GUI: Docker-per-tool, resume, reports, MultiQC, provenance (git + Nextflow traces), standalone script, Geneious export | Low risk, days to working pipeline |
| **B. Modern GUI on top (e.g., Seqera Platform) + nf-core pipeline** | Same pipeline as A, plus a maintained web GUI for monitoring/runs — closest modern equivalent of DolphinNext's GUI + provenance | Needs a short evaluation of free-tier/self-hosted options |
| **C. Stale DolphinNext community rebuild** | Run the 2023 third-party image (`jdlamstein/dolphinnext-studio`, ~6 GB) — literal spec compliance incl. GUI | High risk: Ubuntu 16.04 / PHP 7.2 EOL, no security support, Nextflow baked in via `get.nextflow.io` at build time (Dec 2021 ≈ v21.x), likely breaks with modern Nextflow |
| **D. Modernize DolphinNext in-house** | Fork + port the PHP/Python2 app to a modern stack (PHP 8, MariaDB, Python 3) | Multi-week effort, uncertain outcome, no upstream |

→ **Decision (owner, 2026-09-11): Option B — GUI-agnostic Nextflow DSL2 + nf-core pipeline; the testing UI is a small thin Streamlit app (owner, 2026-09-11); Seqera (or another UI) remains an option at the handover decision gate.**

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
