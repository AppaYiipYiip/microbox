# Fact-Check Report — DolphinNext Metagenomics Platform Documentation

**Date of verification:** 2026-09-11 (all sources accessed live on this date)
**Files checked:**
- `dolphinnext-metagenomics-platform-version-1-0-specification.md` (v1.0)
- `PLAN.md`

**Method:** Every external claim was verified against live sources: official documentation, publication full text (Europe PMC), GitHub REST API, GitHub repo tarball (source-code inspection), Docker Hub API, Quay.io API + registry manifests/config blobs, S3 bucket listings and HTTP HEAD requests (no large downloads), and bioconda package metadata. Both checked files were then updated in place: wrong claims corrected inline, and a source URL added for every claim (see "Files updated" below).

---

## 1. DolphinNext platform claims

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1.1 | DolphinNext is open-source GNU GPL 3.0 | ✅ TRUE | GitHub README: "DolphinNext released under GNU General Public License 3.0." https://github.com/UMMS-Biocore/dolphinnext — note: the repo has **no LICENSE file** (API `/license` → HTTP 404) |
| 1.2 | Paper "DolphinNext: a distributed data processing platform for high throughput genomics" exists in BMC Genomics, 2020 | ✅ TRUE | Exact title match. BMC Genomics 21:310 (2020), CC BY 4.0. Authors: Yukselen O, Turkyilmaz O, Ozturk AR, Garber M, Kucukural A. DOI 10.1186/s12864-020-6714-x. Full text: PMC7168977 (Europe PMC). The biomedcentral.com URL 301-redirects to link.springer.com |
| 1.3 | Drag-and-drop GUI for building pipelines | ✅ TRUE | Paper: "drag and drop user interface that visualizes pipelines..."; "use drag and drop functionality to create new pipelines by connecting processes through their input and output parameters". Implemented in PHP, MySQL, Javascript |
| 1.4 | Automatic generation of Nextflow code | ✅ TRUE | Paper (41 Nextflow mentions); source writes `main.nf` next to `main.dn` (dbfuncs.php lines 1777–1778, 1807–1808) |
| 1.5 | Each tool executes in its own Docker container | ✅ TRUE | Paper (12 Docker mentions); pipeline.rst sets `$DOCKER_OPTIONS = "-v /export:/export"` for tool containers |
| 1.6 | Provenance tracking of versions/parameters/files | ⚠️ PARTIAL | Paper never uses the word "provenance". Revisioning exists: overview.rst — "Revisioning system keeps track of pipelines and processes versions as well as their parameters". Nextflow cache records task metadata |
| 1.7 | Integrated report generation | ✅ TRUE | Paper: report types "Html, table, pdf, R markdown"; "Extensive reports with R-markdown and shiny support"; "embedded shiny and R-markdown applications in these reports" |
| 1.8 | PDF / R Markdown are "stretch goals" | ❌ FALSE | They are **core** report types per the paper (see 1.7) |
| 1.9 | MultiQC aggregation supported | ✅ TRUE | overview.rst lists MultiQC; run.rst shows embedding MultiQC HTML into report sections |
| 1.10 | R Markdown reports are generated via OpenCPU (PLAN §2.2) | ❌ NOT SUPPORTED | "OpenCPU" appears **zero times** in the paper full text and **zero times** in the entire GitHub repo source |
| 1.11 | DolphinNext uses `-with-report/-with-trace/-with-timeline/-with-dag` | ✅ TRUE | dbfuncs.php lines 746/749/752/755 contain exactly these flags; run.rst shows the resulting timeline.html, dag.html, trace.txt, .nextflow.log, nextflow.nf, nextflow.config |
| 1.12 | Start/Resume/Rerun UI buttons | ✅ TRUE | Paper: run page actions "make a change, terminate, resume, copy, delete, or re-execute" |
| 1.13 | Resume semantics (Nextflow `-resume`) | ✅ TRUE | Paper: "DolphinNext builds on Nextflow's ability to record a pipeline execution state, enabling the ability to re-execute or resume a pipeline from any of its steps"; "once input parameters are changed and the run resumed, Nextflow only executes the affected processes" |
| 1.14 | Docker image `ummsbiocore/dolphinnext-studio` is pullable | ❌ FALSE (name is real, image was never published) | Docker Hub repo **exists** but has **zero tags** (`count: 0`). https://hub.docker.com/v2/repositories/ummsbiocore/dolphinnext-studio/tags/?page_size=100 |
| 1.15 | `github.com/UMMS-Biocore/dolphinnext-studio` deleted | ✅ TRUE | GitHub API + codeload both return HTTP 404 |
| 1.16 | `dolphinnext.readthedocs.io` gone | ✅ TRUE | HTTP 404 |
| 1.17 | Main repo last commit 2023-09-15 | ✅ TRUE | GitHub API `pushed_at: 2023-09-15T19:33:30Z`; commits feed `<updated>2023-09-15T19:33:30Z` |
| 1.18 | 36 open issues, 2 forks, no LICENSE | ✅ TRUE | GitHub API: `open_issues_count: 36`, `forks_count: 2`, `/license` → 404. Also: 8 stars, 1,243 commits, not archived |
| 1.19 | dolphinnext.umassmed.edu → ViaFoundry | ✅ TRUE | HTTP 301 → https://viafoundry.umassmed.edu/vpipe/ (login-gated). Via Foundry docs: "Via Foundry, formerly known as DolphinNext", developed by the Bioinformatics Core at UMass Medical School — https://docs.viascientific.com/about/ |
| 1.20 | jdlamstein/dolphinnext-studio image details | ⚠️ MOSTLY TRUE, one claim unsubstantiated | Docker Hub API: tag `latest`, **6,041,231,752 bytes = 6.04 GB (5.63 GiB)**, linux/amd64, tag last_updated 2023-11-14, image last_pushed 2021-12-27, 854 pulls. Image build history (registry config blob) confirms: **Ubuntu 16.04** (`add-apt-repository ...CRAN... xenial/`), **PHP 7.2** (`apt-get -y install php7.2 ...` from PPA jason.grammenos.agility/php), **Python 2** (`python-dev python-pip`), **in-container MySQL** (`mysql-server` + `service mysql start`). ❌ "Nextflow pinned to 19.10.0" is **not evidenced** — history shows `curl -s https://get.nextflow.io | bash` at build time (Dec 2021 → ≈ v21.x). No GitHub source repo exists (404) |
| 1.21 | `.dn` files are AES-encrypted blobs tied to an instance secret | ⚠️ PARTIAL | AES encryption confirmed: `pipelineModal.js` exportPipeline(): `text = JSON.stringify(text); text = CryptoJS.AES.encrypt(text, "")` — **empty passphrase**. PHP writes the blob verbatim into `main.dn` (dbfuncs.php 1778/1808). The "instance secret" part is not evidenced anywhere in code |
| 1.22 | The real definition store is the MySQL schema | ✅ TRUE | Repo `db/` contains `db_structure.sql`, `dolphinnext.sql`, `patch/` |
| 1.23 | API covers runs only | ✅ TRUE | `docs/dolphinNext/api.rst` — "API v1" — has only Runs endpoints: Get All Runs (getRuns), Get a Run, Create a Run (createRun). No pipelines/processes endpoints |
| 1.24 | `/export` directory convention | ✅ TRUE | admin_quick.rst: "Please don't change the target directory (/export) in the docker image."; official run: `docker run -m 10G -p 8080:80 -v /path/to/mount:/export -ti ummsbiocore/dolphinnext-studio /bin/bash`. Not named in the 2020 paper |
| 1.25 | BASE_PATH / PUBWEB_URL configuration | ⚠️ PARTIAL | admin_faq.rst: set in the container's `config/.sec` file — defaults `BASE_PATH = http://localhost:8080/dolphinnext`, `PUBWEB_URL = http://localhost:8080/dolphinnext/tmp/pub`. They are **not** `docker run -e` env vars as the spec's command implies |
| 1.26 | Web UI at `http://localhost:8080/dolphinnext` | ✅ TRUE | Path `/dolphinnext` confirmed by the BASE_PATH default above |
| 1.27 | Container port 8080 | ❌ FALSE | Official docs map `-p 8080:80` (Apache on port 80 inside the container) |
| 1.28 | 10 GB memory for DolphinNext | ✅ TRUE (as an executor setting) | Docs launch with `docker run -m 10G`; profile.rst: "Executor Settings for Nextflow: Please set 10GB memory and 1 CPU for nextflow"; faq.rst documents Memory(GB)/CPU fields per executor |
| 1.29 | Java 8 or higher | ⚠️ OUTDATED | The paper states "Nextflow and Java 8 or higher" (2020). Current Nextflow requires **Java 17+** (see §3) |

