# Contributing / maintaining microbox

Written for whoever picks this project up next — the goal is that you can add a tool, upgrade a
dependency, or fix a bug without having to reverse-engineer the conventions from scratch. Read
`docs/KNOWN_ISSUES.md` and `docs/planning/PLAN.md`'s table of contents once before your first change; come
back to this file for the concrete "how do I actually do X" steps.

## 0. The one environment quirk you need to know about immediately

If you're on the same kind of setup this project was built on (Windows + WSL2 + Docker Desktop), **the
repo may exist as two separate copies** — one under the Windows filesystem, one under the WSL Linux
filesystem — because Nextflow's `workDir` must live on the Linux side (see
`docs/KNOWN_ISSUES.md` #9: Windows-mounted filesystems don't support the Unix named pipes some tools use
internally, and it's also much slower). **If that's your setup: after editing a file on one side, copy it
to the other before running anything**, or you'll spend a confusing hour wondering why your change had no
effect. If you've set up a single native Linux/Mac dev machine instead, or mounted the same directory into
both, ignore this entirely — it's a Windows-specific quirk, not a permanent architecture requirement.

Every other instruction in this file assumes you've already run `bin/setup-dev.sh` once on whichever
machine(s) you're using.

## 1. How to add a new tool to the pipeline

This project has done this three times already this way (metaSPAdes, geNomad, CheckV) — follow the same
recipe rather than inventing a new pattern:

1. **Check if an nf-core module already exists** before writing one by hand:
   ```bash
   nf-core modules list remote | grep -i <toolname>
   nf-core modules info <module/path>       # inputs/outputs/container tag
   nf-core modules install <module/path>
   ```
   Only write a custom module under `modules/local/` if nf-core genuinely has nothing (this project's one
   example: `modules/local/gzip_contigs/`, because nothing off-the-shelf did that one small thing).
2. **Never hand-pick a container tag.** Use whatever the installed nf-core module itself pins. If your own
   prior research (a spec, an old note) suggested a different tag, the *installed module's* tag wins —
   this project hit that exact situation twice (metaSPAdes: research said `spades:4.3.0`, the real nf-core
   module pins `4.1.0`; CheckV: research said `1.1.1`, the module pins `1.0.3`) and both times the right
   call was "use what the module actually installs, note the discrepancy, move on" — not to override it.
3. **Add params** in `nextflow.config`: `skip_<tool> = true/false` and any DB/reference path params, each
   with a one-line comment explaining the default. Look at the existing `skip_kraken2`/`kraken2_db` pair for
   the pattern — DB-dependent tools default to `skip_* = true` so the zero-setup test profile stays
   zero-setup.
4. **Wire it into `workflows/microbox.nf`**: include the module, add an `if (!params.skip_<tool>) { ... }`
   block. If it depends on contigs existing, reuse the `ch_contigs_present` guard (already computed once,
   near the top) rather than recomputing it. If a combination is structurally invalid (e.g. Bracken on
   contigs-mode input), auto-skip it with a clear reason rather than letting it crash — search this file
   for "inapplicable combination made to not-happen automatically" for the existing pattern.
5. **Check MultiQC support before assuming it exists**: fetch `https://docs.seqera.io/multiqc/modules/` (or
   check the MultiQC source) for the tool's name — don't guess. If it's supported, mix the relevant output
   file into `ch_multiqc_files`. If not, either add a small custom-content `_mqc.yml` summary (see the
   `genomad_summary`/`checkv_summary` blocks in `workflows/microbox.nf` for a working example of this
   pattern) or explicitly note in a comment why the report gap is acceptable — don't silently leave a
   report-less tool.
