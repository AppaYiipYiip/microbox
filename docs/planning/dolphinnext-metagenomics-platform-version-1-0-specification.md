# DolphinNext Metagenomics Platform: Version 1.0 Specification

**Version:** 1.0
**Status:** Final Specification for Single-User Local Deployment
**Last Updated:** September 11, 2026
**Fact-Checked:** September 11, 2026 — all claims verified against live web/registry sources; see inline notes and §12.
**Author:** marouane (marouanestage773)

---

## 1. Purpose

This document specifies the requirements for implementing a local, Docker-based DolphinNext platform to support metagenomics analysis workflows for vaccine R&D. The platform will orchestrate bioinformatics tools via Nextflow, execute each tool in isolated Docker containers, and integrate with Geneious Prime for downstream analysis.

---

## 2. Platform Overview

### 2.1 What DolphinNext Is

DolphinNext is an open-source (GNU GPL 3.0) orchestration platform that provides:

- A drag-and-drop graphical interface for building computational pipelines
- Automatic generation of Nextflow code from visual pipeline definitions
- Execution of each bioinformatics tool inside its own Docker container
- Comprehensive provenance tracking of versions, parameters, inputs, and outputs
- Integrated report generation from pipeline results

**Architectural Principle:** DolphinNext does not perform scientific computation. All calculations occur within separate Docker containers. The platform only manages orchestration, data flow, and execution tracking.