## 2. Tool container images, versions, executables, dependencies (spec §5 vs PLAN §2.1)

Verification: Quay.io API `?specificTag=` for existence; Quay registry v2 manifests + config blobs for architecture; GitHub API for upstream releases; bioconda recipe meta.yaml/build.sh for packaged executables and runtime deps.

**Spec tags:** only **2 of 13 exist**: `fastqc:0.11.9--0` ✅, `multiqc:1.14--pyhdfd78af_0` ✅. The other 11 return empty tag lists (HTTP 200, no match); `biocontainers/pavian` has no repository (HTTP 401).

**PLAN tags:** all **14 exist** and all are **linux/amd64** (verified per-tag via manifest → config blob).

| Tool | Spec tag | PLAN tag (amd64 ✅) | Upstream latest (GitHub API / bioconda) | Executables / behavior | Spec dependency column vs bioconda recipe |
|---|---|---|---|---|---|
| FastQC | 0.11.9--0 ✅ exists | `fastqc:0.12.1--hdfd78af_0` ✅ | v0.12.1 | `fastqc` | Java (openjdk ≥8.0.144) + Perl ✅ matches |
| fastp | 0.23.2--h5502775_0 ❌ | `fastp:1.3.6--h43da1c4_0` ✅; fallback `0.23.4--h125f33a_5` ✅ | v1.3.7 (PLAN said 1.3.6 — 1.3.7 released since) | `fastp` | isa-l + libdeflate + libhwy (host) ✅ close match (libisal = isa-l); libstdc++6 implicit |
| Bowtie2 | 2.4.5--py38h7e06652_0 ❌ | `bowtie2:2.5.5--ha27dd3b_0` ✅ | v2.5.5 | `bowtie2-build` included (upstream tarball ships all binaries) | run deps: python, perl, libgomp — spec's zlib is build-time only |
| MEGAHIT | 1.2.9--py38h7132678_0 ❌ | `megahit:1.2.9--haf24da9_8` ✅ | v1.2.9 (frozen — latest release is still 1.2.9) | `megahit` | run deps: python only — spec's zlib/bzip2 are build-time |
| metaSPAdes | 3.15.5--py38h4a756c0_0 ❌ | `spades:4.3.0--hde4eca7_1` ✅ | v4.3.0 | `metaspades.py` present in v4.3.0 source (symlink → `spades.py` in `src/projects/spades/pipeline/`, alongside coronaspades/metaplasmidspades/metaviralspades/plasmidspades/rnaspades/rnaviralspades) | ✅ |
| Kraken2 | 2.1.2--pl5321hdfd78af_0 ❌ | `kraken2:2.17.1--pl5321h077b44d_0` ✅ | v2.17.1 | `kraken2-build` included (`scripts/kraken2-build`, installed by `install_kraken2.sh`) | run: python, blast, perl, wget, tar, rsync ✅ exact match. **Version history correction:** CHANGELOG shows 2.1.0 → 2.1.6 (2025-07-08) → **2.17.0** (2025-11-04, "to resolve an issue created by an errant tag") → 2.17.1 (2025-11-24). **No 2.14.x ever existed** |
| Bracken | 2.6.2--py38hdfd78af_0 ❌ | `bracken:3.1p1--hc52dbad_0` ✅ | v3.1 (release note: "Updated Release") | **Not a Python rewrite**: root `bracken` is a bash launcher (`VERSION="3.0.2"`), `src/` = C++ (ctime.cpp, kmer2read_distr.cpp, kraken_processing.cpp, taxonomy.cpp) + `est_abundance.py` + `generate_kmer_distribution.py`. Repo CHANGELOG.md ends at 2.9 (2023-09-20) | run: python, kraken2 ✅ |
| MultiQC | 1.14--pyhdfd78af_0 ✅ exists | `multiqc:1.35--pyhdfd78af_1` ✅ | v1.35 (no 2.x exists) | `multiqc` | run: python≥3.9, click, coloredlogs, humanize, jinja2≥3.0.0, jsonschema, markdown, plotly≥5.18, python-kaleido, pillow, natsort, numpy, packaging — **matplotlib/pyyaml no longer listed** (spec column outdated) |
| geNomad | 1.6.0--py38hdfd78af_0 ❌ | `genomad:1.12.0--pyhdfd78af_0` ✅ | v1.12.0 | `genomad download-database` ✅ (README) | MMseqs2, ARAGORN ✅ per README |
| CheckV | 0.8.2--py38hdfd78af_0 ❌ | `checkv:1.1.1--pyh106432d_1` ✅ | 1.1.1 (bioconda; home = bitbucket.org/berkeleylab/checkv — **no GitHub repo**, API 404) | `checkv download_database` ✅ (README). 1.x DIAMOND genome_db ✅ — since v1.2 the `.dmnd` ships **unbuilt** (genome_db has checkv_reps.faa/.fna; built locally with `diamond makedb`). "<0.9 DBs incompatible" ✅ in substance: 0.9.0 release notes — "DIAMOND database built on the fly to avoid incompatabilities (issue #57)" | BLAST+, DIAMOND, HMMER, Prodigal ✅ |
| Pavian | 0.1.0--r42hdfd78af_0 ❌ | **no biocontainers image** → `quay.io/staphb/pavian:1.2.1` ✅ (amd64) | GitHub tags stop at v1.0 (image version 1.2.1 is staphb's own) | Dockerfile (StaPH-B/docker-builds build-files/pavian/1.2.1): `FROM rocker/shiny:4.1.0`, `EXPOSE 3838`, `CMD ["/usr/bin/shiny-server"]`, `WORKDIR /data` — R Shiny service, not a pipeline step ✅. (Upstream README's old florianbw/pavian on port 80 is outdated) | R 4.2+, Shiny ✅ |
| QUAST | 5.2.0--py38hdfd78af_0 ❌ | `quast:5.3.0--py313pl5321h5ca1c30_2` ✅ | quast_5.3.0 | `quast.py` | run: perl, python≥3.12, matplotlib-base, openjdk≥11, joblib, simplejson, blast, glimmerHMM, circos, minimap2, bedtools, bwa — spec's list is a correct subset ✅ |
| MaxBin2 | 2.2.7--py38hdfd78af_0 ❌ | `maxbin2:2.2.7--h503566f_8` ✅ | 2.2.7 (bioconda; home = downloads.jbei.org — **no GitHub repo**, API 404) | `run_MaxBin.pl` in image ✅ (bioconda build.sh line 51: `ln -s $MAXBIN_HOME/run_MaxBin.pl $PREFIX/bin/run_MaxBin.pl`) | bowtie2, fragGeneScan, hmmer, idba ✅ |
| — | — | — | https://biocontainers.pro/ exists ✅ | — | — |