6. **Add a `publishDir` entry** in `conf/modules.config` so its output actually reaches `results/<tool>/`
   instead of staying buried in Nextflow's hashed work directory. **Adding a tool to the WGS sibling
   pipeline instead** (`workflows/wgs.nf`, PLAN.md §6.9)? Its `publishDir`/`ext.args`/resource overrides go
   in `conf/modules_wgs.config`, a separate file from the metagenomics pipeline's `conf/modules.config` - a
   real, easy mistake to make out of habit if you've edited `conf/modules.config` before, since both files
   are loaded unconditionally and a block in the wrong one just silently never matches instead of erroring.
7. **Measure its real resource needs — don't trust the advertised nf-core label.** Run it for real (toy
   fixture first, real-scale data if you have it) while watching `free -h`/`docker stats`. If it needs more
   than the `test` profile's general cap, add a `withName: 'YOUR_PROCESS'` block with its own
   `resourceLimits` in `conf/test.config` — scoped to that one process, never by raising the general cap
   (that cap exists specifically so `-profile test` stays usable on a memory-constrained machine; see
   `docs/planning/PLAN.md` §1.1 and the geNomad `mmseqs2` example already in `conf/test.config`).
8. **Add a real `nf-test` case** in `tests/main.nf.test` — tag `basic` if it needs no external DB, tag
   `requires_db` if it does. Assert **real content**, never just `workflow.success` or `path(...).exists()`
   — this project has been bitten twice by a test that only checked existence while the file was actually
   empty (`docs/KNOWN_ISSUES.md` Fixed #13, #15). Run the full relevant suite
   (`nf-test test tests/main.nf.test --tag basic --profile test,docker`, and `--tag requires_db` too if
   relevant) and confirm it's genuinely green, not just "the command didn't error."
9. **Document it** in `docs/KNOWN_ISSUES.md` (what/why, the real container tag, any surprises found) and
   `docs/planning/PLAN.md` §9's tool catalogue. Future-you (or whoever's reading this) will thank you for
   writing down *why*, not just *what*.
10. **Sync both copies** (§0) and run `docs/TESTING.md`'s §10 post-change checklist.

## 2. How to safely upgrade a container tag / dependency version

1. Check what's actually available: `nf-core modules info <module>` shows the currently-installed tag;
   `nf-core modules update <module>` will show/apply what's newer if you want the module's own latest.
2. **Read the tool's own changelog for the version range you're crossing**, specifically for
   behavior-changing majors — this project's `docs/planning/PLAN.md` §2.1 already flags several
   (Bracken 3.x, SPAdes 4.x, CheckV 1.x, Kraken2 2.17 vs. older) as majors that changed output format or
   defaults, not just bumped a version number harmlessly.
3. **Never invent or assume a checksum for a downloaded reference/DB.** If the vendor publishes one, use it.
   If not (common — S3 buckets often only expose a multipart ETag, not a plain sha256), download it once
   yourself, compute the real hash, and pin *that*, with a comment saying so — see every entry in
   `bin/download-dbs.sh` for the existing pattern.
4. Re-run the full test suite (`basic` + any `requires_db` tests the changed tool touches) before
   considering the upgrade done. A version bump with a passing test suite from *before* the bump proves
   nothing about the *new* version.
5. Update the pinned-tag table in `docs/planning/PLAN.md` §2.1 and add a dated note in
   `docs/KNOWN_ISSUES.md` if anything about the upgrade was non-trivial (a new required flag, a changed
   default, a new resource requirement).

## 3. How to add a new UI feature