Source: [DolphinNext GitHub README](https://github.com/UMMS-Biocore/dolphinnext) — "DolphinNext released under GNU General Public License 3.0."; [Yukselen O, Turkyilmaz O, Ozturk AR, Garber M, Kucukural A. "DolphinNext: a distributed data processing platform for high throughput genomics." BMC Genomics 21:310 (2020), CC BY 4.0](https://doi.org/10.1186/s12864-020-6714-x) ([PMC7168977](https://pmc.ncbi.nlm.nih.gov/articles/PMC7168977/))

### 2.2 Deployment Context

This deployment is scoped for single-user operation on a private VM:

- **Users:** 1 (single researcher)
- **Infrastructure:** Single private VM with Docker
- **Network:** Private, behind firewall
- **Compute:** Local Docker execution (no HPC scheduler)
- **Storage:** Persistent volumes mounted from host

---

## 3. Core Requirements

### 3.1 Pipeline Construction

The platform must provide:

- Drag-and-drop interface for creating pipelines by connecting process nodes
- Process library for selecting and adding pre-defined tools
- Type-compatibility enforcement between connected processes
- Support for branching and parallel execution paths
- Pipeline versioning and reuse capabilities

### 3.2 Tool Integration

Each tool must be integrated as follows:

1. **Containerization:** Tool packaged in its own Docker image with all dependencies
2. **Process Definition:** Input/output parameters and Docker image reference defined in DolphinNext
3. **Isolation:** Tool execution isolated from host and other tools
4. **External Dependencies:** Large reference databases mounted as volumes at runtime

**Implementation Note:** Adding a new tool does not modify DolphinNext core code. It requires only a new Docker image and a new process definition.

### 3.3 Pipeline Execution

The platform must:

- Execute pipelines using Nextflow as the underlying engine
- Support local Docker execution environment
- Provide real-time monitoring of pipeline execution
- Enable resumption of partially completed pipelines from intermediate steps
- Automatically record tool versions, parameters, and input/output file paths for every run

**Resume Capability:** Nextflow's caching mechanism (`-resume` flag) allows restarting from the last successfully completed step. Completed tasks are skipped and cached results reused, preventing data loss from crashes or interruptions.

Source: [Nextflow Caching and Resume Documentation](https://www.nextflow.io/docs/latest/cache-and-resume.html) (canonical URL: https://docs.seqera.io/nextflow/cache-and-resume)

### 3.4 Reporting and Visualization

The platform must generate:

- Automatic reports from pipeline outputs in HTML and table formats
- Export of pipeline results in standard formats for downstream analysis
- Support for MultiQC aggregation of quality control results

**Report Types (verified):** DolphinNext supports HTML, table, PDF and R Markdown report types, plus embedded Shiny + R Markdown applications for interactive visualization — these are core features, not stretch goals (paper: "e.g. Html, table, pdf, R markdown"; "Extensive reports with R-markdown and shiny support"). MultiQC HTML output can be embedded into report sections.

Sources: [DolphinNext BMC Genomics Publication](https://bmcgenomics.biomedcentral.com/articles/10.1186/s12864-020-6714-x) ([PMC7168977](https://pmc.ncbi.nlm.nih.gov/articles/PMC7168977/)); [run.rst — embedding MultiQC HTML in reports](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/run.rst)

### 3.5 Data Persistence

The platform must:

- Persist all data across container restarts via mounted volumes
- Store pipeline outputs, reference databases, and intermediate files on host filesystem
- Maintain execution state for resume capability

**Volume Mount Strategy:**
- `/export`: Pipeline data, results, and reference databases (persistent)
- `/work`: Nextflow work directory for intermediate files and cache (persistent)

Source: [admin_quick.rst](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/admin_quick.rst) — "Please don't change the target directory (/export) in the docker image."; [pipeline.rst](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/pipeline.rst) — tool containers are run with `-v /export:/export`. `/work` is the Nextflow work directory ([Nextflow config reference](https://docs.seqera.io/nextflow/reference/config)). Note: `/export` is not named in the 2020 paper; it comes from DolphinNext's docs/code.

---

## 4. Technical Requirements

### 4.1 Infrastructure

| Requirement | Specification |
|-------------|---------------|
| Operating System | 64-bit Linux or Windows with WSL2 |
| Docker Engine | Installed and configured |
| Memory | Official docs launch the container with `docker run -m 10G` (memory limit for the Nextflow executor job); tools may need more |
| Storage | Persistent volumes for `/export` and `/work` |
| Java Runtime | Version 17 or higher for Nextflow v25.04+ (the 2020 DolphinNext paper stated "Java 8 or higher", now outdated) |

### 4.2 Platform Deployment

The platform must be deployed from the official Docker image:

```bash
# Run DolphinNext container
docker run -d \
  -p 8080:8080 \
  -v /host/export:/export \
  -v /host/work:/work \
  -e BASE_PATH=/dolphinnext \
  -e PUBWEB_URL=http://localhost:8080 \
  --name dolphinnext \
  ummsbiocore/dolphinnext-studio:latest
```

**Access:** Web interface available at `http://localhost:8080/dolphinnext`

Sources: [admin_quick.rst — official docker run command using `ummsbiocore/dolphinnext-studio`](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/admin_quick.rst); [admin_faq.rst — BASE_PATH/PUBWEB_URL defaults](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/admin_faq.rst)

**Fact-check corrections (2026-09-11):**
- The image name `ummsbiocore/dolphinnext-studio` is from the official docs, but the Docker Hub repo has **zero published tags** ([Docker Hub API](https://hub.docker.com/v2/repositories/ummsbiocore/dolphinnext-studio/tags/?page_size=100)) — the command above cannot work as written.
- Official docs use `-p 8080:80` (container listens on port 80), not `8080:8080`.
- `BASE_PATH`/`PUBWEB_URL` are configured in the container's `config/.sec` file (defaults: `BASE_PATH = http://localhost:8080/dolphinnext`, `PUBWEB_URL = http://localhost:8080/dolphinnext/tmp/pub`), not via `docker run -e` environment variables.

### 4.3 Nextflow Configuration

Nextflow must be configured with:

- Local Docker executor as default
- Work directory set to persistent volume (`/work`)
- Resume capability enabled by default

```groovy
// nextflow.config
profiles {
  docker {
    docker.enabled = true
    docker.runOptions = '-v /host/export:/export -v /host/work:/work'
    docker.temp = 'auto'
  }
}
workDir = '/work'
// Resume is CLI-only: nextflow run pipeline.nf -resume
// (`resume = true` in config is not a documented option)
```

Sources: [Nextflow Docker config scope reference](https://docs.seqera.io/nextflow/reference/config/docker) — `docker.volumes` is **not** a valid key; `docker.runOptions` = "Specify extra command line options supported by the `docker run` command"; [Cache & resume docs](https://docs.seqera.io/nextflow/cache-and-resume) — resume is enabled with the `-resume` CLI flag; task caching itself is on by default.

---

## 5. Tool Inventory and Dependencies

### 5.1 Core Pipeline Tools

Based on the provided workflow diagram, the following tools form the primary pipeline:

| Tool | Purpose | Executable | Container Image | Dependencies | Database Requirements |
|------|---------|-----------|----------------|--------------|------------------------|
| FastQC | Quality control | `fastqc` | `quay.io/biocontainers/fastqc:0.11.9--0` | Java Runtime, Perl | None |
| fastp | Quality filtering | `fastp` | `quay.io/biocontainers/fastp:0.23.2--h5502775_0` | libdeflate, libisal, libstdc++6 | None |
| Bowtie2 | Host depletion | `bowtie2` | `quay.io/biocontainers/bowtie2:2.4.5--py38h7e06652_0` | Python 3, Perl, zlib | Reference genome index |
| MEGAHIT | Assembly | `megahit` | `quay.io/biocontainers/megahit:1.2.9--py38h7132678_0` | Python 3, zlib, bzip2 | None |
| metaSPAdes | Assembly | `metaspades.py` | `quay.io/biocontainers/spades:3.15.5--py38h4a756c0_0` | Python 3.8+, zlib, libbz2 | None |
| Kraken2 | Taxonomic classification | `kraken2` | `quay.io/biocontainers/kraken2:2.1.2--pl5321hdfd78af_0` | blast, perl, python, rsync, tar, wget | **External database required** |
| Bracken | Abundance estimation | `bracken` | `quay.io/biocontainers/bracken:2.6.2--py38hdfd78af_0` | kraken2, python | **Kraken2 database required** |
| MultiQC | Report aggregation | `multiqc` | `quay.io/biocontainers/multiqc:1.14--pyhdfd78af_0` | Python 3, matplotlib, numpy, click, jinja2, pyyaml | None |

### 5.2 Specialized Tools

Additional tools for viral analysis and quality assessment:

| Tool | Purpose | Executable | Container Image | Dependencies | Database Requirements |
|------|---------|-----------|----------------|--------------|------------------------|
| geNomad | Viral sequence identification | `genomad` | `quay.io/biocontainers/genomad:1.6.0--py38hdfd78af_0` | MMseqs2, ARAGORN | **External database required** |
| CheckV | Viral genome QC | `checkv` | `quay.io/biocontainers/checkv:0.8.2--py38hdfd78af_0` | BLAST+, DIAMOND, HMMER, Prodigal | **External database required** |
| Pavian | Interactive visualization | R/Shiny | `quay.io/biocontainers/pavian:0.1.0--r42hdfd78af_0` | R 4.2+, Shiny | Kraken2/Bracken output |
| QUAST | Assembly QC | `quast.py` | `quay.io/biocontainers/quast:5.2.0--py38hdfd78af_0` | Python 3, matplotlib, numpy, joblib, blast, bwa, bedtools, minimap2 | None |
| MaxBin2 | Genome binning | `run_MaxBin.pl` | `quay.io/biocontainers/maxbin2:2.2.7--py38hdfd78af_0` | bowtie2, fragGeneScan, hmmer, idba | None |

**Fact-check (2026-09-11, Quay.io API):** only 2 of the 13 tags above exist — `fastqc:0.11.9--0` and `multiqc:1.14--pyhdfd78af_0`. All other build hashes were invented (never published). Verified pinned replacements (all linux/amd64) are listed in PLAN.md §2.1. Dependency corrections per bioconda recipes: MultiQC's current runtime deps are click, jinja2, numpy, plotly, kaleido, coloredlogs, markdown, etc. (matplotlib/pyyaml no longer listed); MEGAHIT runtime deps are python only (zlib/bzip2 are build-time); Pavian has no biocontainers image — use `quay.io/staphb/pavian:1.2.1` (R Shiny server, port 3838, `/data` volume).

### 5.3 Containerization Strategy

**Principle:** Each tool runs in its own Docker container with all runtime dependencies pre-installed.

**Key Points:**

1. **No host installation required:** All tool dependencies are contained within their respective Docker images
2. **Biocontainers preferred:** Use images from [Biocontainers](https://biocontainers.pro/) where available
3. **Database volumes:** Large reference databases (Kraken2, CheckV, geNomad) must be stored on host filesystem and mounted into containers at runtime
4. **Version pinning:** Each tool image must be pinned to a specific version for reproducibility

**Example Volume Mount for Databases:**
```bash
# For Kraken2 database
docker run -v /host/kraken2-db:/db:ro kraken2-image kraken2 --db /db ...
```

Source: [Biocontainers Documentation](https://biocontainers.pro/)

---

## 6. Geneious Prime Integration

### 6.1 File Format Compatibility

All pipeline outputs must be compatible with Geneious Prime for downstream analysis. Geneious Prime supports the following formats relevant to this workflow:

| Format | Produced By | Geneious Support | Status |
|--------|-------------|------------------|--------|
| FASTQ | fastp, sequencers | Native | Compatible |
| FASTA | MEGAHIT, metaSPAdes, geNomad, CheckV | Native | Compatible |
| SAM/BAM | Bowtie2, BWA | Native (since 5.0/5.4); mixed bulk import since 11.1 | Compatible |
| GFF/BED | Prodigal, QUAST | Native (since 4.6/5.4); mixed bulk import since 11.1 | Compatible |
| VCF | Various | Native (since 6.0); mixed bulk import since 11.1 | Compatible |
| CSV/TSV | MultiQC, Kraken2, Bracken | Native | Compatible |
| HTML | FastQC, MultiQC, QUAST | Viewable | Compatible |

**Verification:** All tools in the inventory produce standard bioinformatics formats that Geneious Prime can import directly.

Sources:
- [Geneious Prime User Manual - Import/Export](https://manual.geneious.com/en/latest/ImportExport.html)
- [Geneious release notes (full version history)](https://assets.geneious.com/documentation/geneious/release_notes.html) — SAM import 5.0 (2010), BAM/BED import/export 5.4 (2011), VCF import 6.0 (2012), GFF import/export 4.6 (2009); mixed-file bulk import 11.1 (2018)
- [Geneious Prime R11.1 release notes](https://www.geneious.com/updates/geneious-prime-r11-1)
- [Geneious Smart NGS Import](https://www.geneious.com/features/import-export-sequence-data)
- **Broken link replaced:** the previously cited https://help.geneious.com/hc/en-us/articles/360045069731-Supported-file-types-for-Import-Export returns HTTP 404. Working replacement: [What data file types can be imported?](https://help.geneious.com/hc/en-us/articles/360045072251-What-data-file-types-can-be-imported)

### 6.2 Data Export Workflow

Pipeline outputs are written to the `/export` volume on the host filesystem. Users can:

1. Access files directly from the host at the mounted `/export` directory
2. Import into Geneious Prime via drag-and-drop or file browser
3. Use Geneious Prime's bulk import for multiple files of different types

**Note:** Geneious Prime supports bulk import of mixed file types (SAM, BAM, GFF, BED, VCF, FASTA) in a single operation — mixed bulk import was added in Geneious 11.1; each format individually was native much earlier (see §6.1).

Source: [Geneious manual — Import/Export](https://manual.geneious.com/en/latest/ImportExport.html) ("In version 11.1 onwards, Geneious supports bulk import of a mixture of SAM, BAM, GFF, BED, VCF and Fasta formatted files…")

---

## 7. Provenance and Reproducibility

### 7.1 Provenance Tracking

The platform must automatically record for every pipeline run:

- Pipeline version and definition
- Process versions used
- All parameter values
- Input file paths and checksums
- Output file paths and checksums
- Execution timestamps and durations
- Tool versions (from Docker image tags)

**Implementation:** DolphinNext's revisioning system tracks pipeline and process versions. Nextflow's execution cache records task metadata. Combined, these provide complete provenance.

Sources: [overview.rst — "Revisioning system keeps track of pipelines and processes versions as well as their parameters"](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/overview.rst); [DolphinNext BMC Genomics Publication](https://bmcgenomics.biomedcentral.com/articles/10.1186/s12864-020-6714-x) (note: the paper describes the revisioning/rerun mechanics but does not use the word "provenance"); [Nextflow cache-and-resume docs](https://docs.seqera.io/nextflow/cache-and-resume)

### 7.2 FAIR Compliance

The platform must support FAIR principles:

- **Findable:** Pipelines and processes have unique identifiers and versions
- **Accessible:** All data stored in standardized formats on persistent storage
- **Interoperable:** Standard file formats (FASTQ, FASTA, BAM, etc.)
- **Reusable:** Standalone Nextflow scripts can run anywhere with Docker

**Export Capability:** Any pipeline can be exported as a standalone Nextflow script with all versions and parameters embedded.

---

## 8. Implementation Plan

### 8.1 Phase 1: Infrastructure Setup (1-2 days)

**Tasks:**
1. Provision VM with 64-bit Linux or WSL2
2. Install Docker Engine
3. Pull `ummsbiocore/dolphinnext-studio:latest` image — ⚠️ never published (0 tags on Docker Hub); see §4.2 corrections
4. Create host directories: `/export` and `/work`
5. Run DolphinNext container with volume mounts
6. Verify web interface at `http://localhost:8080/dolphinnext`
7. Configure `BASE_PATH` and `PUBWEB_URL` parameters

**Deliverables:**
- Running DolphinNext instance
- Verified web access
- Persistent storage configured

### 8.2 Phase 2: Core Tool Integration (1-2 weeks)

**Tasks for each Phase 1 tool:**
1. Select appropriate Biocontainers image
2. Verify tool runs correctly in container
3. Define process in DolphinNext (inputs, outputs, parameters)
4. Test process with sample data
5. Document parameters and dependencies

**Phase 1 Tools (Priority):**
- FastQC
- fastp
- MEGAHIT
- Kraken2 (with database volume)
- Bracken (with Kraken2 database)
- MultiQC

**Deliverables:**
- Docker images for all Phase 1 tools
- Working process definitions
- Test data and expected outputs
- Parameter documentation

### 8.3 Phase 3: Pipeline Construction (3-5 days)

**Tasks:**
1. Build metagenomics pipeline connecting Phase 1 tools
2. Configure pipeline parameters and branching
3. Test end-to-end execution with sample data
4. Verify resume capability by interrupting and restarting
5. Generate reports from pipeline outputs
6. Export standalone Nextflow script

**Deliverables:**
- Working metagenomics pipeline
- End-to-end test results
- Generated reports
- Standalone Nextflow script

### 8.4 Phase 4: Specialized Tools (2-4 weeks)

**Tasks:**
1. Integrate Phase 2 tools (geNomad, CheckV, Pavian, QUAST)
2. Configure database volumes for tools requiring external data
3. Test specialized pipelines
4. Validate reproducibility across runs
5. Document all processes

**Deliverables:**
- Extended toolset
- Database volume configurations
- Reproducibility validation report

---

## 9. Acceptance Criteria

The platform is considered complete when the following criteria are met:

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC-01 | DolphinNext web interface loads at `http://localhost:8080/dolphinnext` | Browser access |
| AC-02 | User can create pipeline and add process nodes | Manual walkthrough |
| AC-03 | User can connect process nodes via type-compatible ports | Manual walkthrough |
| AC-04 | All Phase 1 tools execute successfully as individual processes | Test each tool |
| AC-05 | End-to-end pipeline executes with sample data | Run complete pipeline |
| AC-06 | Pipeline can resume from failed step without re-running completed steps | Interrupt and resume test |
| AC-07 | Reports generated from pipeline outputs | Verify report content |
| AC-08 | Data persists across container stop/start | Stop container, restart, verify |
| AC-09 | Standalone Nextflow script runs independently | Command-line execution |

---

## 10. Technical Notes

### 10.1 Memory Requirements

The DolphinNext container requires minimum 10 GB memory. However, individual tools may require significantly more:

- **MEGAHIT/metaSPAdes:** 32-64 GB recommended for assembly
- **Kraken2/Bracken:** 16-32 GB for large databases
- **geNomad/CheckV:** 16-32 GB for viral analysis

**Recommendation:** Allocate sufficient VM memory based on the largest tool in the pipeline.

**Fact-check (2026-09-11):** these GB figures are not stated in the tools' official docs. MEGAHIT auto-manages memory ([MEGAHIT memory-setting wiki](https://github.com/voutcn/megahit/wiki/MEGAHIT-Memory-setting)); SPAdes documents no metagenomics RAM figure ([SPAdes manual](https://ablab.github.io/spades/running.html)); Kraken2 needs RAM to hold the database hash table — ~103 GiB for the full k2_standard ([aws-indexes pre-built DB table](https://benlangmead.github.io/aws-indexes/k2); extracted `hash.k2d` = 103.11 GiB); Bracken states no RAM requirement; geNomad/CheckV document no RAM figures.

### 10.2 Database Management

Tools requiring external databases (Kraken2, Bracken, geNomad, CheckV) must have their databases:

1. Downloaded to host filesystem
2. Stored outside Docker images (too large for images)
3. Mounted as read-only volumes at runtime

**Example Database Setup:**
```bash
# Download Kraken2 database
wget https://genome-idx.s3.amazonaws.com/kraken/k2_pluspfp_20230314.tar.gz
mkdir -p /host/kraken2-db
tar -xzvf k2_pluspfp_20230314.tar.gz -C /host/kraken2-db

# Mount in process definition
-v /host/kraken2-db:/db:ro
```

Source: the URL is valid — [k2_pluspfp_20230314.tar.gz](https://genome-idx.s3.amazonaws.com/kraken/k2_pluspfp_20230314.tar.gz) (106.19 GiB, published 2023-03-22; verified via HTTP HEAD). Full bucket listing: https://genome-idx.s3.amazonaws.com/?list-type=2&prefix=kraken/

### 10.3 Crash Recovery

For long-running pipelines (hours) with risk of crashes or power loss:

1. **Work directory must be on persistent volume:** `-v /host/work:/work`
2. **Use `-resume` flag:** `nextflow run pipeline.nf -resume`
3. **Do not clean work directory:** Intermediate files are required for resume

**Result:** Completed tasks are cached and reused; only incomplete or modified tasks re-execute.

Source: [Nextflow Resume Documentation](https://www.nextflow.io/docs/latest/cache-and-resume.html) (canonical URL: https://docs.seqera.io/nextflow/cache-and-resume)

---

## 11. References

1. DolphinNext: a distributed data processing platform for high throughput genomics. *BMC Genomics*, 2020. [https://bmcgenomics.biomedcentral.com/articles/10.1186/s12864-020-6714-x](https://bmcgenomics.biomedcentral.com/articles/10.1186/s12864-020-6714-x)

2. Nextflow Documentation. [https://www.nextflow.io/docs/latest/](https://www.nextflow.io/docs/latest/)

3. Docker Documentation. [https://docs.docker.com/](https://docs.docker.com/)

4. Biocontainers. [https://biocontainers.pro/](https://biocontainers.pro/)

5. Geneious Prime User Manual - Import/Export. [https://manual.geneious.com/en/latest/ImportExport.html](https://manual.geneious.com/en/latest/ImportExport.html)

6. Geneious Supported File Types. [https://help.geneious.com/hc/en-us/articles/360045069731-Supported-file-types-for-Import-Export](https://help.geneious.com/hc/en-us/articles/360045069731-Supported-file-types-for-Import-Export) — ⚠️ HTTP 404 (dead); working replacement: [What data file types can be imported?](https://help.geneious.com/hc/en-us/articles/360045072251-What-data-file-types-can-be-imported)

7. Nextflow docs (canonical, was nextflow.io): [Caching & resuming](https://docs.seqera.io/nextflow/cache-and-resume), [Docker config scope](https://docs.seqera.io/nextflow/reference/config/docker), [CLI reference — run](https://docs.seqera.io/nextflow/reference/cli/run), [Installation / Java 17+ requirement](https://docs.seqera.io/nextflow/install), [Releases](https://github.com/nextflow-io/nextflow/releases/latest)

8. DolphinNext in-repo docs: [admin_quick.rst](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/admin_quick.rst), [admin_faq.rst](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/admin_faq.rst), [api.rst](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/api.rst), [run.rst](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/run.rst), [overview.rst](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/overview.rst), [profile.rst](https://github.com/UMMS-Biocore/dolphinnext/blob/master/docs/dolphinNext/profile.rst)

9. Quay.io API / registry (tag + architecture verification): [https://quay.io/api/v1/repository/biocontainers/multiqc/tag/?specificTag=1.35--pyhdfd78af_1](https://quay.io/api/v1/repository/biocontainers/multiqc/tag/?specificTag=1.35--pyhdfd78af_1), [https://quay.io/v2/](https://quay.io/v2/)

10. Docker Hub API: [ummsbiocore/dolphinnext-studio tags (count: 0)](https://hub.docker.com/v2/repositories/ummsbiocore/dolphinnext-studio/tags/?page_size=100), [jdlamstein/dolphinnext-studio latest tag](https://hub.docker.com/v2/repositories/jdlamstein/dolphinnext-studio/tags/latest/)

11. Geneious release notes (version history): [https://assets.geneious.com/documentation/geneious/release_notes.html](https://assets.geneious.com/documentation/geneious/release_notes.html)

12. Kraken2 databases: [S3 bucket listing](https://genome-idx.s3.amazonaws.com/?list-type=2&prefix=kraken/), [aws-indexes pre-built DB table](https://benlangmead.github.io/aws-indexes/k2), [Kraken2 manual](https://github.com/DerrickWood/kraken2/wiki/Manual)

13. MEGAHIT memory: [MEGAHIT wiki](https://github.com/voutcn/megahit/wiki/MEGAHIT-Memory-setting); SPAdes: [SPAdes manual](https://ablab.github.io/spades/running.html)

---

## 12. Fact-Check Summary (verified 2026-09-11)

Every external claim in this document was verified against live sources on 2026-09-11 (registry APIs, GitHub, official docs, publication full text). Key verdicts:

| Claim | Verdict |
|---|---|
| DolphinNext is GNU GPL 3.0 | ✅ TRUE (GitHub README) |
| Drag-and-drop GUI, Nextflow generation, Docker-per-tool, revisioning, reports | ✅ TRUE (paper PMC7168977, docs) |
| Report types HTML/table/PDF/R Markdown + Shiny; MultiQC embedding | ✅ TRUE — PDF/R Markdown/Shiny are core features, not stretch goals |
| `/export` directory convention | ✅ TRUE (admin_quick.rst, pipeline.rst) |
| 10 GB memory | ✅ TRUE as `docker run -m 10G` in official docs (executor setting for the Nextflow job) |
| Java 8 or higher | ⚠️ OUTDATED — correct for the 2020 paper era; Nextflow v25.04+ requires Java 17+ |
| `docker run ummsbiocore/dolphinnext-studio:latest` works | ❌ FALSE — Docker Hub repo has zero published tags; docs use `-p 8080:80`; BASE_PATH/PUBWEB_URL live in `config/.sec` |
| `docker.volumes` config key | ❌ FALSE — use `docker.runOptions` |
| `resume = true` in nextflow.config | ❌ NOT DOCUMENTED — `-resume` is CLI-only (caching itself is on by default) |
| Spec §5 container image tags | ❌ 11 of 13 don't exist on Quay — verified replacements in PLAN.md §2.1 |
| Geneious "Native (v11.1+)" for SAM/BAM, GFF/BED, VCF | ❌ WRONG — native since Geneious 4.6–6.0 (2009–2012); 11.1 added mixed bulk import |
| Geneious reference #6 link | ❌ HTTP 404 — replaced (see §11) |
| Kraken2 database URL (§10.2) | ✅ exists (106.19 GiB) |
| §10.1 per-tool RAM figures | ❌ NOT in the tools' official docs (see §10.1 note; full k2_standard needs ~103 GiB RAM) |
| Paper title/journal/DOI (§11 #1) | ✅ exact match (BMC Genomics 21:310, 2020, CC BY) |

**Post-fact-check decision (owner, 2026-09-11):** platform = **Option B — GUI-agnostic Nextflow DSL2 + nf-core pipeline** (DolphinNext itself is dead, §4.2); testing UI = a thin Streamlit app; AC-01…AC-03 are formally replaced by web-interface equivalents (sign in / launch a run / monitor and inspect results from the web UI), per owner approval. Seqera or another UI may fulfill the same criteria at the company's choice. Details and sources: PLAN.md §5, §7.

*End of Specification*