## 3. Nextflow claims

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 3.1 | Spec's resume URL valid | ✅ TRUE | https://www.nextflow.io/docs/latest/cache-and-resume.html → 302 → https://docs.seqera.io/nextflow/cache-and-resume |
| 3.2 | `-resume` skips cached tasks, re-executes only changed/failed | ✅ TRUE | Docs: Nextflow "checks whether the task cache contains a matching hash and whether the task outputs are still present"; "If both conditions are met, the task is resumed. Otherwise, it is re-executed." |
| 3.3 | Caching on by default | ✅ TRUE | "All task executions are automatically saved to the task cache, regardless of the -resume option"; "The cache directive is enabled by default" |
| 3.4 | `docker.volumes` is a valid config key (spec §4.3) | ❌ FALSE | Not among the 15 documented `docker` scope options (cpuLimits, enabled, engineOptions, envWhitelist, fixOwnership, legacy, mountFlags, registry, registryOverride, remove, runOptions, sudo, temp, tty, writableInputMounts). Correct: `docker.runOptions` ("Specify extra command line options supported by the `docker run` command") — https://docs.seqera.io/nextflow/reference/config/docker |
| 3.5 | `docker.temp = 'auto'` valid | ✅ TRUE | Documented, "'auto' creates a temporary directory each time a container starts" |
| 3.6 | `resume = true` in nextflow.config | ❌ NOT DOCUMENTED | `-resume` is documented on the run CLI page ("Run the script using cached results..."); the config reference does not document a `resume` option. (Source internals: LaunchOptions has a `String resume` field; Session reads `config.resume` expecting a run UUID.) Practical rule: use the CLI flag |
| 3.7 | Java 8+ sufficient | ❌ OUTDATED | Install docs require **Java 17+ (up to Java 26)**; pre-17 support dropped/deprecated as of v25.04. Temurin LTS via SDKMAN recommended — https://docs.seqera.io/nextflow/install |
| 3.8 | Latest stable v26.04.6 | ✅ TRUE | GitHub API releases/latest: `v26.04.6` |
| 3.9 | Runs on Linux/macOS/Windows-via-WSL | ✅ TRUE | Install docs |
| 3.10 | Config skeleton keys (workDir, docker.enabled, runOptions, temp, process.container, process.withName) | ✅ TRUE | All documented config keys |

