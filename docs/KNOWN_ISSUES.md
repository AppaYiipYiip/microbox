# Known issues & bug log

Living tracker so nothing found during development gets lost across machines/sessions. Two sections: **Fixed** (why the code looks the way it does — don't "clean up" these without understanding why they're there) and **Open** (still needs doing, pick these up on any machine).

See `docs/TESTING.md` for the standing testing requirements/checklist to run after every change — researched against current backend/frontend/integration/UI-UX testing standards, 2026-09-12. See `CONTRIBUTING.md` for the concrete "how to add a tool / upgrade a dependency / add a UI feature" playbook, and `CHANGELOG.md` for a terse chronological summary of what's shipped.

Last updated: 2026-09-13 (**Composer canvas: the real-pipeline connection validation was removed entirely**
after real use showed it couldn't reliably tell a genuine mistake apart from a forward-looking design based
on an example diagram - "we allow the user to do whatever they want no need for warning." Auto-arrange
changed from left-to-right to top-to-bottom to match the reference diagram's shape. Test suite: 93 → 84
(a real removal). See "Composer canvas: the 'connections don't match the real pipeline' validation
REMOVED..." below.
**A real new Nextflow pipeline branch: Kraken2 now also classifies reads BEFORE
host depletion** (`--skip_kraken2_predepletion false`), a second, independent pass alongside the existing
post-depletion one — added after the owner supplied a real reference pipeline diagram from their R&D team
showing this as the primary classification path. Verified via 5 new `nf-test` cases plus all 24 pre-existing
ones, 0 regressions. Composer UI's connection-validation map updated to match. See "A genuine, real Nextflow
pipeline addition..." below.
**Composer canvas: connections silently failing "sometimes" root-caused and fixed** —
React Flow's default `connectionMode="strict"` was silently rejecting any drag that grabbed a handle of the
"wrong" role, with zero feedback; switching to `loose` mode alone just traded that for a different silent
failure (a malformed edge that couldn't render), so the real fix normalizes the connection's source/target
back to this app's fixed handle roles regardless of which end was grabbed. Test suite grew from 81 to 91. See
"Composer canvas: connections silently failed to draw..." below.
**Composer canvas: a real imported-edges-don't-render bug found and fixed** — building
a fuller integration test (a real multi-node chain, disabled node, param set, exported, re-imported) surfaced a
genuine React Flow gotcha: edges connecting brand-new nodes silently never render because the library can't yet
measure their real handle positions, and never self-corrects afterward either. Fixed via React Flow's own
`Node.handles` escape hatch (`defaultNodeHandles()` in `src/data/nodeDefaults.ts`), applied to both import and
palette-drop paths; verified live via a real file-based import round trip. Test suite grew from 78 to 81. See
"Composer canvas: imported edges silently failed to render..." below.
**Composer canvas corrected to the owner's exact spec** — 4 fixed-direction handles
(not 8), self-connection blocked, connections deletable via an "×" on click, real per-node parameter editing
grounded in actual `nextflow.config` values, all verified live in-browser; same-day follow-up fixed a real
connection-color bug (a same-specificity CSS collision with React Flow's own connection-drag state classes),
gave every node a consistent default size instead of growing with content, and made nodes resizable via
React Flow's `NodeResizer` — test suite grew from 18 to 25, see "Composer canvas corrected to 4
fixed-direction handles..." and "Node sizing/resize + a real connection-color bug..." below; a broader,
not-yet-scoped "many quality of life elements" request was logged as Open #8 rather than guessed at.
**Composer canvas connections now validated against the real pipeline's fixed backbone** — the owner's own
saved canvas export had connections the real pipeline structurally can't execute (e.g. QUAST → MaxBin2);
added a hardcoded topology map grounded in `workflows/microbox.nf`'s actual channel wiring, with invalid
edges shown dashed-amber plus a warning banner, non-blocking. Also confirmed the composer's param panel
already faithfully mirrors the only real per-tool params (`host_fasta`/`kraken2_db`/`genomad_db`/
`checkv_db` - all paths, verified against `nextflow.config` directly). See "Composer canvas: connections
validated against the real pipeline's fixed backbone..." below.
**Composer Auto-arrange added** (PLAN.md §6.16's last unbuilt canvas nice-to-have) — a hand-rolled, dependency-
free left-to-right layered layout (longest-path columns, graceful cycle fallback), verified live via each
node's actual CSS transform. Also double-checked Ctrl+Z/Ctrl+Y at the owner's request and confirmed no bug -
an earlier apparent failure traced entirely to this session's already-known flaky drag-and-drop in browser
automation, not the app. Test suite grew from 72 to 78. See "Composer canvas: Auto-arrange..." and
"Ctrl+Z/Ctrl+Y double-checked..." below.
**Kraken2 database-variant selector with a hardware-based recommendation added to the composer** — four real
variants grounded in PLAN.md §2.3's own research (checked against `bin/download-dbs.sh`'s actual case
statement for which are really downloadable today), a "Use this path" button per wired variant, and an
honestly-limited RAM-based recommendation (`navigator.deviceMemory` is Chromium-only and capped at 8 GB by
design, so it's a rough pre-fill for an editable field, never an authoritative reading) using a conservative
50%-of-RAM rule grounded in this project's own real OOM finding. Test suite grew from 64 to 72.
**Composer canvas: collapsible palette categories, Ctrl/Cmd+C/X/V, circular undo/redo icons, and a real
selection-highlight bug fixed** — the owner's UI feedback ("the circular ones that mean back and forth
cycle" for undo/redo; "i assume ctrl+c or x or z or r are working") led to building copy/cut/paste (which
didn't exist yet) and, while testing paste, catching a real bug where the canvas kept highlighting the OLD
node after Duplicate/Paste/Undo/Redo/Escape even though the detail panel correctly showed the new one - fixed
with a shared selection-sync helper used everywhere the selection changes outside of a genuine click. Test
suite grew from 62 to 64. See "Composer canvas: collapsible palette categories, more keyboard shortcuts,
circular undo/redo icons, and a real selection-highlight bug fixed..." below.
**Composer node palette search/filter added** (PLAN.md §6.16's nice-to-have, now that the catalog spans 13
tools/7 categories) — matches the current UI language's translated text, hides empty categories, unit-tested
plus verified live in both languages. Also noted a real automation constraint: browser download-confirmation
prompts block while the owner is AFK, worked around by intercepting `URL.createObjectURL` for testing rather
than clicking through to a real download. Test suite grew from 56 to 62. See "Composer node palette:
search/filter..." and "Owner feedback: browser download-confirmation prompts..." below.
**Composer canvas: node state visibility + a real Save/Import round trip** — worked from PLAN.md §6.11's own
still-open Must-haves (enabled/skipped and default-vs-overridden param visibility on the canvas; a portable,
faithful pipeline-configuration file). Found and fixed a real Save fidelity bug along the way (width/height
and edge handle info were silently dropped, which would have broken any re-import). Also logged Open #9: the
composer's hardcoded connection rules have no automated cross-check against the real pipeline's actual
wiring, a gap PLAN.md §6.10 explicitly flagged as still needed once the UI existed to test against. Test
suite grew from 38 to 56. See "Composer canvas: node state visibility + Save/Import fidelity..." below.
**Pavian added to the composer canvas's node palette** — the owner noticed it was missing from the composer
even though it already existed as a standalone tool in the main pipeline; added to the "reporting" category
alongside MultiQC, with an honest note that it's not a DAG step. See "Pavian added to the composer canvas's
node palette..." below.
**Composer UI quality-of-life pass** — asked the owner to prioritize an open-ended "many quality of life
elements" request; built and verified the three picked: undo/redo (visible toolbar buttons + Ctrl/Cmd+Z/Y),
multi-select with bulk move/delete, and Delete key + a duplicate-node button — a real testing-tool gotcha
was found and worked around along the way (simulated "Ctrl+click" doesn't trigger React Flow's own
window-level modifier-key tracking). Test suite grew from 25 to 31; see "Composer UI QoL pass..." below.
`nf-core pipelines lint` crash root-caused and fixed — a real `manifest.name` bug in `nextflow.config` — the remaining lint failure past that point is a deliberate, documented scope decision, not a bug: this project reuses nf-core modules but was never scaffolded from the full nf-core pipeline template, so template-only checks like `nextflow_schema.json` don't apply. See "`nf-core pipelines lint` crashed outright..." below. **First container-vulnerability scan run against all 11 pinned images** — Docker Scout required a login so `trivy` was installed instead; found 3 real CRITICAL CVEs (`bracken`/`checkv`/`quast`, all the same root cause — a bundled NCBI EDirect Go binary with an outdated stdlib, not reachable by anything this pipeline's tasks actually execute) plus routine HIGH-severity base-OS package CVEs elsewhere; `fastp`/`genomad`/`fastqc` fully clean. See "First container-vulnerability scan..." below. **First SBOM/license inventory generated** (`syft`, verified `.deb` release) — full results now in the new `docs/SBOM.md`; no AGPL found, GPL/LGPL findings are all base-OS packages with no current distribution/disclosure obligation for this project. See "First SBOM/license inventory..." below. **First CI wiring added** (`.github/workflows/ci.yml`) — nf-test `basic` suite, UI ruff+pytest, shellcheck, every command grounded in what's already verified working locally; not yet observed on a real GitHub Actions run since nothing's been pushed this session, see "First CI wiring..." below. **MaxBin2 added as an optional genome-binning stage** (PLAN.md Phase 4b) — a local module (paired `-reads`/`-reads2`, the stock nf-core module only supports one), a stale container-tag research note caught and fixed, a real viral-vs-bacterial toy-fixture incompatibility found and fixed with a new fixture, and real measured resource usage far below the advertised label — see "MaxBin2 added..." below. **Pavian added** (`docker-compose.yml` + `bin/run-pavian.sh`) — a standalone read-only report viewer, verified actually responding over HTTP (not just "container starts") before being documented as done — see "Pavian added..." below. This completes every tool in PLAN.md §9's original catalogue. **Full re-verification audit of six past fixes** — found and fixed one real regression (Fixed #20's deleted `containers_*.config` clutter had silently regenerated and gotten re-committed; now `.gitignore`d so it can't recur); confirmed Fixed #9's PATH-quoting bug is now structurally impossible (project relocated to a space-free path); reconfirmed Open #7's `_closure6` cosmetic error, Fixed #10's CLI-boolean gotcha, and Fixed #2/#4's file locks are all still exactly as documented — see "Full re-verification audit..." below. **A real composer UI prototype built and verified** (`composer-ui/`, a separate React app — React Flow + React Router v8 + react-i18next) — categorized draggable node palette with this pipeline's real tools, a working canvas, multi-page nav, live French/English switching, all confirmed via real browser testing plus a 13-test Vitest suite; deliberately not yet connected to actually running the pipeline — see "Composer UI prototype built and verified..." below. **Layout corrected same day after the owner actually tested it** — page nav moved to the left, tool palette moved to the right (matching the original request, which the first pass had backwards), a real zoom-control legibility bug fixed (`colorMode="dark"`), visible Save (genuinely functional, downloads a JSON canvas snapshot) and Run (visibly disabled with an honest tooltip, no backend yet) buttons added, and a new Home page — test suite grew to 17, re-verified live in-browser again — see "Composer UI layout corrected..." below. **Nodes now connect from any side** (top/right/bottom/left, not just left-to-right) — 8 handles per node (a source + target pair on each side, verified against React Flow's own multi-handle docs), a real vertical connection drawn and confirmed in the DOM, test suite grew to 18 — see "Composer canvas: connect nodes from any side..." below. **`bin/inspect.sh` added** — deep-dive any task's exact inputs/outputs/lineage in any run, plus a `--bundle` mode for handing a run to someone else to diagnose; covers the case `bin/debug.sh` can't (a run that succeeds but produces an unexpected result) — see "`bin/inspect.sh` added..." below. **Seqera Platform ruled out entirely; AWS production deployment shape decided** (owner: normal Windows EC2 VM running the same stack already built locally, no Seqera in any form) — resolves PLAN.md §7's long-open "decision gate at handover," see "Seqera Platform ruled out entirely..." below. Earlier, 2026-09-12 (Fixed #16 — fastp/FastQC/MEGAHIT made independently skippable + tool-version tracking + DAG generation, after the owner's combinatorics/reporting pushback; Open #7 — a cosmetic Nextflow `_closure6` error on every guarded failure; resolved Open #4 and added Fixed #17/#18 — the Streamlit UI's Run button was click-tested end to end for the first time and genuinely could not run the pipeline at all until two real bugs were found and fixed; Fixed #19 — `bin/setup-dev.sh` wasn't actually safe to re-run; resolved Open #2 and added Fixed #20 — `modules.json` finally generated, plus `nf-test` added to setup-dev.sh and a repo-internal dev venv that was confusing nf-test's own test discovery cleaned up. Every item in the Open section has now been either resolved, explicitly re-confirmed as out of our control, or dug into deeply enough to record a real root-cause hypothesis rather than "cosmetic, moving on."; **real-data testing completed against genuine ZymoBIOMICS Mock Community reads (ENA ERR2984773), CLI and UI both** — eight combinations tested end to end (defaults, host-depletion, contigs entry, skip_megahit auto-skip, skip_fastp on raw reads, full Kraken2+Bracken taxonomic truth-validation on both entry points using a real 8GB `standard_08_GB` DB now added to `bin/download-dbs.sh`, and a full Streamlit UI run), all 8 known mock-community bacteria correctly classified (~98.5% combined Bracken abundance); also surfaced and documented a real concurrency-driven memory-budget limit on the 11GB dev VM (one OOM kill, worked around by serializing heavy jobs), and **Fixed #21** — the UI's real-data run exposed a genuine bug where a completed run's report became invisible after any page reload — see "Real-data validation" under Decisions below; **new features added** — metaSPAdes wired as an alternative assembler (`params.assembler`), the smallest already-anticipated toolbox gap per PLAN.md §6.10, fully tested (12/12 nf-test); and **geNomad + CheckV** wired as viral/plasmid discovery + quality assessment (PLAN.md §9/Phase 4a), real DBs downloaded, correctly identifying and taxonomically classifying real viral sequence (Coronaviridae) in the toy fixture — see "metaSPAdes added..." and "geNomad + CheckV added..." under Decisions; **resilience/quality-of-life pass** (owner: "what if they lose internet, what if they go home and comeback the next day") — a real WSL2 VM-lifecycle finding (closing the terminal kills everything within seconds, no Linux-level trick survives it - see "WSL2 VM lifecycle..." below), plus three tested UI additions: live-run reattachment via a PID file, a working Cancel button (process-group SIGTERM), and a disk-space preflight warning, alongside a genuine pre-existing `bin/run-ui.sh` bug found and fixed along the way (bare `streamlit` not on `PATH`) — see "Three... UI quality-of-life additions..." below. Additional quality-of-life requirements for the future node-based composer (per-node RAM/runtime warnings and more) recorded in `docs/planning/PLAN.md`'s new §6.15.).

---

## Open — needs doing

1. ~~Git push blocked~~ **Resolved as "working as intended" (owner, 2026-09-11): this is a shared laptop, and the owner explicitly does NOT want credentials cached.** `~/.gitconfig`'s `credential.helper=` (empty) disables Git Credential Manager caching — that's not a bug to fix, it's exactly the right setting for a shared machine. Push/pull by running `git push`/`git pull` (must be run by a human, not Claude — interactive sign-in and global git config changes are both off-limits by policy) — git will prompt fresh each time for a GitHub username + a Personal Access Token (not the real password; GitHub Settings → Developer settings → Personal access tokens), and nothing gets stored. Repeat the prompt every push/pull, by design.
2. ~~`modules.json` doesn't exist~~ **Resolved 2026-09-11 (owner: "work through all the bugs in known issues... do not cut any corners").** Retried from inside WSL2 exactly as this entry's own "next step" suggested - the Windows-path bug didn't apply there, confirming the original diagnosis. Real friction along the way, not a clean one-liner: (a) `nf-core modules install` needs a real terminal (`questionary`-based prompts don't respond to piped stdin; a real pty via `script -qc '...' /dev/null` was needed), (b) it needs `repository_type: pipeline` declared in a new `.nf-core.yml` (this repo never had one, since it wasn't scaffolded via `nf-core pipelines create`), (c) it shells out to `nextflow config` internally, so it hit the *exact* "java not on PATH in a non-interactive shell" issue from Fixed #17/#18 - fixed the same way, source SDKMAN first. `modules.json` now exists and correctly reconciled all 9 already-installed nf-core modules with their real upstream git SHAs (not just the one module explicitly requested) - `nf-core lint`/`nf-core modules update` can now recognize them. Verified the reinstall changed nothing: `git diff` on `modules/nf-core/fastp/` after a `--force` reinstall was empty, confirming the hand-fetched copy already matched upstream exactly. Real side effects this surfaced, fixed in the same pass (see Fixed #20 below): the `nf-core` tools venv had been created *inside* the repo, where nf-test's test-discovery doesn't respect `testsDir` and picked up the venv's own bundled example tests as if they belonged to this pipeline.
3. **Only `test` and `docker` Nextflow profiles exist.** `bin/run.sh --profile dev` (or `test_aws`/`prod`) will currently fail — those profile blocks plus `conf/dev.config`/`conf/test_aws.config`/`conf/prod.config` don't exist yet. This is expected (planned for later milestones per `docs/planning/PLAN.md` §2.3/§6.3, not an M1 requirement) — noted here so it isn't mistaken for a new bug.
4. ~~Streamlit UI's Run button was only smoke-tested, not click-tested~~ **Resolved 2026-09-11 (owner: "streamlit it is").** Actually click-tested end to end via real browser automation (upload → select environment → Run → watch status → embedded MultiQC report), not just confirming the process responds on port 8501. It could not run the pipeline at all on the first attempt - see Fixed #18/#19 below for the two real bugs this surfaced and fixed. After both fixes, the full flow works: report embeds live in the page, including the new Software Versions table (Fixed #16) rendering correctly inside it.
5. **Docker Desktop WSL Integration is per-machine, manual, GUI-only.** `bin/setup-dev.sh` automates everything scriptable, but on each new laptop someone still has to open Docker Desktop → Settings → Resources → WSL Integration → enable it for the distro. No way around this — it's not exposed via CLI.
6. **Two files are locked immutable (`chattr +i`)** on this machine's WSL2 distro: `/etc/resolv.conf` and `~/.docker/config.json` (see Fixed #2 and #4). If either genuinely needs to change later (different DNS server, a real Docker Hub login), remember to `sudo chattr -i <file>` first or the edit will silently fail.
7. **Cosmetic `_closure6` error on every guarded pipeline failure.** Whenever the pipeline aborts - either via the explicit `error "..."` guard in `workflows/microbox.nf`, or from a genuine task failure (reproduced 2026-09-11 with a real Kraken2 failure, not just the guard case) - the console also prints `ERROR ~ Invalid method invocation 'doCall' with arguments: ... on _closure6 type`, traced (via `.nextflow.log`) to Nextflow's own internal `nextflow.Session.notifyError` → `WorkflowMetadata.invokeOnError` machinery, not to any code in this repo. Confirmed present before the 2026-09-11 combinatorics work too, so it isn't something this project's own changes introduced. **Root cause hypothesis, researched 2026-09-11 (not just "cosmetic, move on" - actually dug into it):** the real Kraken2-failure reproduction showed the internal call being made *with* a `nextflow.trace.TraceRecord` argument, which only makes sense if Nextflow's internal `notifyError` plumbing still expects the **legacy** `workflow.onError { record -> ... }` one-argument closure signature - but this pipeline (correctly, per Fixed #5's own reasoning) uses the **new strict-syntax** `onError:` labeled section instead, which the Nextflow compiler turns into a niladic closure. That mismatch between old internal caller and new closure shape is consistent with every observed symptom: it fires regardless of *why* the run failed, it never affects `workflow.errorMessage`/the run-report (those are populated through a different code path), and it matches the same "onError handling still has rough edges after the 24.10 strict-syntax migration" family as the already-documented `nextflow-io/nextflow#5445`/`#5261`. **Deliberately not worked around**: the only alternative is reverting to the legacy `workflow.onError { }` closure style, which has its *own* documented bug (Fixed #5: `params`/`workflow` resolve `null` inside it when defined in the entry workflow) - trading a cosmetic extra error line for a broken run-report would be a strictly worse trade, not a fix. Only worth reopening if it ever starts masking a *different* error message or affecting exit-code correctness - same standard already applied to Fixed #9's cosmetic PATH-export issue.
8. ~~Composer UI: "many quality of life elements" requested but not yet scoped~~ **Resolved 2026-09-13**:
   asked the owner to prioritize from a candidate list; they picked undo/redo, multi-select + bulk move/
   delete, and Delete key + duplicate-node — all three built and verified same day (see "Composer UI QoL
   pass..." below). Snap-to-grid and a minimap were raised but not picked; reopen as a new item if the owner
   wants them later.
9. **No test cross-checks the composer's hardcoded connection rules (`composer-ui/src/data/
   pipelineTopology.ts`) against what `workflows/microbox.nf` actually does.** PLAN.md §6.10 decided to
   hardcode the compatibility rules independently in the UI and the pipeline rather than share a schema
   (simpler to build, avoids a cross-stack Groovy/JS metadata format for a bounded ~20-node toolbox), but
   flagged explicitly that this leaves a structural drift risk: if `workflows/microbox.nf`'s real wiring ever
   changes, `pipelineTopology.ts` could silently go stale, and nothing today would catch the UI showing a
   connection as fine when the pipeline would actually reject it (or vice versa). §6.10's own words: "that
   cross-checking test is the one piece this decision still requires... not built yet, noted here so it
   isn't forgotten once the UI exists to test against." The UI now exists (2026-09-13). Deliberately not
   attempted this round - a real automated cross-check would need something that can inspect
   `workflows/microbox.nf`'s actual channel wiring (a Nextflow DSL2 parser, or at minimum carefully-targeted
   assertions against specific known lines), which is a genuinely hard, easily-fragile problem on its own,
   not a small addition; forcing a shallow version in now risked either false confidence (a brittle grep-
   based check that looks like coverage but isn't) or a rabbit hole disproportionate to this round's other
   work. `pipelineTopology.ts` itself already cites the specific `workflows/microbox.nf` behavior each entry
   is grounded in (a manual cross-check performed once, at write time) - the gap is that nothing re-verifies
   this automatically if the pipeline changes later.

---

## Fixed — why the code is the way it is

1. **`nf-core pipelines create` / `nf-core modules install` crash on native Windows Python.** `TemplateNotFound: create\template_features.yml` — a Windows-path-separator bug in nf-core-tools' own jinja2 template loader (backslash where it expects a forward slash), confirmed via the traceback, not nf-core-tools being unavailable. **Workaround chosen:** hand-fetched the real, current module files (`main.nf`/`meta.yml`/`environment.yml`) directly from `github.com/nf-core/modules` (master branch) instead of generating them, and hand-wrote `main.nf`/`workflows/microbox.nf`/`conf/*.config`. Works, but means `modules.json` is missing (Open #2).

2. **WSL2 `apt-get update` hangs indefinitely on a fresh distro.** Root cause: corporate/VPN DNS servers (this network's DNS suffix, `mci-santeanimale.com`, was the tell) stall badly on PTR lookups, and apt does one at the start of every update — a known class of WSL2 issue, not specific to this repo. **Fix:** `/etc/wsl.conf` sets `generateResolvConf = false`; `/etc/resolv.conf` hardcoded to `8.8.8.8`/`1.1.1.1` and made immutable so WSL doesn't regenerate it back to the corporate DNS. Baked into `bin/setup-dev.sh` step 1.

3. **WSL2 IPv6 resolves but doesn't route** (`Network is unreachable` on every AAAA-first connection attempt), making apt/curl slow even after the DNS fix, since it tries IPv6 before falling back to IPv4 for every mirror. **Fix:** `Acquire::ForceIPv4 "true";` in `/etc/apt/apt.conf.d/99force-ipv4`. Baked into `bin/setup-dev.sh` step 2.

4. **Docker Desktop's WSL integration writes a Windows-only credential helper into the Linux side.** `~/.docker/config.json` had `"credsStore": "desktop.exe"` — a `.exe` can't execute from Linux, so every `docker run`/`docker pull` failed with `exec format error`, even though public images need no credentials at all. **Fix:** cleared to `{}` and locked with `chattr +i` (Docker Desktop rewrote it once already, hence the lock). Baked into `bin/setup-dev.sh` step 5.

5. **Nextflow's strict config/script syntax (default since 26.04) rejects several patterns that are still common in older nf-core pipelines and in my own first drafts:**
   - A plain Groovy function (`def check_max(obj, type) { ... }`) defined directly inside a `.config` file — no longer parses. **Fix:** replaced with Nextflow's native `resourceLimits` directive (the documented current replacement, see `nextflow-io/tools#2923`).
   - `def someVariable = ...` as a bare statement in a `.config` file — also doesn't parse. **Fix:** removed the shared timestamp variable that would have unified trace/report/timeline filenames; they use fixed, overwritten filenames instead (`conf/base.config` doesn't need one; `nextflow.config`'s trace/report/timeline blocks each just use a static path).
   - `workflow.onComplete { ... }` / `workflow.onError { ... }` as bare top-level statements in `main.nf`, outside any `workflow {}` block — doesn't parse ("Statements cannot be mixed with script declarations"). **Fix:** moved inside the entry `workflow { }` block.
   - Even inside the entry workflow, the `workflow.onComplete { }` *closure* style has a known Nextflow bug where `params` and `workflow` resolve to `null` inside the closure (`nextflow-io/nextflow#5445`, `#5261`). **Fix:** switched to the newer labeled-section syntax (`main:` / `onComplete:` / `onError:` inside the `workflow {}` block), which is also what the strict parser expects going forward.

6. **`resourceLimits` silently not clamping anything.** Declared in `conf/base.config` referencing `params.max_memory`, but `base.config` is `includeConfig`'d before profile-specific param overrides are applied — so it was reading the general default (128GB) instead of `conf/test.config`'s 6GB, meaning nothing was ever actually being clamped down on the test profile. **Fix:** declared `resourceLimits` directly inside `conf/test.config` instead of routing it through `base.config`'s params-based indirection.

7. **No `publishDir` was wired up anywhere.** A fully successful run would have left every output sitting in Nextflow's hashed `work/` directory, never reaching `results/` — silent, not an error, so easy to miss. **Fix:** added `conf/modules.config` with explicit `publishDir` for FASTP/FASTQC/MULTIQC.

8. **Non-interactive `sudo` gotchas while scripting the WSL2 setup** (not a pipeline bug, but cost real time): piping the wrong content into `sudo -S` (once fed it a config file's contents instead of the password, since two things were chained through the same pipe); git-bash's MSYS path conversion silently mangling `/mnt/c/...` WSL-internal paths into broken Windows paths when passed as arguments to `wsl.exe`. **Fixes:** always pipe the password directly and only the password into `sudo -S`; run `MSYS_NO_PATHCONV=1` before any `wsl.exe` call that takes a Unix-style path argument; prefer writing multi-step setup logic to an actual `.sh` file and executing that, rather than long inline multi-line strings.

9. **MEGAHIT crashed with `OSError: [Errno 95] Operation not supported` calling `os.mkfifo()`.** The Windows-mounted filesystem WSL2 exposes at `/mnt/c/...` doesn't support Unix named pipes, which MEGAHIT uses internally — a correctness issue, not just the performance one `docs/planning/PLAN.md` §2.3 originally flagged for this same "keep workDir off `/mnt/c`" rule. **Fix:** `nextflow.config` now sets `workDir = "${System.getProperty('user.home')}/nf-work"` (portable — no hardcoded username).
   **Correction (Bracken milestone, still 2026-09-11):** the entry above originally claimed a second symptom — a broken `export PATH=...` in the generated task script — "disappeared" once `workDir` moved off `/mnt/c`. That was wrong; it just wasn't visible in a truncated log check. It reappeared on the very next milestone. Root cause confirmed via search: a known, longstanding Nextflow bug (`nextflow-io/nextflow#1549`) — Nextflow always auto-adds the pipeline's own `bin/` directory to `PATH` for every task, and the generated `export` statement doesn't quote paths containing spaces. Since this repo lives under `.../project marouane/GUI Pipeline` (two space-containing directory names), it hits this every single task, regardless of `workDir`. **Not fixed, and not worth fixing**: it's cosmetic — the script continues past the one failed `export` line and the actual tool still runs correctly (confirmed: Bracken's real output was produced right after the error text in the same log). Only a real fix if it starts actually breaking something, e.g. a tool that genuinely depends on the pipeline's `bin/` dir being on `PATH`.

10. **Boolean CLI params silently don't work** (`--skip_kraken2 false` had no effect — the pipeline ran as if it was still `true`). Confirmed as a known Nextflow 26.04+ regression, not a mistake in our config: under the strict syntax parser (default since 26.04), every CLI-supplied param arrives as a plain string, and `!params.skip_kraken2` on the string `"false"` evaluates `false` (non-empty strings are truthy in Groovy) — so the `if` branch that should have run never does. **Fix:** always use `-params-file some.yaml` (which preserves real YAML types) for anything boolean, never bare `--flag true|false` on the command line. `bin/run.sh` already only ever uses `-params-file`, so this doesn't affect normal use — it only bit ad-hoc CLI testing while developing this milestone.

11. **Bracken failed with `Error: no reads found` against the test fixture.** Not a bug — Bracken's default minimum-read threshold (`-t 10` at species level) is a sensible real-data default, but our mechanics-only test fixture has exactly 2 classified reads total, so no threshold above 2 can ever pass regardless of taxonomic level chosen. **Fix, scoped to avoid masking the real default:** `conf/test.config` sets `ext.args = '-t 1'` for `BRACKEN_BRACKEN` only inside the `test` profile — production/real runs keep Bracken's actual default. Proves the wiring works; says nothing about real-world accuracy (same mechanics-vs-truth-validation distinction `docs/planning/PLAN.md` §2.3 already draws elsewhere).

12. **QUAST failed with "doesn't contain contigs >= 500 bp" — and lowering the threshold didn't fix it either.** Real root cause, not a threshold issue: `conf/test.config`'s `host_fasta` originally pointed at the *same* SARS-CoV-2 genome family the test reads are drawn from, so Bowtie2 depleted ~98% of reads as "host" (2 of 99 survived) — too little data for MEGAHIT to assemble anything (0 contigs), which cascaded into QUAST having nothing to measure at any threshold. **Fix:** `host_fasta` now points at lambda phage (NC_001416.1, NCBI) — a small, standard, genuinely *unrelated* reference. Result: 0% alignment (correct — proves non-host reads pass through unchanged), full 99 reads reach assembly, MEGAHIT produces 12 real contigs. **Lesson for future fixtures:** a host-depletion test needs a reference that *doesn't* match the read data, or it silently breaks every stage downstream of depletion in a way that looks like each stage's own bug.

13. **QUAST's data was silently absent from every MultiQC report, including milestones already called "verified."** Only became visible once `tests/main.nf.test` (the nf-test suite) ran a contigs-only case where QUAST was MultiQC's *only* possible input — with nothing else to mask the gap, MultiQC failed outright ("No analysis results found"). Root cause: `workflows/microbox.nf` was feeding MultiQC `QUAST.out.tsv` — a *renamed convenience symlink* (`${prefix}.tsv`, e.g. `test.tsv`) — but MultiQC's QUAST module only recognizes a file literally named `report.tsv`, which only exists inside `QUAST.out.results` (the full output directory). **Fix:** feed MultiQC `QUAST.out.results` instead. **Why this matters beyond QUAST specifically:** "the file exists in `results/`" and "the file actually reached the aggregated report" are not the same claim, and manual spot-checks (opening `multiqc_report.html`, eyeballing it) had missed this every time — this is exactly the class of bug the nf-test suite exists to catch, and did.

14. **Bracken crashes (a Python traceback, not a graceful error) when fed a contigs-derived Kraken2 report.** Bracken's `*.kmer_distrib` files assume ~100bp-read-scale input; treating a whole assembled contig (tens of kb) as one "read" breaks its abundance-redistribution math outright, not just makes it less accurate. Found via the `input_type=contigs` + Kraken2-enabled test case. **Fix:** `workflows/microbox.nf` now force-skips Bracken for `input_type=contigs` regardless of `params.skip_bracken`'s value — same pattern as `skip_host_removal` not applying to contigs input: an inapplicable combination is made to not-happen automatically, not left for a caller to discover by hitting a crash. **Broader point, now written into PLAN.md §6.10:** file-format compatibility isn't the same as semantic compatibility — a reads-derived and a contigs-derived Kraken2 report are byte-for-byte the same file format, so a naive "do the port types match" check would have let this through anyway.

15. **Kraken2 silently produced empty reports when classifying an uncompressed `input_type=contigs` FASTA** — found 2026-09-11 during a full toolbox combinatorics sweep (owner: "if someone makes a pipeline that has one node, for example Kraken2 only, it should work" — that exact case was the one that broke). `KRAKEN2_KRAKEN2` (the vendored nf-core module, `modules/nf-core/kraken2/kraken2/main.nf`) unconditionally passes `--gzip-compressed` to kraken2 — correct for every reads channel in this pipeline (fastp and Bowtie2 both always emit `.fastq.gz`), so the bug never showed up on the `fastq` entry point. But `input_type=contigs` feeds Kraken2 whatever file the samplesheet points at, and the test fixture (`assets/samplesheet_test_contigs.csv` → a plain `genome.fasta`) is **not** gzip-compressed. Under `--gzip-compressed`, kraken2 tries to gunzip a non-gzip file; that fails silently (`gzip: genome.fasta: not in gzip format`) without kraken2 itself erroring — it just reports "0 sequences processed" and writes a technically-valid, completely empty `test.kraken2.report.txt`. Exit code 0 throughout — nothing about the run *looked* wrong. **Why it went undetected until now:** the one pre-existing test that exercised contigs+Kraken2 together also ran QUAST, so `workflow.success` stayed true and MultiQC had QUAST's data to display — nothing ever asserted the Kraken2 report actually had content, only that the file existed on disk. Same "file exists ≠ data reached the pipeline" gap as #13, just for a different tool; only surfaced once a new test isolated Kraken2 as the *sole* enabled stage (skip_quast=true), at which point MultiQC itself failed outright with "No analysis results found." **Fix:** a new local module `modules/local/gzip_contigs/main.nf` (`GZIP_CONTIGS`, reusing this repo's already-pinned bowtie2/pigz image rather than adding a new container tag) — `workflows/microbox.nf`'s Kraken2 branch now checks each contigs file's extension via `.branch{}`: already-`.gz` files (e.g. MEGAHIT's own `*.contigs.fa.gz`) pass straight through untouched, anything else gets piped through `pigz` first. Both the original contigs+Kraken2 test and the new single-node test in `tests/main.nf.test` now assert the report file has non-zero content (`.text.trim().length() > 0`), not just that it exists — closing the same class of gap #13 already closed for QUAST, now for Kraken2 too. Verified fixed: both tests pass post-fix with real (non-empty) classification data.

16. **fastp/FastQC/MEGAHIT had no `skip_*` flag and MEGAHIT's output never reached MultiQC** — found 2026-09-11 from direct owner pushback ("with 6 unique tools I'd expect more than 16 tests," "if each of these nodes are the last step we should be able to write a report, no matter what was the last node"), both confirmed real by re-reading the code, not assumptions. Only `skip_host_removal`/`skip_kraken2`/`skip_bracken`/`skip_quast` existed; fastp, FastQC, and MEGAHIT always ran unconditionally on the `fastq` entry point, contradicting `docs/planning/PLAN.md` §6.7's own "any element optional" principle and undercounting the real combinatorial space (72 fastq-entry configs once genuinely independent, not 12 — see PLAN.md §6.13). Separately: MultiQC ships a native MEGAHIT module (content-sniffs any file for `" - MEGAHIT v"`, no special filename needed — verified against live docs, not assumed) but nothing ever fed it MEGAHIT's log, so a run where MEGAHIT was the last meaningful stage (`skip_quast=true`) produced no MultiQC content for the assembly at all. **Fix:** added `skip_fastp`/`skip_fastqc`/`skip_megahit` (the last one auto-force-skips QUAST via a `log.warn`, same "inapplicable combination made to not-happen automatically" pattern as #14); mixed `MEGAHIT.out.log` into the MultiQC file channel. Also added, researched against Galaxy/nf-core/Snakemake norms the same session (see PLAN.md §6.13 for full citations): tool-version collection from the `versions` topic channel every module already emits to but nothing consumed (→ `pipeline_info/software_versions.yml` + a MultiQC custom-content table), and default-on DAG generation (`pipeline_info/pipeline_dag.html`). Full rationale, sources, and the "keyed by process+tool, not either alone" YAML gotcha (found and fixed twice while smoke-testing): PLAN.md §6.13.

17. **The Streamlit UI's Run button could not run the pipeline at all** — found 2026-09-11 the first time it was actually click-tested through a real browser (owner: "streamlit it is"), not just confirmed to respond on port 8501 (the previous, much weaker "smoke test," Open #4). Clicking Run failed immediately with `/usr/local/bin/nextflow: line 328: java: command not found`. Root cause: `ui/app.py` launches `bin/run.sh` via Python's `subprocess.Popen(["bash", str(RUN_SCRIPT), ...])` — a **non-login, non-interactive** shell, which never reads `~/.bashrc`. Java is only reachable via the SDKMAN shim `~/.bashrc` sources on every *interactive* shell (`bin/setup-dev.sh` step 3); `nextflow` itself resolved fine (it's a real file in `/usr/local/bin`), but nextflow's own launcher then couldn't find `java` to actually run on. A human always hit this working by coincidence — every real terminal is interactive, so `~/.bashrc` always ran first. `bin/run.sh` itself never guaranteed its own environment; it just assumed whatever invoked it already had. **Fix:** `bin/run.sh` now sources `~/.sdkman/bin/sdkman-init.sh` itself if present, making it self-sufficient regardless of caller (a no-op if SDKMAN isn't installed or java is reachable some other way).

18. **`bin/run.sh`'s new SDKMAN sourcing (#17) immediately hit the same SDKMAN `set -u` incompatibility already worked around earlier this session installing Java manually** — `sdkman-init.sh` (as installed 2026-09-11) references `SDKMAN_CANDIDATES_API` without ever setting a default, which is fatal under `set -u`/`nounset` (`bin/run.sh` has had `set -euo pipefail` since it was first written). Same underlying SDKMAN bug, different call site - worth its own entry since it bit the exact line #17 added. **Fix:** bracket the source with `set +u` / `set -u` rather than disabling `nounset` for the whole script - SDKMAN is third-party and out of our control, but everything else in this script should stay strict. **Same fix applied to `bin/setup-dev.sh` too, for consistency**: its two `sdkman-init.sh` sources (Java install step) were the *original* place this exact crash was first hit, earlier the same session - worked around by hand at the time (ad hoc `set +u` in a one-off shell), never fixed in the script itself until this second occurrence made the pattern obvious enough to go back and close properly. `bin/setup-dev.sh` claims "safe to re-run" (its own header comment); before this fix, a genuinely fresh run would have hit the crash every time. **Verified end to end after both fixes**: uploaded a real samplesheet through the browser, selected the (now-defaulted, see Fixed #16's sibling UX fix below) `test` environment, clicked Run, watched it go from "Running..." to "Completed," and the MultiQC report - including the new Software Versions table from #16 - rendered live inside the page.

**Sibling UX fix, same session, not a bug but recorded alongside #17/#18 since it was found by the same click-test:** the Environment dropdown defaulted to `"dev"` (`index=0`), a profile with no Nextflow config block at all (Open #3) - meaning the *very first thing* a new user would hit, before ever reaching the real bugs above, was an opaque failure from picking the pre-selected default. `ui/app.py` now lists (and defaults to) `"test"` first - the only environment that works with zero setup today; `dev`/`test_aws`/`prod` stay in the list so the gap stays visible, just never the trap a new user lands on by default.

19. **`bin/setup-dev.sh` was not actually "safe to re-run" the way its own header comment claims** — found 2026-09-11 deliberately re-running it end to end to verify the #18 fix, not incidentally. Step 1 unconditionally runs `sudo rm -f /etc/resolv.conf`, then locks the file immutable (`chattr +i`, Fixed #2). On any run *after* the first, that `rm -f` hits an already-immutable file and fails with "Operation not permitted" - `-f` only silences "file doesn't exist," not a permission/immutability error - which aborted the entire script under `set -euo pipefail` before it ever reached the Java/Nextflow steps this session was actually trying to verify. Every other step in the script correctly checks "is this already done?" first (the `wsl.conf` grep right above it, the `~/.sdkman` directory check, the `command -v nextflow` check, the `.venv-ui` directory check) - step 1 was the one place that pattern wasn't followed. **Fix:** only unlock/rewrite/relock `/etc/resolv.conf` when its content doesn't already match the target nameservers, matching the idempotency pattern every other step already used.

20. **`nf-test` was never actually added to `bin/setup-dev.sh`, and a dev-tool venv created inside the repo made nf-test's own test-discovery pick up unrelated tests** — both found 2026-09-11 finally fixing Open #2 (`modules.json`), which required installing the separate `nf-core` tools CLI for the first time this session. (a) `nf-test` has been this project's entire automated test suite since early development (`tests/main.nf.test`, 22+ cases by this point) and was extensively used all session, yet had only ever been installed by hand - never added to the one script meant to make a fresh machine fully ready. **Fix:** added as step 7/7 in `bin/setup-dev.sh`, installed and pinned the same way as Nextflow (a specific version, moved to `/usr/local/bin`, not left as a stray binary in the repo root the way the ad hoc install this session had left it - that stray binary is now `.gitignore`d too as a fallback). (b) Installing the `nf-core` CLI into a venv *inside* the repo (`.venv-nfcore`) caused `nf-test` to emit a warning about a missing dependency for a test file living inside that venv's own bundled copy of the nf-core pipeline template - nf-test's file discovery does not respect `nf-test.config`'s `testsDir` setting the way that setting's own name implies; it finds every `*.nf.test` file under the project root regardless. **Fix:** moved the venv outside the repo entirely (`~/nf-core-venv`, not `~/microbox/.venv-nfcore` - simply moving a venv doesn't work in Python since it embeds absolute paths, so this meant recreating it fresh, not `mv`-ing it) and added `.venv-nfcore/` to `.gitignore` as a guard against this happening again. Separately, `nf-core modules install` also auto-generated 8 unreferenced `conf/containers_*.config` files (its newer multi-arch/multi-engine container-selection convention) that duplicate what every module here already does internally via its own per-engine conditional `container` line (`workflow.containerEngine in [...] ? ... : ...`) - confirmed unreferenced anywhere (`grep` across every `.config` file) before deleting them, rather than leaving inert generated clutter that could confuse a future reader into thinking they're active. Also found and fixed in the same pass: `.streamlit_run.log` and `assets/uploads/` (both Streamlit UI runtime artifacts, not source) were missing from `.gitignore` since the UI was built - never surfaced until a `git status` was actually inspected carefully after a real UI run.

21. **The Streamlit UI's run status was invisible after any page reload or new session, even for a run that had already finished successfully** — found 2026-09-12 running a real ZymoBIOMICS combination through the browser: the run completed in the background (confirmed via `.nextflow.log`, exit 0, real MultiQC report written to disk), but reloading the page showed "No run started yet." with no way to reach the report short of knowing to go dig it out of `results/multiqc/multiqc_report.html` by hand. Root cause: `st.session_state.proc` (the `subprocess.Popen` handle `status_panel()` polls) lives only in that one browser session's server-side state - a page reload, a new tab, or another device opening the same URL all start a fresh Streamlit session with no memory of it, so the code's only branches were "have a live proc handle" or "say nothing was ever run," with no third case for "a proc handle from an earlier session doesn't exist anymore, but its output does." A related, milder version of the same gap: even *without* a reload, a backgrounded/unfocused browser tab is subject to normal Chrome timer throttling, so the `st.fragment(run_every=2)` poll can lag well behind the actual process exit - observed directly this session as the panel still reading "Running..." several minutes after the underlying process had already exited, until the tab was actively reloaded. **Fix:** when `st.session_state.proc` is `None` (whether because nothing was ever run in this session or because the session itself is new), check whether `MULTIQC_REPORT` already exists on disk and, if so, show it along with its file-modification timestamp so the viewer can judge how fresh it is, rather than defaulting to "No run started yet." Deliberately scoped to *reporting a finished run*, not to reattaching to a still-*running* one across sessions - the file's own header comment already documents why that's out of scope (no official Streamlit primitive for tracking a background subprocess across sessions, `streamlit/streamlit#9310`); a live progress bar surviving a reload would need a real job-queue/PID-file layer, which is a much bigger change than this fix warrants for the actual failure mode observed (a *finished* result being invisible, not a live one).

---

## Decisions worth remembering (not bugs, but easy to second-guess later)

- **Kept Seqera Wave containers** (`community.wave.seqera.io/...`) for the fastp and multiqc modules rather than forcing them back to `quay.io/biocontainers` tags. This is unrelated to Seqera Platform (the paid GUI/orchestration product with free-tier limits, which this project does **not** use) — Wave is just a free, public container registry, same as quay.io. Confirmed with the owner 2026-09-11.
- **Dev-tier Kraken2 truth-validation dropped entirely**, moved to AWS only — the dev laptops' real usable RAM (~7GB, not 16GB) doesn't fit even the smallest truth-capable DB tier. See `docs/planning/PLAN.md` §1.1/§2.3.
- **Seqera Platform ruled out entirely, production deployment shape decided, 2026-09-13** (owner: "aws will host a normal windows vm, just like any pc. and we will run the app on it. its going to have both the ui and everything. i dont think we need seqera cloud at all. no need to do anything for it."). Resolves `docs/planning/PLAN.md` §7's "decision gate at handover" (previously left open between Seqera Cloud/self-hosted and the Streamlit UI) - the Streamlit UI is the permanent choice, no Seqera evaluation, account, or quote is needed at any point. Also clarifies the AWS production shape: a normal Windows EC2 VM running the exact same stack already built and validated locally (WSL2/Docker Desktop, this pipeline, `bin/run.sh`/`bin/run-ui.sh`) - not a cloud-native/managed-platform setup, not an AWS Batch executor. `bin/setup-dev.sh` doubles as the production setup script; no separate prod-provisioning work is needed unless something genuinely Windows-EC2-specific turns up once that VM exists (not yet investigated - no VM to test against yet).
- **Real-data validation, 2026-09-11.** Every run up to this point — including all 22 `nf-test` cases — used the 99-read SARS-CoV-2 toy fixture (`docs/planning/PLAN.md` §2.3 already flagged this as mechanics-only, not truth-validating). Per owner request ("i did notice that you are testing with fake data... test with some real data its fine if it takes longer"), downloaded the actual ZymoBIOMICS Mock Community Standard MiSeq run used as a real production reference dataset (ENA `ERR2984773`, SRA BioProject PRJNA507122 — 8 bacteria + 2 yeast, evenly distributed), subsampled to 1M read pairs for a tractable-but-genuinely-real first pass (`assets/samplesheet_zymo_real.csv`), and ran the full `fastq`-entry pipeline (fastp → FastQC → MEGAHIT → QUAST → MultiQC, host-depletion and Kraken2 skipped for this first pass) with a literal `process.resourceLimits` override (`-c` config, 6 CPU / 8GB / 12h — see the note below on why `-params-file` doesn't work for this). **Result: succeeded end to end, 0 failures, real assembly stats** — 12,664 raw contigs (10,880 ≥ 500bp after QUAST's default filter), N50 4,073bp, largest contig 68,152bp, 29.5Mb total assembled length, GC 49.24% (plausible for a mixed bacterial/yeast community), 99.26% of real Illumina reads survived fastp's actual filtering (vs. the toy fixture's near-100% on a much smaller, cleaner read set). Confirms every reporting feature added this session (Fixed #16's `software_versions.yml`/MultiQC tool-version panel, DAG generation) works correctly against real tool output, not just the fixture. **One test-setup gotcha hit and fixed (not a pipeline bug):** first attempt used `-profile docker` alone and hit `Process requirement exceeds available memory -- req: 36 GB; avail: 11.6 GB` for FASTP, because `conf/base.config`'s `resourceLimits` fell through to `nextflow.config`'s unconstrained 128GB default with no `test`/other resource-limiting profile active — same root cause as Fixed #6 (`-params-file` overrides for `max_memory` are read too late in the config chain to affect `resourceLimits`), confirming that finding generalizes beyond the original test-profile context: **any** ad hoc run needs a literal `process.resourceLimits = [...]` block via `-c`, not a params override. **Second combination tested same day: host-depletion enabled** (`skip_host_removal: false`, `host_fasta` = the same lambda phage reference `conf/test.config` already uses) against the identical real 1M-read-pair dataset. **Result: succeeded end to end, 0 failures.** Bowtie2 alignment rate against lambda phage: 0.04% (992,239 of 992,595 pairs aligned 0 times concordantly or discordantly) — correctly near-zero, since the Zymo mock community has no biological relationship to lambda phage, confirming at real data scale the same lesson Fixed #12 established on the 99-read toy fixture (an unrelated reference should pass real reads through essentially unchanged, not silently deplete them). Resulting assembly is nearly identical to run #1's un-depleted assembly, as expected: 12,672 vs. 12,664 contigs, 29.51Mb vs. 29.52Mb total length, N50 4,066bp vs. 4,073bp — the tiny deltas are exactly the ~400 reads Bowtie2 did drop, not a bug. **Third combination tested same day: `contigs` entry point fed the real assembly itself** — `assets/samplesheet_zymo_real_contigs.csv` points directly at run #1's own `zymo_mock.contigs.fa.gz` output, with `input_type: contigs`. **Result: succeeded, QUAST numbers matched run #1's fastq-entry numbers exactly** (12,664 raw contigs / 10,880 ≥500bp, N50 4,073bp, 29.52Mb total, GC 49.24% — byte-for-byte the same, as expected since it's literally the same assembly file re-analyzed through a different entry point). Confirms the `contigs` entry point is a genuine equivalent path into the same QUAST/Kraken2 stages, not a separately-behaving code path — real-data proof of the same claim `docs/planning/PLAN.md` §6.10 makes about the two entry points sharing a backbone.

**Fourth combination tested same day: `skip_megahit=true` (+ `skip_host_removal=true`) on real reads** — the fastq-entry analogue of Fixed #16's QUAST auto-skip cascade, now exercised on genuine data instead of the toy fixture. **Result: succeeded, auto-skip fired correctly** (`WARN nextflow.Nextflow - skip_quast=false but no contigs exist to QC (skip_megahit=true on a fastq entry) - QUAST needs assembled contigs; skipping it automatically rather than running on nothing.`), MultiQC still produced a full report from fastp+FastQC data alone (no megahit/quast columns present, as expected), and `pipeline_info/` still generated `software_versions.yml`/`pipeline_dag.html` correctly with only 2 tools recorded instead of 4. Confirms the "any node can be the last step and still get a report" requirement (the owner's original pushback that produced Fixed #16) holds on real data, not just the fixture.

**Fifth combination attempted same day, real-data testing found a genuine resource-budget limit, not a pipeline bug:** launching a `skip_fastp=true` real-data run (MEGAHIT on raw untrimmed reads) concurrently with the still-in-progress Kraken2 `standard_08_GB` DB download OOM-killed the MEGAHIT container (Docker exit 137) partway through assembly. Root cause confirmed via `free -h` and `docker ps -a`: the WSL2 VM this session runs in has only 11GB total RAM, and three things were competing for it at once — MEGAHIT (capped at 8GB via `process.resourceLimits`, but that cap only bounds the *container's own cgroup*, not what else the host has free), the `curl` DB download (buffering + page cache), and an unrelated `microbox-sql` container (`mcr.microsoft.com/mssql/server:2022-latest`, not part of this pipeline, already running 5+ hours before this testing session and never stopped) holding its own multi-GB SQL Server memory floor. None of the three individually requested more than was configured, but the host had no headroom left once all three ran together. **Not fixed as a pipeline change** — `process.resourceLimits` correctly bounds a single container; it cannot know what else is running on the same host, and adding host-level memory arbitration is out of scope for a Nextflow pipeline. **Practical fix applied: serialize memory-heavy real-data testing** (don't run pipeline executions concurrently with large downloads on this dev machine) rather than parallelizing every combination — re-ran the DB download alone (resumed via `curl -C -`, safe since it's a single-file HTTP download S3 supports ranges on) and deferred the `skip_fastp` combo until it's not competing with anything else. **Worth a PLAN.md note for anyone doing real-data testing on a laptop-class dev box:** check `free -h` before launching a real assembly job if anything else memory-hungry might be running, and don't assume `resourceLimits` alone makes concurrent runs safe.

**Sixth combination, the actual truth-validation test: Kraken2 + Bracken against the real ZymoBIOMICS data, classified with a real 8GB `standard_08_GB` DB.** Downloaded from `https://genome-idx.s3.amazonaws.com/kraken/k2_standard_08_GB_20260626.tar.gz` (5,946,578,575 bytes, sha256 `b17d05ca1459564b49b63d014c4b2ee6ebe1ca0143e6c184e0dfd6d940a55981` — pinned the same way as the existing `viral` variant, no vendor-published plain checksum exists), added to `bin/download-dbs.sh` as the `standard_08_GB` variant (was previously in the script's "not wired up yet" rejection list). **Real capacity finding, worth recording since PLAN.md §1.1 had already predicted this exact failure mode on a "~7GB usable RAM" dev laptop:** this WSL2 VM actually has 11GB total, and the DB's `hash.k2d` alone is 8GB — running the earlier real-data MEGAHIT assembly *concurrently* with this DB's download OOM-killed MEGAHIT (Docker exit 137, documented above). Serializing the work (nothing else running, `resourceLimits` memory raised to 9GB for this run only) let Kraken2 load the full 8GB hash table and complete successfully — so the constraint is real but narrower than PLAN.md assumed: it's concurrency-driven, not an absolute "can never fit" wall on an 11GB machine, though it does leave near-zero headroom for anything else. **Classification result — genuinely validates against known truth, not just mechanics:** all 8 ZymoBIOMICS bacterial species were correctly identified and, after Bracken's abundance correction, accounted for ~98.5% of classified reads combined, each individually the dominant hit in its genus (Salmonella enterica 19.5%, Pseudomonas aeruginosa 16.0%, Bacillus spizizenii 11.9%, Listeria monocytogenes 11.4%, Limosilactobacillus fermentum 10.9%, Enterococcus faecalis 10.9%, Staphylococcus aureus 10.4%, Escherichia coli 7.1%) — everything else in the report was <1% closely-related-strain noise, the expected shape of real k-mer classification, not an error. Two real taxonomy nuances surfaced and are worth knowing about, not bugs: (1) "Lactobacillus fermentum" is classified under its current valid name **Limosilactobacillus fermentum** (the genus `Lactobacillus` was split in 2020 — Zheng et al. — and NCBI's taxonomy, which Kraken2's DB is built from, already reflects the split); (2) the mock community's "Bacillus subtilis" reads classify overwhelmingly as **Bacillus spizizenii** (11.9%) rather than literal `Bacillus subtilis` (0.24%) — these two are extremely closely related (`B. subtilis` was itself split from a `spizizenii` subspecies in some taxonomic revisions) and Zymo's actual reference strain is known to sit right at that boundary; not a classification failure, a genuine taxonomic ambiguity in the underlying biology. As expected (and confirmed by `grep`), **neither yeast species (Saccharomyces cerevisiae, Cryptococcus neoformans) appears anywhere in the report** — `standard`-tier Kraken2 DBs only index bacteria/archaea/viral/human, never fungi, so this is a DB-composition limitation inherent to the "standard" family, not a pipeline defect; truth-validating the fungal fraction of this mock community would require a DB tier this project has deliberately not adopted (PLAN.md §2.3). Also present: a trace Homo sapiens hit (110 reads, 0.01%) — unsurprising, low-level human DNA contamination is a well-known artifact of Illumina library prep and sequencing facilities, and the `standard` DB indexes human sequence specifically to be able to flag exactly this.

**Also re-ran the `contigs` entry point through Kraken2 with this same real DB**, using `assets/samplesheet_zymo_real_contigs.csv` (MEGAHIT's real, already-`.gz`-compressed assembly). **Confirms the *other* branch of Fixed #15's `GZIP_CONTIGS` logic on real data**: the `.branch{}` check correctly routed the already-gzipped file straight through without re-compressing it (the toy-fixture bug this fix addressed only hit the *uncompressed*-input branch). Result: a real, non-empty 212-line report (14,965 bytes — confirmed with `wc -l`/`ls -la`, not just "file exists," per the #13/#15 lesson about verifying content reached the report, not just that a file landed on disk), and all 8 known bacteria again dominate (Pseudomonas aeruginosa 14.2%, Salmonella enterica 11.9%, Bacillus spizizenii 11.1%, E. coli 4.3%, S. aureus 3.6%, L. monocytogenes 1.9%, E. faecalis 1.8%, Limosilactobacillus fermentum 1.8%) — percentages differ from the fastq-entry run because contigs classify per-assembled-sequence rather than per-read (a 68kb contig and a 200bp contig each count as "1" here), not because anything is wrong.

**Seventh combination, closing the deferred item from Fifth: `skip_fastp=true` re-run alone** (no concurrent jobs this time). **Result: succeeded cleanly**, confirmed fastp genuinely didn't run (no `fastp/` output directory, `software_versions.yml` lists only 3 tools instead of 4) and FastQC/MEGAHIT/QUAST ran directly on raw untrimmed reads. Assembly on raw reads is essentially indistinguishable from the trimmed-read baseline (12,673 vs. 12,664 contigs, N50 4,073bp both, 29.67Mb vs. 29.52Mb total, GC 49.28% vs. 49.24%) — MEGAHIT's own internal error-correction/k-mer filtering absorbs most of what fastp would have trimmed anyway for a real high-quality MiSeq run like this one, so "no meaningful difference" is itself a legitimate real-data finding (not every skip flag will show a dramatic effect — that's expected, not a sign the flag silently did nothing, since the tool-count/file-presence checks above independently confirm fastp really was skipped).

**Real-data testing phase now covers seven distinct combinations, all against genuine ZymoBIOMICS data, all documented above:** defaults (fastq entry, full pipeline), host-depletion (unrelated reference, near-zero removal as expected), contigs entry fed the real assembly, the `skip_megahit` auto-skip-QUAST cascade, full Kraken2+Bracken truth-validation on the fastq entry, Kraken2 truth-validation on the contigs entry (already-gzipped `GZIP_CONTIGS` branch), and `skip_fastp` on raw reads.

**Eighth combination, the actual UI test: uploaded the real ZymoBIOMICS samplesheet through the Streamlit UI itself** (not the CLI), `test` environment (the default), clicked Run. **Result: the pipeline itself succeeded end to end** (`-profile test,docker`, all 7 processes completed, real assembly produced — 12,672 contigs, N50 3,926bp, 30.2Mb, GC 49.31%, close to but not identical to the CLI baseline's numbers, an expected amount of MEGAHIT run-to-run variance rather than a bug), taking ~24 minutes total under `conf/test.config`'s tighter 6GB/2-cpu `resourceLimits` (vs. ~5 minutes for the equivalent CLI run under a custom 8-9GB config) — confirms the `test` profile's resource ceiling, while noticeably slower, does still complete real 1M-read-pair data rather than failing outright, another useful real capacity data point alongside the PLAN.md §1.1 addendum above. **But this same real-data UI run is exactly what surfaced Fixed #21** (the UI going silent about a completed run after a page reload) — without that fix, the actual result of this test would have been invisible through the UI itself, discoverable only by going around it to inspect files on disk or the Nextflow log directly, which defeats the entire point of having a UI. Confirmed fixed and re-verified live in-browser after the code change (screenshot showed the real MultiQC report rendering correctly with its generation timestamp, from a freshly-reloaded session that had no `session_state` memory of the run at all).

- **metaSPAdes added as an alternative assembler, 2026-09-12** (owner: "continue implementing new features," after the known-issues/real-data work above was wrapped up). Not a bug fix, a genuine new feature - picked over geNomad/CheckV/MaxBin2/Pavian (PLAN.md §9's other planned-but-unwired tools) because PLAN.md §6.10 had already identified it as the smallest, most architecturally-clean gap: "same-shape addition... not a new architecture," unlike the others which need new external databases (geNomad/CheckV) or aren't a pipeline step at all (Pavian is a standalone service). `params.assembler` (`'megahit'` default | `'metaspades'`) branches `workflows/microbox.nf`'s assembly stage between the existing `MEGAHIT` module and a newly-installed nf-core `SPADES` module run in `--meta` mode (`ext.args = '--meta'`, `conf/modules.config` - the module has no separate metaspades process, only this flag distinguishes it from plain SPAdes). Confirmed genuinely same-shape as predicted: SPAdes already emits a gzipped `*.contigs.fa.gz`, so QUAST, Kraken2's `GZIP_CONTIGS` branch (Fixed #15), and the tool-version topic-channel provenance system (Fixed #16) all picked it up with **zero** downstream code changes. Two real, verified findings worth recording (not assumed): (1) the actual nf-core module pins `community.wave.seqera.io/library/spades:4.1.0--77799c52e1d1054a`, not the `quay.io/biocontainers/spades:4.3.0--hde4eca7_1` PLAN.md §2.1's earlier standalone research found - this project installs nf-core modules verbatim (same as every other tool here, `fastp`/`kraken2`/etc.) rather than hand-picking an alternate tag, so 4.1.0 is what actually ships; §2.1's table now has a correction note pointing here rather than looking like an unexplained discrepancy. (2) Verified against MultiQC's own module list (`docs.seqera.io/multiqc/modules/`, checked live, not assumed) that MultiQC has **no** native SPAdes/metaSPAdes module at all - only MEGAHIT, HiFiasm, and Supernova support assembly tools - so unlike MEGAHIT's log (Fixed #16), `SPADES.out.log` is deliberately *not* mixed into the MultiQC file channel (it would just be silently ignored, adding a file with no payoff); QUAST is what actually satisfies "any node can be last and still get a report" for a metaSPAdes run, since it works from the contigs FASTA itself regardless of which assembler produced it - same principle real ZymoBIOMICS testing already confirmed above at production scale. **Tested, not just wired:** a toy-fixture smoke run (`-profile test,docker --assembler metaspades`, real output - 22 contigs, 7,443bp, GC 38.79%) plus a new dedicated `nf-test` case (`tests/main.nf.test`, tag `basic`) asserting real content - the contigs file exists, MEGAHIT's own output directory does NOT exist (proving this is a genuine either/or choice, not metaspades silently no-oping while megahit still ran), QUAST ran against the SPAdes assembly, and `software_versions.yml` names `spades` - full 12-test `basic` suite green (previously 11; one caught-and-fixed false alarm along the way: an initial regression-check run without `-profile test,docker` failed 10/11 tests with "Missing fromPath parameter"/an OOM, which was an invocation mistake on this session's part - the correct invocation is documented in `bin/setup-dev.sh`'s own usage hint - not a real regression from this change; re-run with the right flags came back 11/11 clean before the new test was even added).

- **geNomad + CheckV added as viral/plasmid discovery and quality-assessment tools, 2026-09-12** (user: "continue," then "continue the implementation and test. fully autonome without requiring my input" - the next feature after metaSPAdes, picked from PLAN.md §9's remaining planned-but-unwired tools). Why these two specifically, ahead of MaxBin2/Pavian: this toolbox's actual application is vaccine R&D, and geNomad finds *candidate* viral sequences directly from assembled contigs - including ones a reference-DB-only classifier like Kraken2 would miss entirely if the virus isn't already in its DB - while CheckV grades the completeness/contamination of whatever geNomad flags. Wired via nf-core's `genomad/endtoend` and `checkv/endtoend` modules: `params.skip_genomad`/`skip_checkv` (both default `true`, same DB-dependency reasoning as `skip_kraken2`) plus `params.genomad_db`/`checkv_db`. Both operate on `ch_contigs` only (any assembler, any entry point), gated by the same `ch_contigs_present` guard QUAST already used (now computed once, up front, and reused by all three). CheckV is auto-skipped whenever geNomad is off, same "inapplicable combination made to not-happen automatically" pattern as Bracken-on-contigs.

  Real container tags, not assumed: geNomad 1.12.0 (`community.wave.seqera.io/library/genomad:1.12.0--27836e6e665e84b5`) matches PLAN.md §2.1's own prior research exactly. CheckV 1.0.3 (`quay.io/biocontainers/checkv:1.0.3--pyhdfd78af_0`) differs from §2.1's researched 1.1.1 - same pattern as metaSPAdes's tag discrepancy above, same resolution: this project installs nf-core modules verbatim rather than hand-picking tags, and 1.0.3/1.1.1 are both within the same 1.x DIAMOND-`genome_db` line (bioconda's own version history shows 1.0.0 released 2022-07-27, already well after the 0.9→1.0 DIAMOND-format break §2.1 already flags) - no compatibility break, §2.1's table now notes this.

  Real friction fetching the databases, not a clean one-liner: (1) CheckV's DB has a published stable URL (`portal.nersc.gov/CheckV/checkv-db-v1.5.tar.gz`), but a direct `curl` against it measured ~20KB/s (20+ hours projected for 1.57GB) and dropped the connection outright under HTTP/2 (`curl exit 92`, "stream was not closed cleanly") before even finishing once. CheckV's own `checkv download_database <dir>` command hit >2MB/s instead against what must be a different backend path - same content, evidently just not subject to whatever throttled the direct URL from this network. Switched `bin/download-dbs.sh`'s `checkv` variant to use this official downloader, same "use the tool's own official downloader" approach geNomad's variant already used (`genomad download-database .` - geNomad's DB has no stable static URL/checksum to pin at all, only this documented method). (2) Both downloaders left their output owned by an internal container uid with no world-read permission (`checkv`: `drwxrwx---`, group `74014`; `geNomad`: individual files `-rw-r-----`, group `91535`) - harmless until the *pipeline's own* docker containers (which run as the host user, `nextflow.config`'s `docker.runOptions = '-u $(id -u):$(id -g)'`) tried to actually read the DB and hit a real `PermissionError`, found only once GENOMAD_ENDTOEND actually ran against it, not at download time. Fixed by adding the exact same `-u $(id -u):$(id -g)` mapping to `bin/download-dbs.sh`'s own `docker run` calls for both variants, then re-downloading both DBs (re-verified this fixes the underlying tests, not just quieted a symptom.) (3) geNomad's `mmseqs2` marker search then SIGKILLed under a 9GB `resourceLimits` cap alone (loading the full `genomad_db` v1.9 index needs more) - fixed with geNomad's own documented remedy first (`--splits 4`, `conf/modules.config` `ext.args` - "If the MMseqs2 search is failing, try to increase the number of splits" per `genomad end-to-end --help`, not a made-up workaround), which still needed pairing with a `resourceLimits` override to actually fit - added as a `withName: 'GENOMAD_ENDTOEND'` block *inside* `conf/test.config` rather than raising the profile's general 6GB cap, since `resourceLimits` can be scoped per-process-selector just like any other directive and the general cap exists specifically to keep `-profile test` usable on a ~7.5GB machine (PLAN.md §1.1) - this keeps that guarantee intact for every other process while giving geNomad the ~9GB it actually needs.

  MultiQC coverage: verified live against MultiQC's own module list (`docs.seqera.io/multiqc/modules/`) that **neither tool has a native MultiQC module** (only MEGAHIT/HiFiasm/Supernova support assembly-adjacent tools at all) - same gap metaSPAdes hit, but unlike metaSPAdes (where QUAST already covers assembly-quality reporting regardless of which assembler ran), a geNomad/CheckV-*only* run would have had genuinely nothing else to satisfy "any node can be last and still get a report" (Fixed #16) - no other stage's output stands in for it here. Closed properly, not just documented as a gap: two small MultiQC custom-content summaries (same `_mqc.yml` auto-detection mechanism already built for tool-version provenance), reporting a per-sample virus count from each tool's own summary TSV. Also added: a `.filter { fasta.size() > 100 }` guard before feeding geNomad's `virus_fasta` output to CheckV - geNomad's virus_fasta always exists (not `optional: true` in the module) even when it finds zero viruses in a sample, a real and common non-error outcome, and feeding CheckV an empty result would be a meaningless run at best.

  Also confirms **KNOWN_ISSUES.md #10 is still accurate**, hit firsthand while first smoke-testing: `--skip_genomad false` on the bare CLI silently had no effect (the string `"false"` is truthy under strict syntax), making the run look like geNomad simply hadn't been enabled at all - fixed the same documented way, `-params-file` instead of bare CLI flags for booleans.

  **Real, verified result, not just "it ran":** the toy fixture is a genuine SARS-CoV-2 genome fragment (nf-core's own sarscov2 test-datasets), and geNomad correctly identified and taxonomically classified **7 contigs down to family level (Coronaviridae)** - proving actual biological correctness, not just mechanics. CheckV correctly graded all 7 as "Low-quality" genome fragments (each only a few hundred bp of a ~30kb real genome - exactly what CheckV *should* conclude) with 0% contamination. A new dedicated `nf-test` case (`tests/main.nf.test`, tag `requires_db`, asserting this exact Coronaviridae content and both `_mqc.yml` files) passed twice in a row alongside the full existing `requires_db` suite (12/12 both times) - the only failures seen across those runs were two different, unrelated, confirmed-transient network fetch errors (a remote nf-core test-datasets URL and NCBI eutils both briefly unreachable, each verified reachable again immediately after and passing on retry), not regressions from this change.

- **WSL2 VM lifecycle - closing the terminal window kills everything in it within seconds, and no Linux-level trick can stop that, 2026-09-12** (owner: "what if they lose internet, what if they go home and comeback the next day"). First attempt at a fix (`bin/run-ui.sh` launching Streamlit via `setsid nohup ... & disown` so a SIGHUP to the launching shell wouldn't kill the UI or any run it supervises) looked correct on paper and was initially reported as fixed - **caught the mistake by actually testing it, not by trusting the fix looked right:** a plain `setsid nohup sleep 60 & disown`, launched and left to run, was gone within seconds of the launching `wsl.exe` connection closing - no log file even got created. Root cause is a level up from anything `setsid`/`nohup`/`disown` can address: WSL2 tears down the **entire VM** for a distro shortly after its last `wsl.exe` client disconnects (confirmed via web search against reported WSL behavior, not just this one local test) - that's the VM's own idle-shutdown policy killing every process in it at once, not a signal reaching this one process, so no amount of session-detaching inside Linux survives it. This explains why this whole session's many long-running background downloads/pipeline runs (Kraken2/geNomad/CheckV DBs, real-data runs) never hit this: they were launched through the Bash tool's own backgrounding mechanism, which keeps a connection to the VM alive for the task's whole duration - a real end user closing their one terminal window has no such thing keeping the VM alive. **Fix, scoped honestly to what's actually fixable from here:** `bin/run-ui.sh` still uses `setsid`/`nohup`/`disown` (genuinely correct for its narrower case - something else in the *same* shell later sending SIGHUP, or the shell exiting while the terminal app/WSL connection stays open) and its own printed output now says plainly that the terminal *window* must stay open (minimizing it is fine) rather than falsely claiming it's safe to close entirely. The actual fix for "close the terminal app and it keeps running anyway" is a Windows-side setting outside this repo - `vmIdleTimeout=-1` (or a large value in ms) under `[wsl2]` in `%USERPROFILE%\.wslconfig`, which disables WSL2's idle VM shutdown - deliberately left for the user to add themselves (a global, machine-wide Windows config change, not a project file, and not something to change unasked) rather than silently applied. `bin/run.sh` already runs with `-resume`, so even a run genuinely killed this way (machine sleep/shutdown, terminal closed anyway) resumes from cached progress on the next invocation rather than restarting from scratch - real resilience, just not "survives unattended," which needs that Windows-side setting or a genuinely different job-supervision architecture (a proper background service/scheduled task) neither of which this session built.

- **Three "go home and comeback the next day" UI quality-of-life additions, 2026-09-12, all tested against a real running/cancellable process, not just read for correctness:** (1) **Live-run reattachment** (`ui/app.py`) - Fixed #21 already recovered a *finished* run's report after a fresh browser session (reload, new tab, different device), but gave no signal at all for a run still genuinely in progress at reload time, only "no run tracked" or "here's an old report." A `.streamlit_run.pid` file, written when Run is clicked and outliving any one session's own `st.session_state`, lets a fresh session tell a live run (`os.kill(pid, 0)` - exists, doesn't need to be *our* child) from a finished or never-started one, and shows its log tail live. **Real bug caught by actually testing this, not by code review alone:** the first version unconditionally deleted the PID file whenever a session's own tracked run reached a finished state - harmless in isolation, but since `PID_FILE` is one shared file, a tab left open after its own run finished still reruns its fragment periodically (Streamlit reruns on far more than just the `run_every` timer) and kept deleting a *different*, newer run's PID file out from under it, verified directly: planted a fake long-lived process's PID, watched a stale finished-session tab erase it within seconds. Fixed by comparing the file's contents against `proc.pid` before deleting - only a session that actually owns the run named in the file may clear it. (2) **Cancel button**, both for a run this session's own `st.session_state` is tracking and for a reattached one it only knows a PID for - `subprocess.Popen(..., start_new_session=True)` makes the run its own process-group leader (verified via `ps -o pgid,sid` - PID, PGID, and SID all equal, separate from Streamlit's own group), so `os.killpg(os.getpgid(pid), signal.SIGTERM)` reaches `bin/run.sh`, `nextflow`, and `tee` together - plain `proc.terminate()` would only have reached `bin/run.sh` itself, since bash's default SIGTERM disposition is to just die, not forward the signal to its own foreground pipeline's children. Verified end-to-end: planted a real long-lived process's PID, clicked Cancel, confirmed both the process was gone (`ps -p` empty) and the PID file was cleaned up, in a fresh reattached session that never held the original `Popen` object. Nextflow's own SIGTERM handling then does its usual best-effort cleanup of task containers it started - not independently re-verified against an actual mid-flight Docker container this session, worth confirming if Cancel is used against a real multi-container run later. (3) **Disk-space preflight warning** before Run is even clickable meaningfully - real DBs downloaded this session were multi-GB each (Kraken2 ~6GB, geNomad ~5GB, CheckV ~1.6GB), and a run failing hours in because the disk quietly filled up is a worse experience than a warning up front; a flat 10GB floor is a deliberately simple heuristic (not a real per-run estimate - that needs knowing which DBs/tools a run will actually touch, which the current thin launcher doesn't expose as params at all; a real estimate belongs to the node-based composer once built, see `docs/planning/PLAN.md`'s quality-of-life requirements section). Separately, found and fixed a genuine pre-existing bug in `bin/run-ui.sh` while testing all this: it called bare `streamlit` assuming it was on `PATH`, but `streamlit` only exists inside `.venv-ui/` - worked by accident for anyone who happened to `source .venv-ui/bin/activate` in their interactive shell first, the exact same "works interactively by accident, breaks when run standalone" shape as Fixed #17's Java/SDKMAN issue. Now invokes `.venv-ui/bin/streamlit` by full path, with a clear error if that venv doesn't exist yet.

- **Maintainability/handover pass, 2026-09-12** (owner: "this project will be maintained and upgraded by someone else, so make it as easier to adapt change upgrade and all") — a new standing principle recorded at the top of `docs/planning/PLAN.md`, and four concrete deliverables: (1) **`README.md` was silently, badly stale** — still read "Early development... not yet runnable end-to-end" despite the project being fully functional and real-data-validated by this point, exactly the kind of thing that misleads a new maintainer's very first impression worse than having no README at all. Rewritten with an accurate status, a real quick-start (`bin/setup-dev.sh` → `bin/run.sh`/`bin/run-ui.sh`), the actual tool catalogue, a repo-layout map, and a documentation map pointing to every other doc. (2) **New `CONTRIBUTING.md`** — not generic advice, a playbook grounded in exactly what this session did three times over (adding metaSPAdes/geNomad/CheckV): the concrete steps to add a new tool, how to safely upgrade a container tag (never invent a checksum, never assume the module's tag matches old research — both bit this session for real), how to add a UI feature without breaking the GUI-agnostic contract, where to look when something breaks, and the Windows/WSL dual-copy sync quirk that would otherwise cost a new maintainer a confusing hour the first time they edit a file and see no effect. (3) **New `CHANGELOG.md`** (Keep a Changelog format) — a terse "what shipped" summary complementing `docs/planning/PLAN.md`'s much deeper decision-by-decision rationale; everything to date sits under `[Unreleased]` since nothing has been tagged/released yet. (4) **A table of contents added to `docs/planning/PLAN.md`** — 700+ lines, previously navigable only by reading linearly or grep; now has a real per-section index at the top. All four cross-reference each other and the existing `docs/KNOWN_ISSUES.md`/`docs/TESTING.md` so a new maintainer has one clear entry point (`README.md` → `CONTRIBUTING.md` for "how do I change something" → the deeper docs for "why is it built this way").

- **Static analysis + a real UI unit-test layer, 2026-09-13** (owner: "go ahead and fix issues, do further testing" — closing concrete gaps `docs/TESTING.md`'s own audit had flagged rather than leaving them documented-but-open). Three tools installed and actually run for the first time this project has had them: `shellcheck` (via `apt`) against all 5 `bin/*.sh` scripts — **zero real issues found**, only 3 expected `SC1091` info-notes (sourcing a file that doesn't exist yet at lint-time, e.g. SDKMAN's `sdkman-init.sh` before SDKMAN has installed it, or the venv's `activate` before the venv has been created) — silenced with `# shellcheck disable=SC1091` and a one-line reason at each site rather than left noisy. `ruff` (via `pip`, into `.venv-ui`) against `ui/app.py` — **3 real findings, all fixed**: `datetime.fromtimestamp()` needing explicit timezone-awareness (fixed via `.astimezone()` — same displayed local wall-clock value as before, just no longer ambiguous), an implicit `subprocess.run()` missing its `check` argument (fixed by adding `check=False`, since the caller already inspects `.returncode`/`.stdout` manually rather than wanting an exception), and one genuine false-positive (`SIM115`, "use a context manager for opening a file") correctly left as-is with a `# noqa: SIM115` and a comment explaining why — the log file handle is deliberately kept open for the whole lifetime of the `subprocess.Popen` it's handed to, and wrapping it in `with` would close it the instant `Popen` returns, breaking log capture entirely.

  `pytest` + Streamlit's own `AppTest` framework (via `pip`, into `.venv-ui`) — a real gap `docs/TESTING.md` had itself flagged (this project's UI verification had only ever been a bare syntax check or a full browser session, nothing in between). New suite at `ui/test_app.py`, 8 tests, covering exactly the logic this session's manual browser testing had verified once by hand but never had an automated regression test for: the never-started/finished-report/still-running state machine, stale-PID cleanup, the disk-space warning (both triggering and *not* triggering, via `monkeypatch.setattr(shutil, "disk_usage", ...)` since forcing a real low-disk condition isn't practical to automate), and - the one that actually caught a real bug while writing it - **the Cancel button genuinely terminating the process, not just changing what the UI displays**. That test hung indefinitely on its first attempt: the test's stand-in "still running" process (`subprocess.Popen(["sleep", "30"])`) shared the *test runner's own* process group by default, so `_cancel_run()`'s real `os.killpg(os.getpgid(pid), signal.SIGTERM)` — correctly written to reach a real run's whole process tree — ended up also delivering `SIGTERM` to the pytest process itself. Fixed by spawning the stand-in with `start_new_session=True`, which is also simply the more accurate stand-in, since that's exactly how `ui/app.py`'s real `Popen` call spawns `bin/run.sh`. Full suite: 8/8 passing in well under a second, and the existing `nf-test` `basic` suite re-run afterward to confirm none of the `ruff`-driven `ui/app.py` fixes touched anything pipeline-side (they didn't — `ui/app.py` and `workflows/microbox.nf` are on opposite sides of the GUI-agnostic contract by design).

- **`nf-core pipelines lint` crashed outright; root cause found and a real bug fixed, 2026-09-13** (owner: "continue!", closing the last gap from the prior "fix issues, do further testing" pass). `nf-core pipelines lint` (nf-core/tools 4.1.0 — note the CLI moved this under `pipelines lint`, the bare `nf-core lint` from older versions no longer exists) crashed with an opaque `ERROR not enough values to unpack (expected 2, got 1)` and no traceback even under `-v` (nf-core's CLI catches and re-logs exceptions without their traceback by design). Got the real traceback by calling `nf_core.pipelines.lint.run_linting()` directly in Python instead of through the CLI: `nf_core/utils.py`'s `load_pipeline_config()` does `self.pipeline_prefix, self.pipeline_name = manifest.get("name", "/").split("/")` — it hard-requires `manifest.name` in `nextflow.config` to be `<org>/<pipeline>` (the nf-core convention, e.g. `nf-core/rnaseq`), and this repo's was just `'microbox'`, a single segment. **Real, fixable repo bug — fixed**: `manifest.name` changed to `'AppaYiipYiip/microbox'` (matching the repo's actual GitHub org/name, consistent with `manifest.homePage`), verified only used for display (the run report in `main.nf`'s `onComplete:` block) so the change is safe. After the fix, `nf-core pipelines lint` no longer crashes — it gets past config loading and fails cleanly with `CRITICAL Pipeline schema filename could not be found` instead. **That second failure is a structural mismatch, not a bug, and is being left as-is**: `nf-core pipelines lint` is built to validate pipelines scaffolded by `nf-core pipelines create` — it expects a full template (`nextflow_schema.json`, the `nf-schema`/`nf-validation` plugin wired into `nextflow.config`, `assets/schema_input.json`, nf-core's CI workflow files, etc.). microbox deliberately reuses nf-core *modules* (see Fixed #1/Open #2) without adopting the full template scaffolding — recreating all of that just to satisfy a linter built for a different kind of pipeline would be a large, separate feature, not a fix. Tried `nf-core pipelines schema build --no-prompts` to see if a real schema was cheap to get for free: it auto-generated a 21-param `nextflow_schema.json`, but it referenced a nonexistent `assets/schema_input.json`, had no wiring to actually validate anything at run time (no `nf-schema` plugin declared, no `validateParameters()` call anywhere), and most params came through with no description/help text — a disconnected draft, not a working feature. Deliberately deleted rather than committed half-wired (violates the project's own "no half-finished implementations" standard) — worth revisiting for real if a future maintainer wants either (a) full `nf-core pipelines lint` compliance, or (b) a machine-readable params schema to drive the future node-based composer UI's auto-generated forms (`docs/planning/PLAN.md` §6.15 item 1/6) — but that's new scope, not a bug fix, and hasn't been asked for.

- **First container-vulnerability scan of all 11 pinned pipeline images, 2026-09-13** (closing the `docs/TESTING.md` §6 gap: "no automated vulnerability scan... of the ~15 pinned images" — actual count is 11, verified by grepping every `modules/**/main.nf`'s `container` line, not ~15). **Docker Scout (already installed, v1.23.1) turned out to require a Docker Hub login** to run any scan at all — declined to do that non-interactively (credential/account actions are off-limits by policy) and didn't want to make a future maintainer create/link a Docker ID just to lint containers. Installed `trivy` instead (open-source, no login required) via its official apt repo with GPG key verification, then ran `trivy image --scanners vuln --severity HIGH,CRITICAL` against all 11 images (already pulled locally from this session's real-data runs, so no extra downloads needed). **Results**: `fastp`, `genomad`, and `fastqc` are fully clean (0 findings across every scanned layer). The combined `bowtie2_htslib_samtools_pigz`, `kraken2_coreutils_pigz`, `spades`, `megahit_pigz`, and `multiqc` images each carry only routine HIGH-severity Ubuntu/Debian base-OS package CVEs (2-10 findings each, all with vendor fixes already released upstream, none reachable through anything this pipeline's tasks actually do with those containers) — normal background noise for any bioconda/biocontainers image, not something specific to this project. **Real finding worth recording**: `bracken`, `checkv`, and `quast` each carry 1-2 CRITICAL CVEs (`CVE-2025-68121` crypto/tls certificate-validation bypass, `CVE-2024-24790` net/netip parsing bug, plus a cluster of 2026 Go-stdlib DoS CVEs), and all of them trace to the exact same root cause across all three images: their bioconda environments bundle **NCBI EDirect's Go binaries** (`rchive.Linux`, `transmute.Linux`) statically compiled against Go 1.22-era stdlib, which is now years out of date. **Assessed as real but low-risk as actually used here**: EDirect is a general-purpose NCBI Entrez querying toolkit that rides along in these conda environments as a transitive dependency of other packages, but none of `bracken`/`checkv`/`quast`'s actual invocations in `modules/nf-core/*/main.nf` call `rchive`/`transmute`, and none of these tasks make outbound network/TLS connections during a pipeline run (everything processes local files, no live NCBI queries) — so the vulnerable code path (TLS session resumption, network address parsing) is present in the image but never executed. **Not fixed, because it can't be from here**: these are vendored upstream in the bioconda/biocontainers build of each package, not something this repo's `nextflow.config`/module files control — the real fix is upstream bioconda rebuilding against a current Go toolchain, which is out of this project's hands. Documented rather than silently ignored so a future maintainer doesn't have to rediscover the same "wait, is this exploitable?" question from scratch. Full per-image reports saved this session at `/tmp/trivy-reports/*.txt` on the WSL machine (not synced to the repo — regenerate with the same `trivy image` command per `docs/TESTING.md` §6 rather than trusting a stale saved report). **Action for future maintainers**: re-run this scan whenever a container tag is upgraded (`CONTRIBUTING.md` §2) and periodically even without changes, since new CVEs get disclosed against already-pinned versions over time.

- **First SBOM/license inventory, 2026-09-13** (closing the other half of the `docs/TESTING.md` §6 gap — the
  vulnerability scan above covers *security*, this covers *supply-chain identity/licensing*). Installed
  `syft` (Anchore) v1.51.1 the same careful way as `trivy` above — not a piped install script, a `.deb`
  release asset downloaded from `github.com/anchore/syft/releases` with its `sha256sum` verified against
  the published checksums file before installing, matching this project's "never trust a downloaded
  artifact without verifying it" standard (`CONTRIBUTING.md` §2). Generated a CycloneDX SBOM for all 11
  pinned container images plus the UI's `.venv-ui` Python environment — full results, method, and a
  license-risk assessment now live in the new **`docs/SBOM.md`** (linked from `README.md`'s doc map and
  `docs/TESTING.md` §6) rather than duplicated here. Headline finding: no AGPL anywhere; the GPL/LGPL
  components found in the nine large conda/wave images are all base-Ubuntu-OS packages (bash, coreutils,
  dpkg, etc.), not project-authored code, and since this project doesn't build/redistribute its own
  container images or serve the UI over a network, no current license here imposes an actual disclosure
  obligation — `docs/SBOM.md` spells out the specific future triggers that would change that assessment.

- **First CI wiring, 2026-09-13** (closing the "no CI (GitHub Actions)" gap flagged in `docs/TESTING.md` §2
  and `docs/planning/PLAN.md` §6.2's original testing table). New `.github/workflows/ci.yml`, three jobs,
  every command copied verbatim from something already verified working locally this session, nothing
  invented for CI specifically: (1) **pipeline-tests** — installs the exact pinned Java 21/Nextflow
  26.04.6/nf-test 0.9.5 versions `bin/setup-dev.sh` uses, then runs `nf-test test tests/main.nf.test --tag
  basic --profile test,docker` (the 12-test, no-external-DB-needed suite — the `requires_db` tag stays
  local-only, deliberately: multi-GB Kraken2/geNomad/CheckV database downloads have no place burning CI
  minutes on every push). (2) **ui-tests** — `ruff check ui/app.py` and `pytest ui/test_app.py`, using a
  new **`ui/requirements-dev.txt`** (pins `pytest==9.1.1`/`ruff==0.16.7` on top of `requirements.txt`,
  matching the exact versions installed ad hoc earlier this session — `bin/setup-dev.sh` now installs this
  file too, so a fresh machine gets the UI's test/lint tooling automatically instead of a maintainer
  discovering it only by reading this doc). (3) **shell-lint** — `shellcheck bin/*.sh`. **Honest limitation,
  stated plainly rather than glossed over**: this workflow has been validated for YAML syntax and every
  command it runs has been separately verified to work in this exact repo (WSL, this session) — but it has
  **not yet been observed actually running on a real GitHub Actions runner**, since nothing has been pushed
  to a remote this session (`docs/KNOWN_ISSUES.md` Open #1 - pushes are a human-only action on this shared
  machine by design). First real push should be watched on the repo's Actions tab to confirm it passes for
  real, not just "looks right" - GitHub-hosted `ubuntu-latest` runners ship Docker pre-installed and
  running, which the `pipeline-tests` job relies on without any extra setup step. **Fourth job added same
  day**: `secrets-scan` runs `gitleaks detect` against the full git history (`fetch-depth: 0`), closing the
  secrets-scanning gap `docs/TESTING.md` §6 flagged as "worth adding... not urgent." Installed as a
  checksum-verified binary release (same pattern as `trivy`/`syft` above), not the `gitleaks/gitleaks-action`
  marketplace Action, which gates private repositories behind a paid license — a plain binary has no such
  restriction. Verified locally before adding to CI: ran `gitleaks detect --source .` against this repo's
  real 24-commit git history — **no leaks found**. A separate `--no-git` filesystem-only run surfaced 2
  findings, both false positives inside `.venv-ui/share/jupyter/nbextensions/pydeck/index.js.map` (a
  vendored third-party JS source map flagging high-entropy variable names as `generic-api-key`) — harmless
  and moot for CI anyway, since `.venv-ui/` is gitignored and a fresh CI checkout never has it. Also verified
  the exact install-and-checksum-verify commands used in the workflow file work byte-for-byte as written
  (run via a real script, not just eyeballed) before trusting them in CI.

- **MaxBin2 added as an optional genome-binning stage, 2026-09-13** (user: "implement all elements of the plan" - the last of PLAN.md §9's planned-but-unwired tools besides Pavian, which isn't a pipeline module at all). Clusters a mixed metagenomic assembly's contigs into per-organism bins using MaxBin2's own internal Bowtie2-based coverage estimate + marker-gene EM algorithm. `params.skip_maxbin2` (default `true` - optional by design per PLAN.md, not gated on a DB-download cost the way Kraken2/geNomad/CheckV are), only meaningful on the `fastq` entry point with assembly enabled (needs both the contigs AND the reads they were assembled from - structurally impossible on the `contigs` entry point, guarded with the same clear-warning pattern as geNomad-with-no-contigs). Four real findings from actually testing this before wiring it in, not just installing the module and hoping: (1) **the official nf-core `maxbin2` module's own research note in PLAN.md §2.1 had a stale/wrong container tag** (`h503566f_8`, doesn't exist) - re-verified live against the real module source on `github.com/nf-core/modules` (`quay.io/biocontainers/maxbin2:2.2.7--he1b5a44_2`), the same "never trust a cached research note over the live source" lesson this session already hit once for geNomad/CheckV. (2) **A local module, not the stock nf-core one**: the nf-core module only exposes a single `-reads` file, but this pipeline's reads are always paired (R1/R2 separately) and MaxBin2 itself directly supports `-reads`/`-reads2` for paired coverage estimation (confirmed via the tool's own `--help` output) - `modules/local/maxbin2/main.nf` mirrors the nf-core module's structure but wires both mates through explicitly, handling the single-end case too (`-reads2` omitted when `reads2` is empty). (3) **This project's shared toy fixture (a real SARS-CoV-2/viral genome fragment) crashes MaxBin2 outright** - its internal marker-gene finder (FragGeneScan) expects bacterial-style ORFs and errored on the viral content, confirmed by running the real container directly outside Nextflow first, unrelated to this pipeline's own wiring. nf-core's own `maxbin2` module test uses a small real bacterial fixture for exactly this reason (`bacteroides_fragilis`, `nf-core/test-datasets`) - reused here (`assets/samplesheet_maxbin2_test.csv`) rather than inventing a new one; verified end-to-end manually (fresh MEGAHIT assembly of these exact reads → MaxBin2 binning, both run outside Nextflow first) before writing the `nf-test` case, and separately validated against the real 8-species ZymoBIOMICS mock-community assembly+reads still on disk from earlier this session (13 bins from 8 species - a normal, expected over-binning outcome for a real assembly, not a red flag). (4) **Real measured resource usage is far BELOW the advertised label** - `docker stats` sampled every 3s against the real Zymo-scale run showed a peak of ~200 MiB RAM, nowhere near the nf-core module's default `process_medium` label (36 GB in `conf/base.config`) - `conf/modules.config` now gives it an explicit, honest `cpus=4/memory=4.GB` override instead of trusting the label, the mirror image of Kraken2/geNomad needing far MORE than advertised. No native MultiQC module for MaxBin2 either (verified live, `docs.seqera.io/multiqc/modules/maxbin2` - 404) - same custom-content `_mqc.yml` fix already used for geNomad/CheckV (bin count as the headline number). New `nf-test` case (tag `basic`, no external DB needed) added and passing; full 13-test `basic` suite green.

- **Pavian added as a standalone report viewer, 2026-09-13** (user: "implement all elements of the plan" - completing PLAN.md §9's tool catalogue). Deliberately NOT a Nextflow module or pipeline step (PLAN.md §6.6 item 2's own resolution, unchanged) - Pavian is an interactive R/Shiny web app for browsing Kraken2/Bracken reports, run independently of the pipeline on its own schedule. New `docker-compose.yml` (service `pavian`, image `quay.io/staphb/pavian:1.2.1` - no official biocontainers image exists, verified in PLAN.md §2.1's earlier research; StaPH-B's own build) mounts `./results` **read-only** into the container's `/data` (Pavian only ever needs to read reports, never write into this pipeline's output tree) and exposes port 3838. New `bin/run-pavian.sh` matches this project's other `bin/*.sh` launcher conventions - warns (doesn't block) if `results/kraken2`/`results/bracken` don't exist yet, starts the service via `docker compose up -d`, prints the URL and a stop command. **Verified actually working, not just "container starts"**: started it for real, waited for the service to come up, and confirmed with a genuine HTTP request (`curl http://localhost:3838`) that it returns `200` with real Shiny app HTML (`application/shiny-singletons`, `shiny-javascript` markers in the response body) - not just that `docker compose ps` shows a running container, which proves nothing about whether the R/Shiny process inside actually initialized correctly. Stopped afterward (`docker compose down`) since there's no reason to leave it running by default. `shellcheck bin/run-pavian.sh` clean.

- **`bin/inspect.sh` added - debugging for the case `bin/debug.sh` can't help with, 2026-09-13** (owner:
  "make sure its excessive so we can find all bugs while we implement and test... if a result is not what
  the R&D team expected... we need to [know] what happened and why... read carefully the result of what
  node and what goes into the next one"). `bin/debug.sh` (Fixed #7-era) only fires when Nextflow itself
  reports a failed task - it has nothing to offer when a run succeeds end to end but the *scientific* result
  looks wrong, which is exactly the failure mode expected once this ships to the R&D team for feedback.
  `bin/inspect.sh <run>` lists every task a run executed (process/status/exit/duration/peak RSS, from
  `nextflow log`); `bin/inspect.sh <run> <process>` deep-dives one - exact `.command.sh`, every file staged
  into it with **which upstream task produced each one** (resolves the staged symlink's real target, then
  matches that path's prefix against every task's own recorded workdir to identify the producing task - a
  genuine backward walk through the pipeline's data lineage, not a guess), every output file it produced,
  and full (untruncated) `.command.err`/`.command.out`. `bin/inspect.sh --bundle <run>` zips `.nextflow.log`,
  the run-report, `pipeline_info/` (trace/DAG/software-versions/MultiQC custom-content), a full task
  manifest, and every failed task's command+stderr+stdout into `debug-bundles/<run>_<timestamp>.zip`
  (gitignored) - deliberately excludes work-dir data files themselves (sequence data can be large); for
  those the manifest names the exact work-dir path to share directly. All of this is built entirely on what
  Nextflow already records for every task in `work/` (same requirement `-resume` already has - nothing here
  is new instrumentation), so it works identically wherever the pipeline runs, including the AWS Windows VM
  production deployment (`docs/planning/PLAN.md` §7) - no separate "prod debugging" tooling needed.
  **Verified against a real pipeline run, not just read for correctness**: task listing; cross-task
  lineage resolution (confirmed `MEGAHIT`'s two staged input FASTQs correctly traced back to
  `BOWTIE2_ALIGN`'s outputs); substring matching multiple processes at once (`bowtie2` correctly matched
  both `BOWTIE2_BUILD` and `BOWTIE2_ALIGN`); and the bundle mode, which caught a **real bug while testing
  it**: it initially hardcoded `results/` as the source for the run-report/`pipeline_info/`, but `--outdir`
  is a runtime param this project's own CLI testing routinely overrides (the test run used
  `--outdir /tmp/inspect-test`) - the bundle was silently packaging a *different* run's reports. Fixed by
  recovering the real `--outdir` from the run's own recorded command line (`nextflow log`'s un-filtered
  output always includes it) rather than assuming a fixed path. `shellcheck` clean (two real `SC2015`
  findings from an `A && B || C` idiom, fixed with proper `if` statements, not suppressed).

- **Full re-verification audit of past fixes, 2026-09-13** (owner: "lets put an effort into understand the
  bugs we had before, and see what caused them, if they are fully fixed, and if not lets fix them" - not a
  re-read of this document, actual re-testing against the current codebase). Six specific past
  findings re-checked for real, not assumed still valid because they were once documented:
  1. **A real regression found and fixed**: Fixed #20 documented deleting 8 unreferenced, auto-generated
     `conf/containers_*.config` files (nf-core-tools' multi-arch/multi-engine container-selection
     convention, confirmed unreferenced anywhere in the actual config chain both then and now). They had
     silently regenerated - almost certainly when a later `nf-core modules install` ran for geNomad/CheckV/
     SPAdes/MaxBin2, each of which triggers this same generation - and got committed back into the repo
     without being cross-checked against this already-documented precedent. Re-confirmed unreferenced
     (`grep` across every actual config file for any `includeConfig`/direct reference - none), deleted
     again, and this time added `conf/containers_*.config` to `.gitignore` so a future module install can't
     silently reintroduce them a third time. Re-verified safe with three separate `nf-test` `basic`-suite
     runs after deletion (two hit unrelated, independently-confirmed transient network blips fetching
     external toy-fixture URLs - a different test against a different host each time, then both hosts
     confirmed reachable again immediately after - the third run came back a clean 13/13).
  2. **Fixed #9 (the `export PATH=...` quoting bug from a space-containing project path) - root cause
     confirmed structurally impossible now, verified rather than assumed.** The project has since been
     relocated to `C:\Users\marwa\Desktop\microbox` / `~/microbox` (no spaces anywhere in the path, on
     either side of the Windows/WSL split) - checked a real task's actual `.command.run` and found
     `export PATH="\$PATH:/home/marouane/microbox/bin"`, correctly quoted and never truncated. The bug
     itself was never "fixed" in code (the entry always said "not worth fixing, cosmetic") - it simply
     cannot trigger anymore given where the project now lives. Noted here so a future maintainer doesn't
     go looking for a code fix that was never made, or worry it might silently reappear if the repo moves
     again to a space-containing path.
  3. **Open #7 (the cosmetic `_closure6` error on every failed task) - re-confirmed still reproduces exactly
     as documented, on the current Nextflow version (26.04.6), unchanged.** Deliberately triggered a real
     task-level failure (Kraken2 pointed at an empty-but-existing DB directory, not a config-time
     `checkIfExists` error - the two behave differently, and only a genuine task `FAILED` status exercises
     Nextflow's `notifyError`/`onError` path) and confirmed: (a) the `_closure6` error still appears
     verbatim, (b) the run-report is still written completely and correctly despite it (`Success: false`,
     full params/provenance dump - re-verified by reading the actual generated file, not assumed), and
     (c) `bin/debug.sh` still correctly finds and reports the real failure underneath the cosmetic noise.
     Nothing about this needs fixing - the original "deliberately not worked around" reasoning and its
     stated reopening threshold (masking a *different* error, or breaking exit-code correctness) both still
     hold; neither has happened.
  4. **Fixed #10 (bare CLI booleans like `--skip_kraken2 false` silently no-op under strict syntax) -
     re-confirmed still real and still correctly worked around.** Hit it firsthand re-running this exact
     audit (a bare `--skip_kraken2 false` test command ran as if Kraken2 was still off - confirmed by its
     absence from the executor list) before remembering to switch to `-params-file`, which worked
     immediately. `bin/run.sh` already only ever uses `-params-file` for exactly this reason, so normal use
     is unaffected - this only bites ad hoc CLI testing, same as when it was first found.
  5. **Fixed #2/#4 (`chattr +i` locks on `/etc/resolv.conf` and `~/.docker/config.json`) - reverified
     holding**, `lsattr` on both still shows the immutable bit set.
  6. **The WSL2 VM-lifecycle resilience gap (`docs/KNOWN_ISSUES.md`'s "WSL2 VM lifecycle..." entry below) -
     the recommended `vmIdleTimeout` setting in `%USERPROFILE%\.wslconfig` has still not been applied** (no
     `.wslconfig` file exists on this machine at all) - not a regression, this was always explicitly left
     for the owner to add themselves rather than silently applied, and still needs doing whenever
     "survives an unattended overnight run" actually matters in practice.

- **Composer UI prototype built and verified, 2026-09-13** (owner: "go ahead and do further testing, then
  select an option and start coding. no need for my input" - after PLAN.md §6.16's requirements list and
  tool shortlist). A real, separate React app at `composer-ui/` (not the Streamlit `ui/`), built on the
  already-shortlisted stack: React Flow (`@xyflow/react`) for the canvas, React Router v8 for navigation,
  react-i18next for French/English switching. Real vertical slice, not a mockup: a categorized draggable
  node palette listing this pipeline's actual tools (`workflows/microbox.nf`'s real stages, not invented
  examples), a working canvas (drag-drop, click-to-select with a detail panel, hover tooltips, connectable
  edges), a Composer + placeholder History page with a persistent nav bar, and live FR/EN switching covering
  every string including already-placed canvas nodes. **Genuinely tested, not just written and assumed to
  work**: real browser testing (`claude-in-chrome`) against the running dev server confirmed drag-and-drop
  actually creates a node at the drop position, clicking a node opens a real detail panel, switching to
  French live-updates every visible string (including a node already on the canvas, proving the i18n context
  covers dynamically rendered content, not just static chrome), and clicking "Run History" genuinely
  navigates (`http://localhost:5173/history`, a real URL change, not a fake tab switch). A new 13-test
  Vitest suite adds regression coverage a one-time manual check wouldn't: en/fr locale key-parity (catches
  a translation silently going missing before a human would notice it), every catalog tool resolving to
  real translated text in both languages, the language toggle asserted to actually change rendered text (not
  just a button's visual state), and route navigation asserted to actually swap the rendered page. `tsc -b`
  and `oxlint` both clean (one real type error and one real lint warning found and fixed along the way - an
  unsound cast fixed properly instead of asserted away, and a fast-refresh-incompatible export moved to
  where it's actually used). `npm run build` succeeds. **Real friction hit and fixed while building this**:
  the first attempt to start the dev server in the background died silently the moment the launching shell
  session ended - the exact same "nohup+& alone isn't enough without a persistent connection" lesson this
  project already learned once for `bin/run-ui.sh` (`docs/KNOWN_ISSUES.md`'s WSL2 VM-lifecycle entry) - fixed
  by using the Bash tool's own backgrounding mechanism instead of a bare `nohup ... &`, not by re-learning the
  lesson from scratch. **Deliberately does NOT do yet** (see `composer-ui/README.md` for the full list, not
  duplicated here): no backend connection to actually run anything, no save/load of a pipeline configuration,
  no type-compatibility enforcement between connected nodes, History is a real route but fake data. Full
  writeup: `docs/planning/PLAN.md` §6.16.

- **Composer UI layout corrected + Save/Run buttons + a Home page added, 2026-09-13** (owner testing the
  prototype above the same day: "i dont see a save or run button, im not able to read the zoom in zoomout
  buttons, i dont see a navigation menu, i was [thinking] the pipeline composer would be in the right side,
  while a similar menu will be on the left side to move between pages... run history is its own page, one
  home page would have whats currently running"). Four real, distinct findings from actually clicking
  through the first pass, not from re-reading the requirements - the requirements list in PLAN.md §6.16
  already said "navigation menu... menu on the right to select nodes," and the first build had it backwards
  (a single top bar, palette on the left) - a genuine implementation mistake, corrected, not new scope:
  1. **Layout flipped**: a new `PageNav` (left sidebar - Home/Composer/Run History) replaces the old
     top-bar's page links; the node palette moved to the right side of the Composer page; a slimmer `TopBar`
     now holds only the brand and the French/English toggle (kept reachable from every page, not folded into
     the page-nav list).
  2. **Zoom controls unreadable - a real bug, not a misunderstanding.** React Flow's `Controls` component
     defaults to a light theme; this app never told it otherwise, so the zoom/fit-view/lock icons rendered
     in colors that didn't contrast against this app's dark canvas. Fixed with React Flow's own built-in
     `colorMode="dark"` prop on `<ReactFlow>` - the documented mechanism for exactly this (verified live
     against `reactflow.dev`'s dark-mode example before using it, not guessed) - which also themes
     `Background`/`MiniMap` consistently, not just `Controls`.
  3. **Save and Run buttons added to the Composer toolbar.** Save is genuinely functional today - downloads
     a JSON snapshot of the canvas (node ids/types/positions/data, edge connections) via `Blob` + `<a
     download>`, verified to execute without error. This is a real first step toward §6.11's full
     export/import fidelity requirement, not the finished feature - no per-node parameter editing exists yet
     to serialize, and there is no Import/load path. Run is visible but genuinely `disabled` (confirmed via
     the DOM, not just visually assumed - `disabled: true`, computed `opacity: 0.5`), with a tooltip
     explaining there's no backend yet - an honest disabled state beats a missing button or a button that
     silently does nothing.
  4. **A new Home page** (`/`, the new default route - Composer moved to `/composer`) with a "Currently
     running" section - honestly empty, since there's still no backend to report real runs from, same
     placeholder pattern as History rather than inventing fake run data to look more finished than it is.
  Test suite grew from 13 to 17 (new `PageNav`/`TopBar`/`HomePage` tests, `App.test.tsx` updated for the new
  route shape) - all green, plus a clean `tsc -b`/`oxlint`/production build. **Real bug hit and fixed along
  the way**: after bulk-syncing the changed files from Windows to WSL (this project's established dual-copy
  workflow), Vite's dev server threw a stale-HMR `SyntaxError` claiming `PipelineCanvas` wasn't exported,
  even though it genuinely was - a Vite dev-server cache staleness issue from many files changing
  near-simultaneously via the `tar`-based sync, not a real code bug. Fixed by clearing `node_modules/.vite`
  and restarting fresh rather than chasing a phantom export bug. **Re-verified live in-browser after every
  fix**, not just re-run through the test suite: real drag-drop onto the now-center canvas, the floating
  detail panel positioned correctly over the canvas (not competing with the right-side palette for space),
  the French toggle correctly relabeling the new Save ("Enregistrer")/Run ("Lancer") buttons and the new
  page-nav links, and the zoom controls' icons genuinely legible against the dark canvas this time. Full
  writeup: `composer-ui/README.md`.

- **Composer canvas: connect nodes from any side, not just left-to-right, 2026-09-13** (owner, after testing
  the layout fix above: "i would love to be able to connect the nodes from up and down, and left and right.
  not just left and right"). Each `ToolNode` previously had exactly one target handle (left) and one source
  handle (right) - a real, if unstated, limitation of the first pass. Verified React Flow's own documented
  multi-handle pattern live (`reactflow.dev`'s Handles guide plus a real GitHub discussion on 8-handle nodes)
  before implementing, rather than guessing: every handle needs a unique `id` so an edge can record exactly
  which one it's attached to. Added both a source and a target handle on all four sides (8 handles per node)
  - target (blue) and source (green) on each side are offset slightly apart via explicit inline `style`
  (not React Flow's internal, undocumented `data-handlepos` attribute, to stay stable across future library
  upgrades) so both remain individually grabbable rather than exactly overlapping. **Verified for real**: a
  genuine vertical connection drawn in-browser between two stacked nodes (bottom-source of one to
  top-target of the other), confirmed present in the rendered DOM afterward (1 edge, 16 handles = 8 × 2
  nodes) - not just "the code compiles." New `ToolNode.test.tsx` (rendered through a real `ReactFlow`
  instance with real `nodeTypes`, not hand-constructed internal props, so it exercises the same code path
  the app actually uses) asserts all 8 handle ids exist with the right source/target split - test suite
  grew from 17 to 18, all green, clean `tsc -b`/`oxlint`/production build.

- **Composer canvas corrected to 4 fixed-direction handles + self-connection block + deletable edges + real
  per-node param editing, 2026-09-13** (owner, same day as the 8-handle change above, after actually seeing
  it: "why does each node have green and blue connection points? i only asked for 4 in total, not 8... we
  assume both the left and top are connections to previous nodes, while bottom and right are connection to
  the next nodes. and also make sure a node can't connect to itself. and when clicking a node connection we
  have an X to delete the connection. and also when clicking a node we can edit its parameters."). The prior
  pass over-built 8 handles (source+target pair per side) when the actual ask was 4, with a fixed semantic
  role per side. **Fix**: `ToolNode.tsx` now renders exactly one handle per side — top/left always `target`
  (incoming), right/bottom always `source` (outgoing); `ToolNode.test.tsx` rewritten to assert exactly 4.
  Self-connection is now rejected via `src/utils/isValidConnection.ts` passed to `<ReactFlow
  isValidConnection>` (`connection.source !== connection.target`), unit-tested and confirmed live (dragging a
  node's own handle back onto itself produces no edge). A new `DeletableEdge` component
  (`src/components/DeletableEdge.tsx`) shows an "×" button at a selected edge's midpoint that removes just
  that edge via `useReactFlow().deleteElements`. Per-node parameter editing was added to the existing
  click-to-select detail panel: real params grounded in actual `nextflow.config` values (`bowtie2` →
  `host_fasta`, `kraken2` → `kraken2_db`, `genomad` → `genomad_db`, `checkv` → `checkv_db`), stored per-node
  (not per-tool, since two instances of the same tool can hold different values) via a new pure
  `updateNodeParam` merge function. **Two real jsdom ceilings hit and accepted, not chased further**: edges
  cannot be rendered in jsdom at all (even after stubbing `ResizeObserver` and `DOMMatrixReadOnly` — a
  `DeletableEdge.test.tsx` was written, confirmed to hit this, and deleted), and node click-to-select cannot
  be simulated in jsdom (`setPointerCapture` is unimplemented there) — both covered instead by extracting the
  pure logic into directly-testable functions plus live-browser verification, the same pattern this codebase
  already used for drag-and-drop. **Verified for real in-browser**: exactly 4 handles with correct fixed
  roles, self-connection blocked, a genuine cross-node connection (fastp→Kraken2) confirmed in the DOM, two
  separate edges landing on the same target handle confirmed in the DOM (multi-edge-per-handle), the "×"
  button confirmed to remove only the targeted edge (DOM edge list shrank from 2 to 1, the other survived),
  and typing into Kraken2's DB-path field genuinely retaining the value. Test suite grew from 18 to 25.

- **Node sizing/resize + a real connection-color bug, found same day testing the above, 2026-09-13** (owner:
  "sometimes the connection colors desapeared, the nodes should all have the same size by default no matter
  their content. allow the user to rezise the nodes."). Three real issues, not one: (1) **handle colors
  intermittently reverted to React Flow's own default grey** — root cause found by reading the library's own
  `base.css`: `.react-flow__handle { background-color: var(--xy-handle-background-color, ...) }` is the same
  specificity as this project's `.tool-node__handle--target`/`--source` rules and also governs the library's
  own `.connectingfrom`/`.connectionindicator` states during an active connection drag, so our colors could
  lose the cascade mid-drag. **Fix:** `!important` on both color rules in `ToolNode.css`, with a comment
  explaining the specific collision it answers (not a habit). Verified fixed by adding those state classes to
  a live handle via script and confirming the computed background color held. (2) **Node width varied with
  content** — a node's box grew to fit its longest label, so two different tools rendered at visibly
  different sizes. **Fix:** every new node now gets an explicit default `width`/`height` (180×68,
  `PipelineCanvas.tsx`'s `DEFAULT_NODE_WIDTH`/`DEFAULT_NODE_HEIGHT`) that `ToolNode`'s CSS fills at
  100%/100%, with overflowing category/name text ellipsis-truncated instead of growing the box. Verified
  in-browser: fastp and Kraken2 (very different label lengths) now render at pixel-identical size. (3) **no
  way to resize a node** — added React Flow's own `<NodeResizer isVisible={selected} minWidth={120}
  minHeight={56} />` inside `ToolNode.tsx`, so selecting a node reveals drag handles; resizing persists
  through the normal `onNodesChange` stream onto `node.width`/`node.height`, the same mechanism a position
  drag already uses — no new state-management code needed. Verified in-browser: dragging a corner handle
  visibly enlarged the node and the new size held after deselecting. Owner also asked for "many quality of
  life elements when it comes to the ui" without specifying which — flagged as an open, unscoped item rather
  than guessed at (resolved same day, see next entry).

- **Composer UI QoL pass: undo/redo, multi-select + bulk move/delete, Delete key + duplicate-node,
  2026-09-13** (owner picked these three, out of a candidate list offered in response to the open-ended
  "many quality of life elements" ask above; snap-to-grid and a minimap were offered too but not picked).
  **Undo/redo**: a plain past/future snapshot-array pair (`src/utils/history.ts`, unit-tested) - a snapshot
  is taken right before each user-initiated structural edit (node add via palette drop, delete, duplicate,
  connect, node/selection drag-start), not on every low-level `onNodesChange` call, which would otherwise
  push a new entry per pixel of a drag. `Ctrl/Cmd+Z`/`Ctrl/Cmd+Shift+Z` (also `Ctrl/Cmd+Y`) plus visible
  Undo/Redo toolbar buttons that disable themselves when there's nothing to undo/redo - buttons, not just a
  keyboard shortcut, per this same project's own earlier lesson ("i dont see a save or run button") that
  hidden-until-you-know-it controls get missed. Deliberately does not yet cover in-progress param edits or
  node resizing - a documented scope cut. **Delete key + duplicate**: `deleteKeyCode={['Backspace',
  'Delete']}` (React Flow's own default is Backspace only); a "Duplicate" button in the node detail panel
  clones the selected node's tool + params (not its connections) at a small position offset, using a new
  shared `src/utils/nodeId.ts` counter so the palette-drop and duplicate creation paths can never collide on
  an id. **Multi-select + bulk move/delete**: came essentially free from React Flow's own defaults
  (Ctrl/Cmd-click to add to selection, Shift-drag an empty area to box-select; dragging any selected node
  moves the whole selection; Delete removes every selected node/edge as one operation) - the only code needed
  was wiring the delete/history hooks already built for the single-node case. **Real testing-tool gotcha
  found verifying this (not an app bug)**: simulating "Ctrl+click" via a modifier flag on one synthetic click
  event does not trigger React Flow's multi-select, because it tracks the modifier key through its own real
  `keydown`/`keyup` listener on `window` (confirmed by reading `@xyflow/react`'s own source -
  `useGlobalKeyHandler`/`useKeyPress`), which a single click event's `ctrlKey` flag never fires. Confirmed
  multi-select genuinely works in the app by dispatching real `keydown`/`keyup` events around the clicks
  instead. **Verified for real in-browser**: Undo/Redo buttons toggling their own disabled state correctly
  and genuinely adding/removing a node on click; Duplicate creating a real second, independent node (2
  distinct DOM node ids); Delete removing a selected node and closing its now-stale detail panel; a genuine
  multi-selection (both nodes' `selected` class true in the DOM) confirmed draggable together and
  bulk-deletable as a single undo step (one Undo click restored both). Test suite grew from 25 to 31.

- **Pavian added to the composer canvas's node palette, 2026-09-13** (owner: "i noticed that pavian is not
  there yet.... add it! i would love to see it in the pipeline!"). Pavian (`bin/run-pavian.sh` +
  `docker-compose.yml`, added earlier this project as a standalone report viewer - see "Pavian added"
  above) was never in `composer-ui/src/data/toolCatalog.ts` because it's deliberately **not** a
  `workflows/microbox.nf` DAG step (PLAN.md §6.6 item 2 - it only reads an existing run's
  `results/kraken2`/`results/bracken` output, it processes nothing itself). Added anyway, in the same
  "reporting" category as MultiQC, since the catalog's actual job is representing every real tool this
  project has for the owner to place on a canvas, not strictly mirroring the Nextflow DAG one-for-one -
  confirmed via `bin/run-pavian.sh`'s own header comment rather than assumed. Verified live in-browser:
  Pavian appears under "Rapport"/"Reporting" with a real FR/EN-translated description and drops onto the
  canvas as a normal 4-handle node like every other tool. Test suite unaffected (31/31 still pass, the
  generic i18n-key-resolution test in `toolCatalog.test.ts` covers any newly added tool automatically).

- **Composer canvas: connections validated against the real pipeline's fixed backbone, 2026-09-13** (owner,
  looking at a saved canvas export with 10 nodes and branching/merging connections: "in this pipeline for
  example, i would expect 3 different results, right?... doesnt each node have a set of parametres... i see
  only input field for paths"). Answering that surfaced the actual, more important gap: `workflows/
  microbox.nf` is a **fixed backbone** with independently skippable stages, not a freely reorderable/
  mergeable DAG (already documented above, "Full toolbox combinatorics enumerated" entry) - but the composer
  canvas let a user draw ANY connection with zero validation, including several from the owner's own real
  saved graph that the pipeline structurally cannot execute: QUAST → MaxBin2 (QUAST's output is a terminal
  report, MaxBin2 needs contigs+reads directly from the assembler/Bowtie2), and FastQC feeding Kraken2 in
  parallel with the fastp→Bowtie2 branch (FastQC's output is a report, nothing downstream). Also confirmed
  by reading `nextflow.config` directly, in response to the params question: the only non-boolean per-tool
  params in the whole pipeline ARE `host_fasta`/`kraken2_db`/`genomad_db`/`checkv_db` - all paths - so the
  composer's param panel (added in the earlier 2026-09-13 round) was already a faithful, complete mirror of
  what's real, not an under-built UI; nothing needed to change there. **Fix**: `src/data/
  pipelineTopology.ts` - a hardcoded `Record<toolId, toolId[]>` "what can actually feed what" map, each
  entry citing the specific `workflows/microbox.nf` channel-wiring behavior it's grounded in (not guessed
  from tool names - e.g. MEGAHIT → Kraken2 looks plausible but is NEVER valid: fastq-entry Kraken2 always
  classifies `ch_depleted_reads`, never an assembler's contigs, confirmed by reading the
  `ch_classify_input_raw` ternary directly). `src/utils/validatePipeline.ts`'s pure, unit-tested
  `findInvalidEdges()` checks every drawn edge against it; `ComposerPage.tsx` computes this via `useMemo` and
  renders invalid edges as a dashed-amber line (`DeletableEdge.tsx`'s `data.invalid`, injected into a
  render-only copy of the edges array in `PipelineCanvas.tsx` - never into the real edges state, so it never
  leaks into the Save snapshot or undo/redo history) plus a translated, non-blocking warning banner above
  the canvas listing each bad connection by tool name. Deliberately does NOT check whether a node has ALL
  the inputs it needs (MaxBin2 genuinely requires both a contigs edge AND a reads edge simultaneously -
  `ch_contigs.join(ch_depleted_reads)` - a node fed only one would still fail for real) - a documented, known
  gap, not an oversight; this pass only checks "is each individual drawn connection real," which is what was
  asked for and what actually caught the mistakes in the owner's own graph. **Verified for real**: recreated
  the exact QUAST → MaxBin2 connection from the owner's saved export live in-browser - the dashed-amber edge
  and the warning banner ("1 connection doesn't match how the real pipeline works: QUAST → MaxBin2") both
  appeared immediately on drawing it. Test suite grew from 31 to 38 (7 new tests covering real dependencies,
  plausible-but-wrong ones, unknown-endpoint edges, and no-incoming-edge nodes).

- **Composer canvas: node state visibility + Save/Import fidelity, 2026-09-13** (owner: "go ahead and
  continue building as per the plan. and test aswell. i ll be afk, take all the decisions yourself" —
  worked from `docs/planning/PLAN.md` §6.11's own explicit, still-open Must-haves rather than guessing at
  scope). Three pieces:
  1. **Node state visible on the canvas, not just the detail panel** — §6.11: "node state
     (enabled/skipped/incompatible-connection) needs to be visible, not just silently enforced," and "nodes
     need a visual distinction between default and user-overridden parameters." Added an "Enabled" checkbox
     per node (`src/utils/toggleNodeEnabled.ts`, unit-tested) - a disabled node renders dimmed with a
     "Skipped" badge directly on `ToolNode.tsx`, independent of selection. Any tool with a real param set
     away from empty shows a small amber dot next to its name. The hover tooltip now includes every
     currently-set param's *current value*, not just the static description - §6.11 explicitly: "tooltips
     should show current values, not defaults."
  2. **A real Save/Import round trip, PLAN.md §6.11's single largest remaining open Must-have** ("save/
     import/export a pipeline configuration as a portable file... reconstruct the pipeline exactly as if it
     had been built there natively"). `src/utils/importCanvasSnapshot.ts` (pure, unit-tested) parses and
     validates a saved JSON file and **rejects the whole thing** on any structural problem (invalid JSON,
     wrong `formatVersion`, an unknown tool id, malformed node/edge shape) - §6.11: "a malformed or hostile
     file shouldn't be trusted blindly." Every imported node gets a fresh id via the same counter the
     palette-drop/duplicate paths already use (`src/utils/nodeId.ts`) rather than trusting the file's own
     ids, which could otherwise collide with the current session's own counter; edges are rebuilt through
     React Flow's own `addEdge()` utility (the same one `onConnect` uses), not a hand-rolled id scheme.
     Import replaces the whole canvas (a deliberate "Load a file" action) but takes an undo-history snapshot
     first, so one Ctrl+Z recovers the pre-import canvas - confirmed live. A translated, non-blocking error
     banner reports why a bad file was rejected.
  3. **A real fidelity bug found and fixed while building Import, not caught by testing Save in isolation**:
     `downloadCanvasSnapshot` silently dropped `width`/`height` and each edge's `sourceHandle`/`targetHandle`
     entirely. Since every `ToolNode` has 4 handles, an edge missing which one it used would have silently
     rendered from whichever handle React Flow finds first on import - confirmed by reading
     `@xyflow/system`'s own source (`getHandle$1`: `"if no handleId is given, we use the first handle"`),
     not a crash, just a silently wrong-looking reconstruction of the connection actually drawn. This kind
     of bug is structurally invisible until something tries to read the exported data back - exactly why it
     surfaced now and not when Save was first built. Fixed by including both in the export.
  **Verified for real in-browser, not just unit-tested**: dropped a Kraken2 node, set its `kraken2_db` param,
  toggled it disabled, confirmed the dimmed+badge+dot rendering; exported a real 2-node/1-edge canvas,
  re-imported it via a genuine `File`+`DataTransfer` dispatched to the actual file input (not simulated -
  browser automation can't drive an OS file picker directly either way, so this is the equivalent real
  browser-API call scripted instead of clicked), and confirmed position/size/params/enabled state/edge
  handles all round-tripped exactly; confirmed a deliberately malformed file is rejected with a clear message
  and leaves the canvas untouched; confirmed Ctrl+Z after a successful import restores the pre-import canvas.
  **Also found while implementing**: `npx tsc --noEmit` (used throughout this session as the quick typecheck)
  missed a real type error that only `npm run build`'s `tsc -b` (the project-reference build, presumably
  resolving a different/stricter tsconfig) caught - `Object.fromEntries` losing type narrowing through a
  `.filter()` callback without an explicit type-predicate signature. Worth remembering: `tsc --noEmit` alone
  is not sufficient verification for this project going forward, only a real `npm run build`. Test suite grew
  from 38 to 56 (18 new tests: `toggleNodeEnabled.test.ts`, `importCanvasSnapshot.test.ts`, and 4 new
  `ToolNode.test.tsx` cases for the disabled/override-dot rendering).

- **Composer node palette: search/filter, 2026-09-13** (continuing "as per the plan" per the owner's
  standing authorization, while AFK - PLAN.md §6.16's node-palette nice-to-have, "search/filter within the
  palette," picked as the next well-scoped item now that the catalog has grown to 13 tools across 7
  categories). `src/utils/paletteSearch.ts` (`matchesSearch`, pure, unit-tested) does a case-insensitive
  substring match against the CURRENT language's translated tool name and description - not the English
  source strings or raw tool id, so a French speaker searching in French matches French text. `NodePalette.tsx`
  filters each category's tools against the live query, hides any category left with zero matches entirely
  (rather than an empty header), and shows a translated "no tools match" message when nothing does at all.
  **Verified live in-browser, in both languages**: typing "kraken" surfaced Kraken2, Bracken, and Pavian
  together (a real description-text match, not just the literal "Kraken2" card - Bracken/Pavian's
  descriptions both mention Kraken2), with every non-matching category hidden; typing "classification" in
  French matched the French category name and Kraken2's French description; an unmatchable query showed
  "Aucun outil ne correspond à votre recherche." / "No tools match your search."; the clear "×" button
  restored the full list. Test suite grew from 56 to 62.

- **Owner feedback: browser download-confirmation prompts block while AFK, 2026-09-13** ("continue, the only
  issue is that when you download something i need to be here to press the yes on the confirmation
  dialogue"). The browser-automation extension gates actual file downloads (e.g. clicking the Composer's
  real Save button) behind a permission prompt, which nobody can answer while the owner is away - not a bug
  in this project's code, a real constraint of the automation tooling used to test it. **Working around it
  going forward, not fixing it** (nothing to fix - it's a legitimate safety gate): verify Save/export
  behavior by intercepting `URL.createObjectURL` via a script and reading the `Blob` content directly (as
  already done for the Save→Import round-trip test above), never by actually clicking the button through to
  a real completed download. No functional change to the app.

- **Composer canvas: collapsible palette categories, more keyboard shortcuts, circular undo/redo icons, and
  a real selection-highlight bug fixed, 2026-09-13** (owner, mid-session: "instead of annuler and rétablir,
  its better to have the arrow back and arrow forward. not the straight ones but the circular ones that mean
  back and forth cycle. i assume ctrl+c or x or z or r are working. and many other things"). Four pieces:
  1. **Collapsible category groups** (PLAN.md §6.16's other node-palette nice-to-have, alongside last round's
     search) - each category header is now also a collapse/expand toggle with a rotating chevron. Collapse
     is purely visual state: a collapsed category's tools still surface the moment a search matches them,
     rather than staying hidden - search overrides collapse, not the other way around.
  2. **Undo/Redo are now circular-arrow icon buttons** (↺/↻) instead of "Annuler"/"Rétablir" text, per the
     owner's exact description - `aria-label` + a combined action-name-plus-shortcut tooltip carry the
     accessible name now that there's no visible text.
  3. **Ctrl/Cmd+D (duplicate), C/X/V (copy/cut/paste), and Escape (close panel)** - the owner assumed C/X/V
     already worked; they didn't, built rather than left as a false assumption. Scoped to the single selected
     node, same as the existing Duplicate button, not the whole multi-selection - a deliberate consistency
     choice. Copy/cut use a component-state clipboard, not the real OS one (no cross-tab requirement here,
     and the Clipboard API needs its own permission prompt for no benefit); repeated pastes from the same
     copy stagger 24px apart rather than stacking exactly on top of each other. Ctrl+C deliberately does NOT
     intercept when the browser has an active text selection elsewhere on the page, so selecting ordinary
     page text and copying it still works normally even with a node also selected. **Deliberately NOT bound:
     Ctrl/Cmd+R** - hijacking browser refresh is a materially more invasive choice than shadowing the other
     shortcuts above (none of which have a real everyday use inside this SPA); left alone with no specific
     feature to map it to, not an oversight.
  4. **A real, previously-unnoticed selection-highlight bug found and fixed while testing paste**:
     Duplicate/Paste/Undo/Redo/Escape/Close all update this app's own `selectedNodeId` tracker (correctly
     driving the detail panel's content) but were never updating each node's own React-Flow-level `.selected`
     boolean - the thing that actually drives the blue border/resize-handle overlay on the canvas via
     `NodeProps.selected`. A real node click doesn't hit this (React Flow dispatches its own internal
     selection change automatically on click, which our own `nodes` state already receives through
     `onNodesChange`); only this app's own PROGRAMMATIC selection changes bypassed it. Concretely: paste
     twice, and the detail panel correctly showed the newest pasted node's info while the canvas kept the
     blue highlight on the original node - confirmed via the DOM (`node-1: selected=true` after the panel had
     already moved to `node-3`), not just eyeballed. **Fix**: a shared `withNoSelection` (clears every node's
     `.selected` in one pass, skips the update entirely if nothing needs to change) plus `clearSelection`
     helper, used everywhere this file changes the selection outside of a genuine click - Duplicate and Paste
     now explicitly select their new node while deselecting everything else in the same `setNodes` call;
     Undo/Redo/Escape/Close now clear `.selected` alongside `selectedNodeId`. **Verified live in-browser,
     re-checked via the DOM after the fix** (not unit-tested - all of these need a selected node, which needs
     React Flow's click-to-select, the same jsdom limitation already documented): copy-then-paste-twice now
     shows the canvas highlight correctly following the newest paste (`node-1: false`, newest node: `true`);
     Escape closes the panel and fully clears the border; Ctrl+D creates a real second node without
     triggering the browser's own bookmark dialog. Test suite grew from 62 to 64 (2 new `NodePalette.test.tsx`
     cases for collapse/expand; copy/cut/paste/Escape/the selection fix aren't unit-tested, for the reason
     above).

- **Kraken2 database-variant selector with a hardware-based recommendation, 2026-09-13** (owner, same session:
  "when it comes to kraken, it would be nice to let the user select which version they want, and have one
  written as (recommended) based on their hardware. we automatically detect their hardware capabilities.").
  Grounded in real project research rather than invented: `src/data/kraken2DbVariants.ts` lists the four
  variants that are either already downloadable via `bin/download-dbs.sh` (Viral, Standard-8 - `wired: true`,
  checked directly against that script's own case statement) or are documented near-term production
  candidates from `docs/planning/PLAN.md` §2.3's own researched table (Standard-16, PlusPF-16 - `wired:
  false`, since the script's case statement explicitly rejects them today: "isn't wired up yet"). Each
  variant's RAM figure is the table's real `hash.k2d` size (0.6 / 7.45 / 14.9 / 14.9 GiB), not guessed. A
  "Use this path" button (shown only for the two wired variants - offering a path for a DB nothing can fetch
  yet would be actively misleading) fills the real `kraken2_db` field with `bin/download-dbs.sh`'s own
  conventional extract-path convention (`~/microbox-dbs/kraken2/<variant>`, read directly from the script's
  `DEFAULT_TARGET_DIR`/`EXTRACT_DIR` logic) - a copyable convention, not a claim this browser app can see the
  user's real filesystem.
  **On "we automatically detect their hardware capabilities" - answered honestly, not with a fake
  reading**: a browser cannot read a machine's real total RAM. The one API that exists,
  `navigator.deviceMemory`, is Chromium-only and deliberately rounds to a power of two AND CAPS AT 8 for
  privacy - a machine with 8, 16, 64, or 256 GiB of RAM all report the identical "8"
  (developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory, cited in `src/utils/
  estimateDeviceMemory.ts`). That cap makes it structurally unable to distinguish the exact cases this
  feature's bigger recommendations (14.9+ GiB variants) depend on - used here ONLY to pre-fill a plainly
  editable "Available RAM" input, never shown as authoritative; when the API isn't supported at all
  (Firefox/Safari), the field starts empty with an honest message instead of a guessed number.
  `src/utils/recommendKraken2Db.ts` (pure, unit-tested) recommends the largest variant whose RAM requirement
  is at most **half** of the given figure - a deliberately conservative margin grounded in this project's
  own real finding, not an arbitrary number: on the actual 11 GiB VM this project tested on, the 7.45 GiB
  Standard-8 DB did classify correctly, but only completely alone - running it alongside a real MEGAHIT
  assembly OOM-killed the assembly (Docker exit 137, already documented under "Real-data validation" /
  PLAN.md §2.3). That's ~68% utilization already proven too tight for a real run with other concurrent
  stages; the recommendation logic's tests explicitly encode this exact case (an 11 GiB input still only
  recommends the tiny Viral DB, not Standard-8, under the 50% rule) so the conservatism isn't just described
  in a comment, it's asserted. **Verified live in-browser**: the real (Chromium-reported) `navigator.
  deviceMemory` of 4 on the dev machine correctly pre-filled the RAM field and recommended Viral; editing it
  to 32 live-updated the recommendation to Standard-16, still correctly marked "not yet downloadable"
  (`PAS ENCORE TÉLÉCHARGEABLE`, confirmed in French); clicking "Use this path" on Viral genuinely filled the
  real path field with `~/microbox-dbs/kraken2/viral` and the node's override dot appeared - a real update to
  that node's actual param, not a cosmetic suggestion. Deliberately scoped to Kraken2 only (matches "when it
  comes to kraken" exactly) - geNomad/CheckV/Bowtie2 have their own DB/reference paths but don't get this
  treatment; the same pattern would generalize if asked for. Test suite grew from 64 to 72.

- **Composer canvas: Auto-arrange, 2026-09-13** (owner: "go ahead and keep going. do not stop to update me
  until i interrupt you" - continuing per PLAN.md §6.16's own canvas nice-to-have list, "auto-layout/auto-
  arrange," the one item left unbuilt from that list once minimap/snap-to-grid were explicitly declined,
  Open #8). `src/utils/autoLayout.ts` (`computeAutoLayout`, pure, unit-tested) hand-rolls a simple left-to-
  right layered layout rather than pulling in a graph-layout library (dagre/elkjs) - this toolbox is bounded
  to ~20 nodes (PLAN.md §6.7/§6.10's own framing), and a real dependency decision (which library, its
  bundle-size cost, one more thing to keep updated) isn't worth it for a layout this simple. Each node's
  column is the LONGEST path from any root to it, so a node fed by two branches at different depths lands
  after both, never overlapping a predecessor; a rootless node is column 0 - a normal, valid state on this
  canvas (every reads-stage in the real pipeline is independently skippable), not an error case. The
  composer doesn't forbid drawing a cycle even though `src/utils/validatePipeline.ts` already separately
  flags it as something the real pipeline can't execute - since a cycle can't be topologically layered by
  definition, any node still unresolved once nothing else can move is placed in column 0 alongside the real
  roots, rather than looping forever chasing an ordering that doesn't exist (a real Kahn's-algorithm-style
  termination condition, not just "assume it terminates"). Only repositions nodes - connections, params, and
  enabled state are untouched - and takes a history snapshot first like every other mutation in this file.
  **Verified live in-browser, not just unit-tested**: dropped two nodes at scattered positions, connected
  them, clicked Auto-arrange, and confirmed via each node's actual CSS transform (not eyeballed) that they
  landed at exactly `(0, 0)` and `(260, 0)` - one column apart, matching `COLUMN_WIDTH`; one press of Undo
  restored the original scattered positions exactly. Test suite grew from 72 to 78.

- **Ctrl+Z/Ctrl+Y double-checked at the owner's request, 2026-09-13 ("ctrl y and ctrl z?") - confirmed
  already correct, no bug found.** Investigated because an earlier live-browser check that session appeared
  to show Ctrl+Y doing nothing after an undo. Root-caused via targeted debug logging (temporarily added
  and removed from `ComposerPage.tsx`) plus step-by-step DOM state checks: the apparent failure was entirely
  caused by this session's own already-documented flaky-drag-and-drop issue in browser automation - the node
  drop itself had silently failed each time, so there was genuinely nothing in `history.past` to undo and
  nothing in `history.future` to redo; both buttons being disabled was the CORRECT behavior, not a bug.
  Re-verified with a confirmed-successful drop: Ctrl+Z correctly undoes, Ctrl+Y correctly redoes, both via
  keyboard and via directly clicking the Undo/Redo buttons, in a full undo→redo→undo cycle checked against
  both the DOM node count and each button's own `disabled` state at every step. No code change - this entry
  exists so a future reader doesn't waste time re-investigating a report that traces back to test-tooling
  flakiness, not the app.

- **Full toolbox combinatorics enumerated and tested, 2026-09-11 — revised same day after owner pushback (see #16 above).** The engine is a fixed backbone (fastp→FastQC→Bowtie2→MEGAHIT for `fastq`; nothing but Kraken2/QUAST for `contigs`), **not** a freely-reorderable graph (matches `docs/planning/PLAN.md` §6.10's Option A finding) — a single-tool pipeline (e.g. Kraken2 alone) works via `input_type=contigs` + `skip_quast=true` (or, since #16, the fastq-entry equivalent) only because that combination was explicitly wired, not because arbitrary node graphs are supported. First pass under-scoped the toggle count (4 flags, fastp/FastQC/MEGAHIT hardcoded on) and landed on 16 total configs; corrected same day once those three became genuinely independent toggles: **72 `fastq`-entry configurations + 4 `contigs`-entry configurations = 76 total** (PLAN.md §6.13 has the exact arithmetic). Not exhaustively tested one-by-one — no major bioinformatics test suite does that either — but every flag is toggled independently at least once and every cascading auto-skip interaction is exercised at least once in `tests/main.nf.test` (`basic` + `requires_db` tags).

- **Composer canvas: imported edges silently failed to render, 2026-09-13 — found via self-initiated integration
  testing** (owner: "go ahead and keep going... do not stop to update me until i interrupt you" - building a real
  multi-node chain, disabling a node, setting a param, exporting, and re-importing it together was judged the
  highest-value next check, the same technique that caught the selection-highlight bug earlier this session).
  Exporting a real fastp→Bowtie2(disabled)→Kraken2(`kraken2_db` set) chain and re-importing that exact file
  produced 3 correctly-remapped nodes but **zero edges in the DOM**, even though `parseCanvasSnapshot` returned
  the correct edges (verified via a standalone Vitest reproduction) and React's own `edges` state genuinely held
  them (verified via a temporary tracer `useEffect`) - waiting 3+ seconds, forcing a re-render via Auto-arrange,
  and a 50ms-delayed `setEdges` call all failed to fix it, ruling out a simple timing race. **Root cause, found by
  reading React Flow's own bundled source (`@xyflow/react`/`@xyflow/system`):** an edge only renders once React
  Flow has measured its endpoint nodes' real handle positions (`internals.handleBounds`, `isNodeInitialized()` in
  `@xyflow/system`) - a background `ResizeObserver` pass that happens after mount. A palette-dropped node always
  gets a human-timescale gap before the user draws a connection to it, so this measurement lands first; import
  sets brand-new nodes AND the edges connecting them in the same operation, giving `getEdgePosition()` nothing to
  work with on the edge's very first render - and, confirmed by live testing, it silently never re-evaluates
  afterward either (returns `null` with no console warning, by design - `error008` only fires for an unresolvable
  *handle*, not for an uninitialized node). **Fix:** `src/data/nodeDefaults.ts` adds `defaultNodeHandles(width,
  height)`, using React Flow's own documented escape hatch for exactly this (`Node.handles`) to pre-declare
  approximate handle positions (mirroring `ToolNode.tsx`'s fixed top/left-target, right/bottom-source layout) so
  `isNodeInitialized()` is true synchronously, with no measurement wait - the real `ResizeObserver` pass still
  runs afterward and silently overwrites this estimate with the pixel-exact one once it completes, since
  `internals.handleBounds` always takes precedence over `node.handles` when both exist. Applied in
  `importCanvasSnapshot.ts` (where the bug actually surfaces) and, for consistency/future-proofing, in
  `PipelineCanvas.tsx`'s palette-drop path too, since nothing guarantees that human-timescale gap will always
  exist. **Verified fixed live in-browser**, not just unit-tested: reproduced the exact failing 3-node scenario
  above via a real export→import round trip (a simulated file picked via a real `File`/`DataTransfer` dispatched
  to the actual file input, same technique as the original discovery) and confirmed both edges now render
  immediately, with the disabled badge and the param-override dot also correctly preserved. New regression
  coverage: `src/data/nodeDefaults.test.ts` (2 tests, the shape of `defaultNodeHandles`) and a 10th test in
  `src/utils/importCanvasSnapshot.test.ts` (every imported node carries exactly the 4 expected handle ids with
  finite coordinates) - the render-time behavior itself is browser-only and can't be jsdom-tested, same
  established split as every other React-Flow-interaction-dependent behavior in this project. Test suite grew
  from 78 to 81.

- **Composer canvas: connections silently failed to draw "sometimes," requiring repeated attempts, 2026-09-13**
  (owner: "why im having issues connecting fastqc to fastp ? sometimes the connection fails and i need to do
  it / try so many times"). Root-caused by reading React Flow's own bundled source
  (`@xyflow/system`'s `isValidHandle`): React Flow's default `connectionMode="strict"` (never explicitly set
  in this project before now) silently rejects any drag that starts and ends on two handles of the SAME
  declared role (target-to-target or source-to-source) - with **zero visual feedback explaining why**, not
  even a console warning. Every `ToolNode` always shows all 4 fixed-role handles at once (top/left target,
  right/bottom source, added 2026-09-13 per owner spec), so grabbing the "wrong" one by habit or visual
  proximity is easy and completely silent when it happens - reproduced and confirmed live: a drag from one
  node's target handle to another node's target handle created exactly 0 edges, every time, while the
  "correct" direction (source to target) worked every time from the identical two nodes.
  **First fix attempt (incomplete on its own):** setting `connectionMode="loose"` on `<ReactFlow>`
  (`PipelineCanvas.tsx`) lets a drag start from either handle role - but on its own this just traded one
  silent failure for another: a drag started from a target handle now DOES create a connection, but React
  Flow's own loose-mode logic assigns `sourceHandle`/`targetHandle` based on which end the drag started at,
  not which one is actually source-typed - so the resulting edge could end up with e.g. `sourceHandle: "left"`
  (a target-only id in this app's fixed scheme), which then fails to RENDER (confirmed live via a real
  console warning, `error008: Couldn't create edge for source handle id: "left"`) - same failure class as the
  2026-09-13 import bug, different root cause. **Real, complete fix:** two small, deterministic changes, since
  this app's 4 handle ids and their roles are fixed and globally known (`HANDLE_SIDES`, now the single shared
  source of truth in `src/data/nodeDefaults.ts` - `ToolNode.tsx` renders its actual handles from this same
  array instead of a separate local copy, closing a real duplication risk along the way):
  1. `src/utils/isValidConnection.ts` now also rejects a same-role pair (target-to-target/source-to-source) -
     genuinely ambiguous, no direction can be inferred, so this must still fail (cleanly, via React Flow's own
     validity check during the drag - the connection line just doesn't snap green - rather than creating a
     broken edge that silently never renders).
  2. `src/utils/normalizeConnection.ts` (new, unit-tested) swaps a mixed-role connection (one target, one
     source handle, dragged in either direction) back to the correct fixed direction before it's added to
     state, in `ComposerPage.tsx`'s `onConnect` - so a user who happens to grab the "wrong" end of a valid
     pair still gets a correctly-rendered, correctly-directed edge, not a failure.
  **Verified live in-browser, exactly reproducing the original bug report**: the identical target-to-target
  drag that previously created 0 edges is now correctly and cleanly rejected (still 0 edges, but this is now
  the genuinely correct behavior for an ambiguous gesture, not a bug); the same drag but ending on a SOURCE
  handle instead (started at a target, ended at a source - the "reverse" of the normal gesture) now succeeds
  and renders a correctly-directed edge, confirmed via its real edge id
  (`xy-edge__node-2right-node-1top` - source/sourceHandle correctly resolved to the actual source-typed
  handle regardless of which end was grabbed first); no `error008` warnings in the console for the new edge.
  New regression coverage: `src/utils/handleRole.test.ts` (3 tests), `src/utils/normalizeConnection.test.ts`
  (3 tests), plus 4 new cases in `src/utils/isValidConnection.test.ts`. Test suite grew from 81 to 91.

- **A genuine, real Nextflow pipeline addition: a second, independent Kraken2/Bracken pass BEFORE host
  depletion, 2026-09-13** (owner: "im not sure why fastqc into kraken2 shows an error. thats literarly what
  they be doing and the r&d team provided me as example of pipeline" - then supplied a photo of the actual
  reference diagram). Investigated by reading `workflows/microbox.nf` line by line before touching anything:
  the composer's warning was accurate for what the pipeline actually did at the time - FastQC only ever
  produces a report (nothing downstream consumes it but MultiQC), and Kraken2 only classified Bowtie2's
  depleted reads (fastq entry) or a contigs file (contigs entry). The photographed diagram clarified the real
  intent once read closely (owner: "dotted lines means its optional") - FastQC → Kraken2 is drawn as a
  SOLID/primary arrow, while the existing Bowtie2 → Kraken2 path is the DOTTED/optional one in that same
  diagram. So the gap wasn't a UI bug to silence, it was a real, missing pipeline capability - confirmed with
  the owner before touching `workflows/microbox.nf` (a real architecture decision, not a quick edit), who
  chose "add it to the real pipeline" over just relaxing the composer's validation.
  **What was built**, following the exact same pattern as MaxBin2/geNomad/CheckV/metaSPAdes (a genuine new
  toggle, real module wiring, real test coverage, not a shortcut): a NEW, fully independent classification
  pass, `params.skip_kraken2_predepletion` (default `true`, same DB-dependency reasoning as `skip_kraken2`),
  classifying `ch_trimmed_reads` (whatever FastQC actually sees - it doesn't transform reads, so this is the
  same channel fastp produces) - alongside, not instead of, the pre-existing post-depletion pass. Both are
  genuinely useful and see different things: this pass sees the full community INCLUDING host DNA, the
  existing pass sees the purely-microbial picture after Bowtie2 removes it. Implementation details that
  needed real care, not just a copy-paste:
  - Nextflow DSL2 can't call the same process twice in one workflow - used the standard nf-core pattern,
    `include { KRAKEN2_KRAKEN2 as KRAKEN2_KRAKEN2_PREDEPLETION } from '...'` (same for Bracken).
  - `ch_trimmed_reads` previously only existed inside the `input_type == 'fastq'` conditional block (Groovy's
    implicit-declaration scoping rules mean it wasn't visible outside it) - added a top-level
    `ch_trimmed_reads = Channel.empty()` declaration alongside `ch_depleted_reads`/`ch_contigs`'s existing
    ones, so the new block (placed with the classification section, not nested in the fastq branch, matching
    where the existing Kraken2 block already lives) can see it.
  - Both passes classify the SAME sample (identical `meta.id`), so without an `ext.prefix` override both
    would emit `sample1.kraken2.report.txt` - harmless on disk (separate `publishDir` paths per pass,
    `results/kraken2/` vs `results/kraken2_predepletion/`) but a real, silent data-loss risk in MultiQC, which
    keys its report table by filename-derived sample name and would show one "sample1" row silently
    clobbering the other's data. Fixed with `ext.prefix = { "${meta.id}_predepletion" }` in
    `conf/modules.config` for both new process aliases - verified this actually matters, not just theorized:
    a new nf-test case runs BOTH passes together and asserts both distinct report files exist with the
    correct content.
  - fastq entry point only - guarded the same "inapplicable combination made to not-happen automatically, not
    left to crash" way as `skip_host_removal`-on-contigs, since there's no "pre-depletion reads" concept when
    there are no reads at all (contigs entry point).
  - Reuses `skip_bracken` (no new flag) for Bracken re-estimation on this pass too, and the existing
    `kraken2_db` param (one DB genuinely serves both passes - there's no reason they'd need different ones).
  **Composer UI updated to match**: `pipelineTopology.ts` now allows `fastp -> kraken2` (the real data
  producer) and `fastqc -> kraken2` (FastQC doesn't transform reads, so this is the same channel, and matches
  the diagram's own drawn arrow) as valid connections, alongside the pre-existing `bowtie2 -> kraken2`. Cross-
  checked the composer's full tool inventory against `workflows/microbox.nf`'s real `include` list while
  investigating this (owner: "lets make sure we fully understand the current tools we have") - confirmed 1:1,
  every real user-facing process has exactly one composer node and vice versa (`GZIP_CONTIGS`/
  `BOWTIE2_BUILD` are internal helpers, correctly excluded from the palette).
  **Verified for real, not assumed**: `nf-test test --tag requires_db --profile test,docker` - 5 new cases
  (pre-depletion pass alone, both passes together with distinct non-colliding reports, `skip_bracken=true`
  on the new pass, and the contigs-entry auto-skip guard), plus all 11 pre-existing `requires_db` cases and
  all 13 `basic` cases still green (29 total, 0 regressions) - confirmed against the real downloaded `viral`
  Kraken2 DB already present on this machine, not mocked. Composer-ui test suite grew from 91 to 93
  (`pipelineTopology.ts`/`validatePipeline.test.ts` coverage for the two new valid connections).

- **Composer canvas: connection points made ~10% bigger, 2026-09-13** (owner: "sometimes difficult to select
  it"). `.tool-node__handle` (`ToolNode.css`) 8px → 9px; `HANDLE_SIZE` in `nodeDefaults.ts` (used to estimate
  handle positions for not-yet-measured nodes - see the 2026-09-13 import-rendering fix above) kept in sync
  at the same value, since the two must match or the pre-measurement estimate would be slightly off from the
  real rendered position. Verified live: `getBoundingClientRect()` on a real rendered handle now reports 9px.

- **Composer canvas: Auto-arrange changed from left-to-right to top-to-bottom, 2026-09-13** (owner: "for the
  auto arrange button make it vertical. just like the picture i shared"). `src/utils/autoLayout.ts`'s
  `computeAutoLayout` unchanged in algorithm (Kahn's-algorithm-style longest-path layering) - only which axis
  each of the two already-computed numbers (layer depth, sibling index) maps to was swapped: layer depth now
  drives `y` (rows growing downward) instead of `x` (columns growing rightward), sibling index now drives `x`
  instead of `y`. Matches this app's own fixed handle roles (top/left = incoming, right/bottom = outgoing,
  `HANDLE_SIDES`) - a layer's successors naturally land below it now, connecting out of its bottom handle,
  same as the R&D reference diagram's own vertical flowchart shape. `autoLayout.test.ts`'s existing assertions
  flipped to check `.y` instead of `.x` for depth-ordering and vice versa for same-layer siblings - no new
  test cases needed, the algorithm's actual behavior (longest-path layering, cycle handling, rootless-node
  handling) is unchanged and was already covered. Verified live: re-arranging the owner's own real 10-node
  canvas (fastp/FastQC/Bowtie2/MEGAHIT/QUAST/MaxBin2/Kraken2/Pavian/geNomad/CheckV) now stacks top-to-bottom
  exactly matching the reference diagram's shape.

- **Composer canvas: the "connections don't match the real pipeline" validation REMOVED entirely, 2026-09-13**
  (owner, after two separate real cases - FastQC → fastp, QUAST → MaxBin2 - both required real investigation
  to resolve rather than being obvious bugs or obvious mistakes): "i guess we allow the user to do whatever
  they want no need for warning." This reverses the feature built earlier the same day ("Composer canvas:
  connections validated against the real pipeline's fixed backbone..."), after real use surfaced its actual
  cost: it couldn't tell apart "the user drew a genuine mistake" (its original, real motivating case) from
  "the user is sketching a forward-looking design the current pipeline code hasn't caught up to yet, based on
  a reference diagram that was only ever meant as one example, not a literal spec" (owner, same day,
  separately: "remember thats an example of a pipeline, we might add more elements more nodes to it... lets be
  flexible"). Both ambiguous cases got real research before this decision, not just a shrug: nf-core/mag,
  Galaxy Training Network, and Harvard Chan Bioinformatics Core training materials all confirmed FastQC is
  standard practice run BOTH before and after trimming (neither the current pipeline's trimmed-only pass nor
  the reference diagram's raw-only pass is itself the textbook design) - the owner explicitly declined adding
  a second FastQC pass anyway ("if they want to run fastqc twice they would just add it again in the pipeline
  twice... why would we do it for them"), confirming the real lesson here isn't "which order is correct" but
  "don't build pipeline changes reactively from an example diagram." Separately, MaxBin2's own documented
  inputs (its GitHub README, nf-core's module) confirmed it never takes QUAST's output - QUAST → MaxBin2
  really was a genuine mistake, not a forward-looking design - but by then the broader decision (remove the
  check entirely, for everyone) had already been made and applies here too.
  **What changed**: deleted `src/data/pipelineTopology.ts`, `src/utils/validatePipeline.ts`,
  `src/utils/validatePipeline.test.ts` entirely (9 tests removed with them) - not just hidden or disabled.
  Removed the warning banner and its i18n keys (`invalidConnections_one/_other/Hint`) from `ComposerPage.tsx`,
  the `invalidEdgeIds` prop and `edgesWithValidity` derived-edges logic from `PipelineCanvas.tsx`, and the
  `data.invalid`/`deletable-edge--invalid` dashed-amber styling from `DeletableEdge.tsx`/`.css`. **What did
  NOT change**: `src/utils/isValidConnection.ts` still rejects self-connections and same-role handle pairs
  (target-to-target/source-to-source) - that check is about structural ambiguity in the fixed-handle-role
  scheme itself (there's no way to infer a direction for a same-role pair), not a judgment about whether a
  specific tool pairing matches the current pipeline, so it stayed. Test suite: 93 → 84 (9 removed, 0 added -
  a real feature removal, not a refactor). Verified live: re-drawing the exact FastQC → fastp connection from
  the owner's own saved canvas renders as a normal solid edge with no banner.