- The UI (`ui/app.py`) may **only** talk to the pipeline through `bin/run.sh` (subprocess) and by reading
  files under `results/` — never by importing or reaching into `workflows/microbox.nf`. This is the
  GUI-agnostic contract (README, `docs/planning/PLAN.md`'s standing principle) — breaking it to make one
  feature easier is exactly the "design smell" that principle calls out to push back on, not take.
- Any new piece of **shared, on-disk UI state** (a PID file, a lock file, anything not scoped to one
  browser session) needs to be tested from a second, independent session — Streamlit reruns the whole
  script on almost any interaction, and this project has a real bug history (the `.streamlit_run.pid` race
  condition, `docs/KNOWN_ISSUES.md`) from assuming one session's cleanup logic couldn't affect another's.
- Check the new feature against `docs/TESTING.md` §4.1's Nielsen-heuristic table — does it add an
  unexplained option, an error state with no plain-language message, or something the user has to
  remember? Update that table if the feature changes the answer.
- Test it for real via browser automation (`claude-in-chrome` or Playwright), not just `python -m
  py_compile` — this project's real UI bugs (Fixed #17, #18, #21, the PID race, the `bin/run-ui.sh`
  venv-path bug) were *all* found by actually clicking through the app, none by reading the code.

## 4. Where things live, and where to look when something breaks

- **A run failed and you don't know why**: run `bin/debug.sh` (or `bin/debug.sh <run-name>` for a specific
  past run) — it finds the failed task and prints its real command/stderr, no need to dig through
  `work/` by hand.
- **A run succeeded but a result looks wrong** (the harder case — nothing crashed, so `bin/debug.sh` finds
  nothing): use `bin/inspect.sh <run-name>` to list every task the run executed, then
  `bin/inspect.sh <run-name> <process-name>` to deep-dive any one of them — its exact command, exactly which
  files were staged in (and which upstream task produced each one, so you can trace a bad value back through
  the pipeline node by node), and exactly what it produced for the next node. Needs the run's `work/`
  directory to still exist (same requirement `-resume` already has).
- **Handing a run to someone else to diagnose** (e.g. the R&D team reports an unexpected result): run
  `bin/inspect.sh --bundle <run-name>` — it zips the run's `.nextflow.log`, run-report, `pipeline_info/`
  (trace/DAG/software-versions/MultiQC custom-content), a full task manifest, and any failed task's exact
  command+stderr+stdout into one file under `debug-bundles/` (gitignored). Deliberately excludes work-dir
  data files (sequence data can be large) — for those, share the specific work-dir path from the manifest.
- **A test is failing**: check `docs/KNOWN_ISSUES.md` first — several past "failures" turned out to be
  transient network blips (verify by re-running once; if the same test fails identically twice, it's real).
- **The UI won't start / a run seems to have vanished**: check `logs/streamlit_ui.log` and
  `.streamlit_run.log`; if you're on WSL2, closing the terminal window that launched the UI kills
  everything in it within seconds (a real WSL2 VM-lifecycle behavior, not a bug in this project — see
  `docs/planning/PLAN.md` §6.14) — keep that window open (minimized is fine) for a run to survive.
- **You're not sure if something is already broken/known**: `docs/KNOWN_ISSUES.md`'s Open section lists
  everything currently known-broken-and-accepted, with why. Don't re-diagnose something already logged
  there — read the existing entry first.

## 5. Conventions worth following (not enforced by tooling yet)

- **Comments explain *why*, not *what*.** A comment restating what the next line obviously does gets
  deleted; a comment explaining a non-obvious constraint, a workaround for a specific bug, or why an
  alternative approach was rejected, stays. Look at any existing module for the tone to match.
- **Every non-obvious decision gets written down** in `docs/KNOWN_ISSUES.md` or `docs/planning/PLAN.md`,
  not just left implicit in the code. This project's biggest asset for a new maintainer is that almost
  nothing here was a silent choice — if you can't find the reasoning for something, that's a gap in the
  docs worth fixing, not a sign the reasoning doesn't matter.
- **Never trust a resource label or version claim without verifying it against the real thing** — this
  project's single most repeated lesson. "The nf-core label says 6GB" and "the spec says checkv 1.1.1" have
  both turned out wrong in ways that only showed up by actually running the tool.

## 6. Before calling any change "done"

Run `docs/TESTING.md` §10's post-change checklist, scaled to what you actually touched. It's not optional
polish — most of it exists because skipping it once already caused a real, documented bug in this project's
history.