## 4. Geneious Prime claims

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 4.1 | Importable: FASTQ, FASTA, SAM/BAM, GFF/GFF3/GTF, BED, VCF, CSV/TSV; HTML viewable | ✅ TRUE | Manual "Data input formats" table — https://manual.geneious.com/en/latest/ImportExport.html |
| 4.2 | "Native (v11.1+)" for SAM/BAM, GFF/BED, VCF | ❌ FALSE | These were native long before 11.1, per official release notes: GFF import/export 4.6 (2009-03-09); SAM importer 5.0 (2010-04-19); BAM + BED import/export 5.4 (2011-03-29); GTF via GFF importer 5.5 (2011-08-30); VCF import 6.0 (2012-10-04). Version **11.1 (2018-02-07)** added *mixed-file bulk import* — https://assets.geneious.com/documentation/geneious/release_notes.html |
| 4.3 | Bulk import of mixed SAM/BAM/GFF/BED/VCF/FASTA in one operation | ✅ TRUE | Manual: "In version 11.1 onwards, Geneious supports bulk import of a mixture of SAM, BAM, GFF, BED, VCF and Fasta formatted files..." |
| 4.4 | Import Folder preserves structure | ✅ TRUE | Manual |
| 4.5 | Smart NGS import (mixed types, matching IDs) | ✅ TRUE | 11.1 release notes + geneious.com features page |
| 4.6 | CLI since 2022.2 | ⚠️ PARTIAL | CLI released in **2022.0** (release notes 2021-10-12: "Command Line Interface: Released version 2022.0"). **2022.2** (2022-06-14) added import/export from local databases (the `db:path` syntax). `--input`/`-i`, `--output`/`-o` valid |
| 4.7 | CLI needs activated GUI license | ⚠️ PARTIAL | License must be activated in the GUI **or** via geneious.properties (manual CLI page) |
| 4.8 | CLI folders not supported | ⚠️ CONFLICT | Current manual: "You can't specify whole folders of documents"; but official 2023.0 release notes say "Now supports using database folders as inputs". Loop over files = safe approach |
| 4.9 | Spec reference #6 URL | ❌ DEAD | https://help.geneious.com/hc/en-us/articles/360045069731-Supported-file-types-for-Import-Export → HTTP 404 (that article ID only exists on the Geneious Biologics help center). Working replacement: https://help.geneious.com/hc/en-us/articles/360045072251-What-data-file-types-can-be-imported |
| 4.10 | "Geneious Prime 2026.1" is current | ✅ TRUE | Release notes: 2026.1 (2026-04-29), latest patch 2026.1.3 (2026-09-08) |
| 4.11 | Drag-and-drop / file-browser import | ✅ TRUE | Manual |

## 5. Database and reference-data claims

All sizes from HTTP HEAD `Content-Length` or S3 `ListObjectsV2` XML (never by downloading).

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 5.1 | Spec §10.2 URL `k2_pluspfp_20230314.tar.gz` | ✅ TRUE | Exists: 114,021,875,024 B = **106.19 GiB**, Last-Modified 2023-03-22 |
| 5.2 | `k2_standard_20260626.tar.gz` 79.60 GiB | ✅ TRUE | 85,465,587,439 B = **79.596 GiB**, 2026-07-13 (bucket listing + HEAD) |
| 5.3 | ~103 GiB RAM for full k2_standard | ⚠️ PARTIAL (not in official manual; corroborated) | Kraken2 manual gives no per-DB RAM table. Corroboration: extracted `kraken/standard_20260626/hash.k2d` = 110,710,122,820 B = **103.11 GiB** (the hash table is what must fit in RAM); aws-indexes table lists Standard 6/26/2026 as Archive 79.6 GB / Index 103.1 GB — https://benlangmead.github.io/aws-indexes/k2 |
| 5.4 | `k2_standard_08_GB_20260626.tar.gz` 5.54 GiB dl / 7.45 GiB RAM | ✅ TRUE | 5,946,578,575 B = **5.538 GiB**; extracted hash.k2d = 8,000,000,032 B = **7.4506 GiB**; aws-indexes Index 7.5 GB |
| 5.5 | `k2_standard_16_GB_20260626.tar.gz` 11.17 GiB dl / 14.9 GiB RAM | ✅ TRUE | 11,995,707,291 B = **11.172 GiB**; hash.k2d = 16,000,000,032 B = **14.901 GiB**; aws-indexes Index 14.9 GB |
| 5.6 | minikraken2 obsolete (2019 RefSeq) | ⚠️ PARTIAL | Not stated in the manual. Supported by: aws-indexes section "Old Minikraken"; bucket files `minikraken2_v1_8GB_201904.tgz` (6,016,594,204 B), `minikraken2_v2_8GB_201904.tgz` (5,935,990,636 B), `minikraken_8GB_202003.tgz` (5,963,008,395 B) |
| 5.7 | Pre-extracted Kraken2 files on S3 | ✅ TRUE | Bucket contains fully extracted trees: `kraken/standard_20260626/`, `standard_08_GB_20260626/`, `standard_16_GB_20260626/`, `pluspf*_20260626/`, `viral_20260626/` (2,938 non-archive keys of 3,514 under `kraken/`) |
| 5.8 | CheckV DB v1.5 = 1.57 GiB | ✅ TRUE | `checkv-db-v1.5.tar.gz` = 1,681,539,865 B = **1.566 GiB**, 2023-01-11; `CURRENT_RELEASE.txt` = `checkv-db-v1.5` (a 1.5.2 tarball is listed but HEAD returns 403) |
| 5.9 | `checkv download_database` exists | ✅ TRUE | CheckV README (Bitbucket) |
| 5.10 | CheckV 1.x DIAMOND genome_db; <0.9 DBs incompatible | ✅ TRUE (substance) | Since v1.2 the `.dmnd` is not shipped — built locally from `checkv_reps.faa`; 0.9.0 release notes: "DIAMOND database built on the fly to avoid incompatabilities (issue #57)" |
| 5.11 | geNomad DB v1.9 on Zenodo 14886553, ~5 GiB | ✅ TRUE (decimal only) | Zenodo API: title "geNomad database", version 1.9, published 2025-02-18, DOI 10.5281/zenodo.14886553. Files: hmm 3,508,721,059 B + db 842,023,773 B + metadata 7,110,710 B + msa 682,307,529 B = **5,040,163,071 B = 4.69 GiB (5.04 GB decimal)**. "~5 GiB" is right only in decimal GB |
| 5.12 | `genomad download-database` exists | ✅ TRUE | geNomad README + docs |
| 5.13 | Bowtie2 GRCh38_noalt_as.zip 3.49 GiB | ✅ TRUE | 3,749,245,718 B = **3.492 GiB**, 2026-05-26; build.txt: `assembly=GRCh38 no-alt analysis set`, `species=Human`, `source=NCBI`, `tool=bowtie2-build`; index shards (.1/.2/.3/.4/.rev.1/.rev.2.bt2) present |
| 5.14 | Spec §10.1: "MEGAHIT/metaSPAdes 32–64 GB" | ❌ NOT IN DOCS | MEGAHIT: no GB figure — auto memory management (default `-m 0.9` = fraction of RAM). SPAdes: no metagenomics RAM figure (default `-m` limit 250 Gb; only isolate examples) |
| 5.15 | Spec §10.1: "Kraken2/Bracken 16–32 GB for large databases" | ❌ WRONG for large DBs | Kraken2 must hold the DB in RAM: ~103 GB for the full standard (5.3); 16–32 GB only fits the capped variants (7.45/14.9 GiB). Bracken states no RAM requirement at all |
| 5.16 | Spec §10.1: "geNomad/CheckV 16–32 GB" | ❌ CANNOT VERIFY | No RAM figures in either tool's documentation (geNomad advises `--splits` "if your computer is running out of memory") |

## 6. WSL2 / Docker Desktop claims (PLAN §2.3)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 6.1 | Windows 11 Pro/Ent/Edu 23H2+ | ⚠️ PARTIAL | True per Docker docs ("Windows 11 64-bit: Enterprise, Pro, or Education version 23H2 (build 22631) or higher"), but they also still support **Windows 10 22H2 (build 19045)** Pro/Ent/Edu — omitted in PLAN |
| 6.2 | WSL 2.1.5+ | ✅ TRUE | Verbatim in Docker requirements ("WSL version 2.1.5 or later"); Enhanced Container Isolation needs WSL 2.6+ |
| 6.3 | 8 GB RAM | ✅ TRUE | "8GB system RAM" (with SLAT) |
| 6.4 | Virtualization enabled | ✅ TRUE | "Enable hardware virtualization in BIOS/UEFI" |
| 6.5 | "Use WSL 2 based engine" + WSL Integration | ✅ TRUE | Settings > General; Settings > Resources > WSL Integration (per-distro) |
| 6.6 | Memory cap via `%UserProfile%\.wslconfig` | ✅ TRUE | `[wsl2] memory=...`; requires `wsl --shutdown` (and Docker Desktop restart, since the engine runs in a WSL2 distro) |
| 6.7 | Default WSL2 VM memory = 50% of RAM | ✅ TRUE | Current docs default "50% of total memory on Windows" (older builds 80%; historically "50% or 8 GB, whichever is less"). On 16 GB → default 8 GB cap, so PLAN's 12–14 GB is a real increase |
| 6.8 | `\\wsl.localhost\<distro>\...` Explorer access | ✅ TRUE | Documented in Microsoft .wslconfig page (example `\\wsl.localhost\Ubuntu-20.04\etc\wsl.conf`); equivalent older form `\\wsl$` |
| 6.9 | Keep projects on ext4, not /mnt/c | ✅ TRUE | Microsoft: "For the fastest performance speed, store your files in the WSL file system... /home/<user>/Project — Not ... /mnt/c/Users/<user>/Project". Nuance: "9P" names the Windows→Linux direction (Microsoft Command Line blog); the slow Linux→Windows `/mnt/c` path is the DrvFs/cross-OS access path |
| 6.10 | WSL2 VM + Docker share one memory budget | ✅ TRUE | One managed utility VM for all WSL2 distros; the Docker engine runs in its own `docker-desktop` distro inside it; no separate Docker Desktop memory slider for the WSL2 backend; allocation is dynamic (cap = ceiling, not reservation) |

## 7. Files updated (2026-09-11)

**`dolphinnext-metagenomics-platform-version-1-0-specification.md`**
- Header: added "Fact-Checked: September 11, 2026" line
- §2.1: added source line (README GPL 3.0 quote + paper citation)
- §3.3/§10.3: source URLs updated with canonical docs.seqera.io links
- §3.4: stretch goals corrected — PDF/R Markdown/Shiny are core features; added sources
- §3.5: added `/export` sources + note that the paper doesn't name it
- §4.1: Java row → 17+ (paper-era 8+ noted); memory row → `docker run -m 10G` sourcing
- §4.2: added fact-check corrections (image never published; `-p 8080:80`; `config/.sec` for BASE_PATH/PUBWEB_URL)
- §4.3: config fixed — `docker.volumes` → `docker.runOptions`, `docker.temp='auto'`, removed `resume = true` (CLI-only)
- §5.2: added fact-check note (2/13 tags exist; verified replacements in PLAN §2.1; dependency corrections)
- §6.1: "Native (v11.1+)" corrected to actual native versions + "mixed bulk import since 11.1"; replaced dead help.geneious.com link
- §6.2: note corrected with 11.1 detail + source
- §7.1: sources added (overview.rst revisioning quote; paper's lack of "provenance" word noted)
- §8.1: step 3 flagged (image never published)
- §10.1: fact-check note (figures not in official docs; ~103 GiB for full k2_standard)
- §10.2: source for the Kraken2 URL + size; fixed stray space in `tar` line
- §11: added references 7–13; flagged dead reference #6
- New §12: Fact-Check Summary verdict table

**`PLAN.md`**
- Header: fact-checked note
- §2.1: corrected Kraken2 renumbering claim (no 2.14); corrected Bracken "Python rewrite" claim; added fastp 1.3.7 note; Pavian row backed by Dockerfile; added re-verification block (all 14 tags exist, amd64, bioconda versions match) + sources
- §2.2: corrected jdlamstein row (Ubuntu 16.04/PHP 7.2/Python 2/MySQL confirmed; "Nextflow 19.10.0" unsubstantiated); corrected `.dn` description (AES with empty passphrase, no instance secret); corrected OpenCPU claim (nowhere in paper/source); API-runs-only confirmed with api.rst endpoints; added full sources block
- §2.3: Geneious CLI row fixed (2022.0 vs 2022.2); minikraken2 row sourced to aws-indexes; added sources to Nextflow skeleton, database table, WSL2 bullets, Geneious bullets
- §7 (decision table): option C "pinned Nextflow 19.10.0" fixed
- §8: replaced stub with full references list (all accessed 2026-09-11)

## 8. Complete source list (all accessed 2026-09-11)

**DolphinNext / paper**
- https://github.com/UMMS-Biocore/dolphinnext (README, docs/, public/, db/)
- https://api.github.com/repos/UMMS-Biocore/dolphinnext (pushed_at 2023-09-15T19:33:30Z, 36 open issues, 2 forks, 8 stars)
- https://api.github.com/repos/UMMS-Biocore/dolphinnext/license (HTTP 404)
- https://api.github.com/repos/UMMS-Biocore/dolphinnext-studio (HTTP 404)
- https://codeload.github.com/UMMS-Biocore/dolphinnext/tar.gz/refs/heads/master (source inspection)
- https://codeload.github.com/UMMS-Biocore/dolphinnext-studio/tar.gz/refs/heads/master (HTTP 404)
- https://doi.org/10.1186/s12864-020-6714-x ; https://pmc.ncbi.nlm.nih.gov/articles/PMC7168977/ (full text via Europe PMC API)
- https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/{admin_quick,admin_faq,api,run,overview,profile}.rst
- https://github.com/UMMS-Biocore/dolphinnext/blob/master/public/ajax/dbfuncs.php
- https://github.com/UMMS-Biocore/dolphinnext/blob/master/public/js/pipelineModal.js
- https://github.com/UMMS-Biocore/dolphinnext/blob/master/public/js/import.js
- https://dolphinnext.readthedocs.io (HTTP 404)
- https://dolphinnext.umassmed.edu (HTTP 301 → https://viafoundry.umassmed.edu/vpipe/)
- https://docs.viascientific.com/about/ ("Via Foundry, formerly known as DolphinNext")
- https://hub.docker.com/v2/repositories/ummsbiocore/dolphinnext-studio/tags/?page_size=100 (count: 0)
- https://hub.docker.com/v2/repositories/jdlamstein/dolphinnext-studio/tags/latest/ (6.04 GB, amd64, 2023-11-14 tag / 2021-12-27 push)

**Images / versions**
- https://quay.io/api/v1/repository/biocontainers/<repo>/tag/?specificTag=<tag> (all 27 tag checks)
- https://quay.io/v2/ (manifests + config blobs; all PLAN tags linux/amd64)
- https://anaconda.org/bioconda/ ; https://api.anaconda.org/package/bioconda/<pkg>
- https://github.com/bioconda/bioconda-recipes (meta.yaml/build.sh per tool)
- https://github.com/ablab/spades/tree/v4.3.0 (metaspades.py symlink → spades.py)
- https://github.com/DerrickWood/kraken2 (scripts/kraken2-build; CHANGELOG.md 2.1.6 → 2.17.0)
- https://github.com/jenniferlu717/Bracken (bash launcher VERSION="3.0.2"; src/; CHANGELOG ends 2.9)
- https://github.com/StaPH-B/docker-builds/blob/master/build-files/pavian/1.2.1/Dockerfile (EXPOSE 3838, CMD shiny-server, WORKDIR /data)
- https://bitbucket.org/berkeleylab/checkv (CheckV home)
- GitHub API releases/tags: OpenGene/fastp v1.3.7, voutcn/megahit v1.2.9, ablab/spades v4.3.0, DerrickWood/kraken2 v2.17.1, jenniferlu717/Bracken v3.1, MultiQC/MultiQC v1.35, apcamargo/genomad v1.12.0, ablab/quast quast_5.3.0, fbreitwieser/pavian v1.0, s-andrews/FastQC v0.12.1, BenLangmead/bowtie2 v2.5.5; berkeleylab/checkv 404; JackieZhuang/MaxBin2 404

**Nextflow**
- https://docs.seqera.io/nextflow/install (Java 17+, Temurin LTS)
- https://docs.seqera.io/nextflow/cache-and-resume
- https://docs.seqera.io/nextflow/reference/config/docker (15 docker options; no `volumes`)
- https://docs.seqera.io/nextflow/reference/config ; https://docs.seqera.io/nextflow/reference/cli/run
- https://api.github.com/repos/nextflow-io/nextflow/releases/latest (v26.04.6)
- https://raw.githubusercontent.com/nextflow-io/nextflow/master/modules/nextflow/src/main/groovy/nextflow/Session.groovy (config.resume consumed as UUID)
- (nextflow.io/docs URLs 302 → docs.seqera.io)

**Geneious**
- https://manual.geneious.com/en/latest/ImportExport.html
- https://manual.geneious.com/en/latest/CommandLineInterface.html
- https://assets.geneious.com/documentation/geneious/release_notes.html
- https://www.geneious.com/updates/geneious-prime-r11-1 ; https://www.geneious.com/updates/geneious-prime-2022-2 ; https://www.geneious.com/updates
- https://help.geneious.com/hc/en-us/articles/360045072251-What-data-file-types-can-be-imported (replaces dead 360045069731)
- https://www.geneious.com/features/import-export-sequence-data

**Databases**
- https://genome-idx.s3.amazonaws.com/?list-type=2&prefix=kraken/ (3,514 keys, exact sizes)
- https://genome-idx.s3.amazonaws.com/kraken/k2_pluspfp_20230314.tar.gz (HEAD: 106.19 GiB)
- https://benlangmead.github.io/aws-indexes/k2
- https://github.com/DerrickWood/kraken2/wiki/Manual (no per-DB RAM table)
- https://portal.nersc.gov/CheckV/ (checkv-db-v1.5.tar.gz 1.566 GiB; CURRENT_RELEASE.txt)
- https://bitbucket.org/berkeleylab/checkv/raw/master/README.md ; RELEASE_NOTES.txt
- https://zenodo.org/api/records/14886553 (geNomad DB v1.9, 2025-02-18)
- https://portal.nersc.gov/genomad/ ; https://raw.githubusercontent.com/apcamargo/genomad/main/README.md
- https://genome-idx.s3.amazonaws.com/bt/GRCh38_noalt_as.zip (HEAD: 3.492 GiB) ; .../GRCh38_noalt_as.build.txt
- https://github.com/voutcn/megahit/wiki/MEGAHIT-Memory-setting ; https://ablab.github.io/spades/running.html

**WSL / Docker Desktop**
- https://docs.docker.com/desktop/setup/install/windows-install/
- https://docs.docker.com/desktop/features/wsl/
- https://docs.docker.com/desktop/settings-and-maintenance/settings/
- https://learn.microsoft.com/en-us/windows/wsl/wsl-config
- https://learn.microsoft.com/en-us/windows/wsl/filesystems
- https://learn.microsoft.com/en-us/windows/wsl/compare-versions
- https://learn.microsoft.com/en-us/windows/wsl/faq
- https://devblogs.microsoft.com/commandline/a-deep-dive-into-how-wsl-allows-windows-to-access-linux-files/
- https://github.com/microsoft/WSL/issues/7429

---

*End of Fact-Check Report*
