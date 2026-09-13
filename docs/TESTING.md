# Testing requirements & standards

Living reference, same spirit as `docs/KNOWN_ISSUES.md`: what "properly tested" actually means for this
project, at every layer, researched against current industry/domain practice (2026-09-12, expanded same
day after owner feedback: "i expecting more testing! and also more ui and ux criteria") rather than
assumed — sources cited inline. Use the checklist in **§10** after every change; use §1–§9 to understand
*why* each item is there and what "done" looks like in more depth.

This project has three layers that get tested differently, on purpose (`docs/planning/PLAN.md`'s
standing GUI-agnostic principle):

- **Backend** — the Nextflow pipeline itself (`main.nf`, `workflows/microbox.nf`, `modules/`, `conf/`).
- **Frontend** — the Streamlit UI (`ui/app.py`) *and* the CLI surface (`bin/*.sh`) — both are real UX,
  not just the browser one.
- **In between** — the contract connecting them: CLI flags, `-params-file` YAML, the `results/` file tree,
  `bin/run.sh`/`bin/run-ui.sh`, the `.streamlit_run.pid` reattachment file. This boundary is the whole
  reason the UI can be swapped later without touching the pipeline — it needs its own explicit tests, not
  just "the UI worked when I clicked it" and "the pipeline worked when I ran it from the CLI" separately.

---

## 1. The testing pyramid, applied here

Standard shape — wide base of fast tests, a smaller layer of integration tests, a thin top of
slow/expensive end-to-end tests — [testomat.io](https://testomat.io/blog/testing-pyramid-role-in-modern-software-testing-strategies/),
[CircleCI](https://circleci.com/blog/testing-pyramid/). Applied to this repo's actual tools:

| Layer | This project's tool | Speed | Run when |
|---|---|---|---|
| Unit | `nf-test` on individual modules/subworkflows; `pytest` + Streamlit's `AppTest` on `ui/app.py` functions; `shellcheck` on every `bin/*.sh` | seconds | every save/commit |
| Integration | `nf-test` pipeline-level tests (`tests/main.nf.test`, tag `basic`) — real containers, toy fixtures | tens of seconds | every commit/PR |
| Integration (DB-dependent) | `nf-test` tag `requires_db` — real Kraken2/geNomad/CheckV DBs | minutes | before merging anything touching classification/viral-discovery stages, not every commit |
| System/E2E | Real-data CLI runs (ZymoBIOMICS or similar) + `claude-in-chrome`/Playwright-driven UI click-throughs + a real usability session (§4) | minutes–hours | before a release, after any change to `bin/run.sh`, `ui/app.py`, or the entry-point contract |

**Rule of thumb from the research**: unit tests should be the overwhelming majority; end-to-end tests are
kept few and focused on the highest-risk paths *because* they're slow and expensive to maintain
([onpathtesting.com](https://www.onpathtesting.com/blog/the-test-pyramid-in-2026-still-relevant-still-necessary/)).
Don't add a full real-data E2E run to verify something a `basic`-tagged toy-fixture `nf-test` case could
already prove. **But also don't stop at the pyramid's functional-correctness axis alone** — §4's UX
criteria and §7's observability requirements are a second, orthogonal axis ("does it work" vs. "is it good
to use, and can you tell what it's doing") that a pure pass/fail test suite doesn't capture at all.

---

## 2. Backend (pipeline) testing requirements

Baseline is the nf-core/nf-test standard this project already follows — verified against nf-core's own
current guidance, not assumed:

- **Every pipeline must be verifiable with nf-test using minimal test datasets** and **every pipeline must
  run CI tests** — [nf-core testing guidelines](https://nf-co.re/docs/guidelines/pipelines/recommendations/testing).
  This repo does this (`tests/main.nf.test`). **Status as of 2026-09-13**: `.github/workflows/ci.yml` now
  wires the `basic`-tagged suite to run on every push/PR, plus UI ruff+pytest and shellcheck — every command
  in it grounded in what's already verified working locally, but **not yet observed running on a real
  GitHub Actions runner** (nothing pushed to a remote this session). Watch the Actions tab on the first real
  push to confirm — see `docs/KNOWN_ISSUES.md` ("First CI wiring...") and §10.
- **nf-test's snapshot testing catches unintended output drift**; use it for stable, structural outputs
  (report shapes, file lists) but keep explicit assertions for anything that's actually business/scientific
  logic — [Seqera nf-test blog](https://seqera.io/blog/nf-test-in-nf-core/). Do not snapshot-test
  everything as a substitute for thinking about what should be asserted; per the general snapshot-testing
  research, over-broad snapshots hide real regressions in a wall of accepted diffs
  ([teachmeidea.com](https://teachmeidea.com/snapshot-testing-benefits-pitfalls-when-to-use/)).
- **Reproducibility, not just "it ran"**: containerized environments (already this project's rule — every
  tool pinned, `docker.enabled`), systematic validation of environment/inputs/runtime, and testing with
  *both* synthetic and real data in CI —
  [Frontiers, reproducible bioinformatics pipeline engineering](https://www.frontiersin.org/journals/bioinformatics/articles/10.3389/fbinf.2026.1824590/full).
  This project's toy-fixture (`basic`) + real-ZymoBIOMICS-data testing split already matches this; keep
  both tiers for every new tool, don't let "the toy fixture passed" stand in for "verified against known
  truth" the way this session's Kraken2/geNomad work explicitly distinguished
  (`docs/KNOWN_ISSUES.md`'s "Real-data validation" and "geNomad + CheckV added..." entries).
- **Container/image hardening applies even for local-only, single-user use**: pin exact tags (already this
  project's hard rule — "never invent a tag or checksum"), never run as root inside a container without
  reason (`docker.runOptions = '-u $(id -u):$(id -g)'` already does this), and scan images for known CVEs
  before adopting a new one — [Wiz Docker security](https://www.wiz.io/academy/container-security/docker-container-security-best-practices),
  [Sysdig image scanning](https://www.sysdig.com/learn-cloud-native/12-container-image-scanning-best-practices).
  **Not yet done in this repo**: no automated scan (Trivy/Docker Scout) of the ~15 pinned images this
  project depends on — see §10.
- **Data integrity, not just "the file exists"**: this project's own hard-won lesson twice this session
  (Fixed #13, Fixed #15 in `docs/KNOWN_ISSUES.md` — QUAST and Kraken2 both had "file exists but is
  functionally empty/wrong" bugs undetected until a test checked *content*) is exactly what the wider
  data-engineering literature calls out as the real gap: volume/plausibility checks catch a
  pipeline silently producing near-empty or biologically-impossible output that a bare
  existence check would miss —
  [AWS Life Sciences Lens, data integrity in scientific pipelines](https://docs.aws.amazon.com/wellarchitected/latest/life-sciences-lens/lsrel13-bp02.html).
  **Standing rule for every new module**: assert real content (`.text.trim().length() > 0`, a specific
  expected string/row-count, a known biological fact like this session's Coronaviridae classification),
  never just `path(...).exists()`.
- **Checksums for every external artifact**: this project's already-established rule (pin a real sha256 for
  every downloaded DB/reference, verified 2026-09-11/12 for Kraken2/geNomad/CheckV/lambda-phage) matches
  the general data-integrity standard of using cryptographic hashing to detect corruption/tampering in
  transit — [checksum/hash validation](https://medium.com/@georgemichaeldagogomaynard/data-integrity-in-a-data-pipeline-best-practices-and-strategies-for-data-quality-checks-dim-71af7a3bf21e).
  Never invent a checksum; if none is published, pin one from your own first verified download and say so
  in the comment (already this project's pattern in `bin/download-dbs.sh`).

### 2.1 Static analysis, linting, and test-quality metrics — expanded 2026-09-12

Code coverage alone is a vanity metric if the covered lines aren't actually asserted on — a program can be
100% "covered" by tests that call every line and check nothing meaningful. **Mutation testing** ("testing
your tests" by injecting artificial bugs and checking the suite catches them) is the real measure of
whether assertions are doing their job, not just whether code executed —
[Codecov, mutation testing vs. coverage](https://about.codecov.io/blog/mutation-testing-how-to-ensure-code-coverage-isnt-a-vanity-metric/),
[mutation testing vs. code coverage](https://getautonoma.com/blog/mutation-testing-vs-code-coverage). This
project's own repeated real-world version of that exact failure mode is Fixed #13/#15 above — a test that
only checked `path(...).exists()` passed while the actual content was empty/wrong, which is precisely what
a mutation test on that assertion would have flagged (a mutant that made the process write an empty file
would have survived the old test). Target mutation scores from current practice: **70–80% for critical
modules, 60–70% acceptable elsewhere**
([practitioner consensus, mutation testing guides](https://bell-sw.com/blog/a-comprehensive-guide-to-mutation-testing-in-java/)).
Not yet run against this codebase (Python-side `ui/app.py` logic is the realistic candidate — `mutmut` or
`cosmic-ray` for Python; Nextflow/Groovy mutation testing tooling is far less mature, so for the pipeline
side the practical equivalent is simply *never accepting a test that only checks existence*, per §2 above).

**Static analysis this project should run on every relevant file type, not yet automated anywhere**:

- **`shellcheck` on every `bin/*.sh`** — this project has ~7 non-trivial bash scripts
  (`run.sh`, `run-ui.sh`, `debug.sh`, `download-dbs.sh`, `setup-dev.sh`, `sync_wsl.sh`-equivalents) with
  real history of subtle bugs (the SDKMAN `set -u` issue, the non-idempotent `resolv.conf` handling, the
  `disown`/backgrounding investigation this session) that a linter catches for free. Zero cost to add
  (`shellcheck bin/*.sh`) — see status below and §10.
- **A Python linter/formatter on `ui/app.py`** (Ruff is the current fast standard, replacing the older
  flake8+black+isort combination) — catches unused imports, obvious bugs, and style drift before they
  accumulate.
- **`nf-core lint`** — already planned in `docs/planning/PLAN.md` §6.2's original testing table (CI layer
  3); this is nf-core's own pipeline-structure linter (naming conventions, required files, module
  conventions) and is free, fast, and already assumed by this project's own plan.
- The general layered strategy from current practice — a fast linter on every save, a deeper security-
  focused scanner (Semgrep/SAST) in CI, blocking merges on critical findings —
  [static analysis strategy 2026](https://cycode.com/blog/static-code-analysis/). Now that CI exists
  (`.github/workflows/ci.yml`, see status below), shellcheck/ruff run there on every push; a dedicated
  SAST scanner is still a future addition, not yet justified for a `127.0.0.1`-only internal tool (§6).

**Status as of 2026-09-13**: `shellcheck` installed and run clean across all 5 `bin/*.sh` scripts (zero real
issues, three expected `SC1091` info-notes about sourcing files that don't exist yet at lint-time, silenced
with `# shellcheck disable=SC1091` and a comment). `ruff` installed into `.venv-ui` and run against
`ui/app.py`, finding and fixing 3 real issues (a `datetime.fromtimestamp()` needing explicit tz-awareness,
an implicit `subprocess.run()` check argument, and one deliberate, now-documented exception for a
long-lived file handle). **`nf-core pipelines lint`** was crashing outright on a real bug (`manifest.name`
in `nextflow.config` needs an `<org>/<pipeline>` slash format) — fixed; its remaining failure past that
point (no `nextflow_schema.json`) is a deliberate scope decision, not a bug, since this project never
adopted the full nf-core template scaffolding — see `docs/KNOWN_ISSUES.md`. **CI** is now wired
(`.github/workflows/ci.yml`) but not yet observed running on a real GitHub Actions push — see §10.

### 2.2 UI unit-test tooling — closed 2026-09-13, was a real gap

Streamlit ships a real headless testing framework (`streamlit.testing.v1.AppTest`) built for exactly this:
run the app's code directly, simulate input, inspect rendered state, without a browser —
[Streamlit's own app-testing docs](https://docs.streamlit.io/develop/concepts/app-testing). It's
`pytest`-based and far cheaper than a full browser test —
[Streamlit AppTest reference](https://docs.streamlit.io/develop/api-reference/app-testing/st.testing.v1.apptest).
**Before 2026-09-13, this project never used it** — every `ui/app.py` verification up to that point was
either a bare `python -m py_compile` syntax check or a full `claude-in-chrome` browser session, leaving a
real hole in the pyramid (§1): no fast, no-browser-needed unit-test layer for the UI at all.

**Closed**: `pytest` + `AppTest` installed into `.venv-ui`; a real 8-test suite lives at `ui/test_app.py`,
covering exactly the logic this project's manual browser testing had verified but never had an automated
regression test for — the never-started/finished/still-running state machine, stale-PID cleanup, the
disk-space warning (mocked via `monkeypatch.setattr(shutil, "disk_usage", ...)` since forcing a real
low-disk-space condition isn't practical to automate), and the Cancel button *actually terminating the
process*, not just changing what the UI displays.

**One real gotcha found writing these tests, worth remembering for any future test spawning a stand-in
process**: the Cancel test initially hung indefinitely. Root cause: the test's stand-in "still running"
process (`subprocess.Popen(["sleep", "30"])`) shared the *test runner's own* process group by default, so
`ui/app.py`'s real `_cancel_run()` — which correctly does `os.killpg(os.getpgid(pid), signal.SIGTERM)` to
reach a real run's whole process tree — ended up also sending `SIGTERM` to the pytest process itself.
Fixed by spawning the test's stand-in process with `start_new_session=True`, which is also simply the more
accurate stand-in, since that's exactly how `ui/app.py`'s real `subprocess.Popen` call spawns `bin/run.sh`.
**Any future test that plants a fake "long-running process" PID for the app to act on needs the same
`start_new_session=True`, or a similar hang is very likely.**

Browser/E2E testing (`claude-in-chrome`/Playwright) remains the right tool for what `AppTest` genuinely
can't reach — real multi-tab/multi-session behavior (the PID-reattachment-across-sessions scenario needed
two real browser tabs, not one `AppTest` instance, to prove), real rendering, and real subprocess lifecycle
end to end. Use `AppTest` for the fast, frequent, no-browser-needed layer; keep browser automation for what
only a real browser session can prove.

---

## 3. In-between (contract) testing requirements

This is the layer most testing methodologies don't have a name for, because most projects don't have a
GUI-agnostic boundary at all — but the underlying discipline is exactly **contract testing**: the consumer
(UI) states what it expects to call and get back; the provider (pipeline) verifies it actually honors that
— [contract testing guide](https://zuplo.com/learning-center/guide-to-contract-testing-for-api-reliability),
[API contract testing best practices](https://www.accelq.com/blog/api-contract-testing/). This project's
"API" is unusual (a CLI + files, not HTTP), but the same discipline applies directly:

- **The contract is**: `bin/run.sh <samplesheet> --profile <env>` (+ optional `-params-file`) → exit code +
  `results/<tool>/...` + `results/pipeline_info/...` + `results/multiqc/multiqc_report.html`. Any test that
  exercises the UI clicking Run and checks the *pipeline's* output files, or the CLI running and checking
  the *result*, is implicitly a contract test — make sure at least one such test exists for every new flag
  the UI or CLI exposes.
- **Test the contract from both directions independently**: a pipeline change that renames an expected
  output path breaks the UI's `MULTIQC_REPORT = REPO_ROOT / "results" / "multiqc" / "multiqc_report.html"`
  constant silently — nothing in `workflows/microbox.nf`'s own tests would catch that, since it never
  imports or checks `ui/app.py`. **Standing rule**: whenever a `publishDir` path changes in
  `conf/modules.config`, grep `ui/app.py` (and `bin/*.sh`) for any hardcoded reference to the old path.
- **Process-lifecycle contract**: `subprocess.Popen` exit codes, process-group behavior (`start_new_session`
  for the Cancel button to reach the whole tree, verified 2026-09-12 via `ps -o pgid,sid`), and file-based
  handshake (`.streamlit_run.pid`) are all part of this contract too, not just the samplesheet-in/report-out
  path. Test them directly (as this session did: plant a real PID, confirm liveness detection; click
  Cancel, confirm the process group is actually gone) — don't just trust that `subprocess.Popen` "does the
  right thing" by inspection.
- **Versioning discipline**: contract-testing best practice calls for keeping the contract's definition
  itself under version control and reviewed like code
  ([API contract testing](https://www.accelq.com/blog/api-contract-testing/)) — this project's equivalent
  is: every param this pipeline accepts is declared once, with a comment, in `nextflow.config`; the UI/CLI
  should never invent an undocumented flag, and adding a new param means updating both sides deliberately,
  not just adding it to whichever side needed it first.

---

## 4. UI/UX design & usability criteria — expanded 2026-09-12

This section didn't exist in the first pass of this document and should have — "does the button work" and
"is this actually good to use" are different questions, and only the first one was covered before. This is
a real, applied audit against the *current* `microbox` Streamlit UI and CLI, using Jakob Nielsen's 10
usability heuristics (the industry-standard checklist since 1994, still the most widely used one — [NN/g,
10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)) as the backbone,
because a generic UX checklist copied in without applying it to this specific app is exactly the kind of
shallow pass that prompted this expansion.

### 4.1 Nielsen's 10 heuristics, applied to the current UI (real audit, not generic advice)

| # | Heuristic | Current state | Gap / requirement |
|---|---|---|---|
| 1 | **Visibility of system status** — user always knows what's happening | "Running..."/"Completed"/"Failed" + raw log tail | No current-stage indicator ("now running: MEGAHIT"), no progress %, no ETA. **Requirement**: parse the log/trace for the currently-executing process name and show it distinctly from the raw log, not just buried in scrollback. Ties to PLAN.md §6.15 item 2. |
| 2 | **Match between system and the real world** | "Environment" dropdown: `test`/`dev`/`test_aws`/`prod` | Plain profile names with no explanation of what each means or requires — a new user has no way to know `dev`/`test_aws`/`prod` don't work yet (Open #3) without reading `docs/KNOWN_ISSUES.md`. **Requirement**: a one-line `st.caption`/tooltip per option, or visually distinguish "known working" from "not yet configured" options. |
| 3 | **User control and freedom** | Remove-uploaded-file (×) button exists; Cancel button added 2026-09-12 | Good baseline. **Requirement going forward**: any new destructive/long-running action needs an equivalent escape hatch before it ships, not added after the fact the way Cancel was. |
| 4 | **Consistency and standards** | Uses Streamlit's native components throughout, no custom widgets | Solid by default — Streamlit's own design system enforces this. **Requirement**: if a future redesign introduces custom HTML/CSS (`st.components.v1.html`), audit it against the same native look rather than let it drift. |
| 5 | **Error prevention** | Disk-space preflight warning (added 2026-09-12) | The Environment dropdown still lets a user select `dev`/`test_aws`/`prod`, which will fail immediately (Open #3) — this is a real, currently-reachable error the UI does nothing to prevent, just lets happen and then reports via `bin/debug.sh`. **Requirement**: either disable known-broken options in the dropdown with a reason, or accept this as intentional ("the gap stays honest," per the existing code comment) but make the *warning* proactive (before Run is clicked), not just reactive (after it fails). |
| 6 | **Recognition rather than recall** | User must remember to run `bin/download-dbs.sh` before enabling geNomad/CheckV/Kraken2 — nothing in the UI surfaces which DBs are already downloaded | **Requirement** (ties to PLAN.md §6.15 item 3): even before the full node-composer exists, the *current* thin UI could show a simple "DB status" panel (`~/microbox-dbs/<tool>` exists? y/n) so the user isn't relying on memory of which `bin/download-dbs.sh` commands they already ran. |
| 7 | **Flexibility and efficiency of use** | No saved run history, no way to re-run the last samplesheet without re-uploading, no keyboard shortcuts | Acceptable for a "thin launcher" scope today, but **flag as a real gap once usage grows**: a "recent samplesheets" list or a way to re-trigger the last successful params would materially speed up iterative use (this session re-uploaded the same toy fixture repeatedly by hand). |
| 8 | **Aesthetic and minimalist design** | Very minimal already (arguably at the floor of what's useful) | Passes by default via Streamlit's own dark theme; no clutter. Watch for regression as features are added (§4.2's PLAN.md §6.15 warnings, DB-status panel, etc.) — each addition should earn its place, not accumulate into visual noise. |
| 9 | **Help users recognize, diagnose, and recover from errors** | `bin/debug.sh` integration surfaces the real failed task's command/stderr directly in the UI (Fixed #17 area) | **A genuine strength of this project**, not a gap — call this out as the bar future error-handling should match: plain language, the actual failure, not a generic "something went wrong." |
| 10 | **Help and documentation** | Zero in-app help beyond the one-line caption under the title | **Real, current gap**: a first-time user with no prior context has no in-app way to learn what a samplesheet should look like, what "Environment" means, or where to find `docs/`. **Requirement**: at minimum, a `st.expander("Need help?")` linking to the samplesheet format and a one-line description of each environment option — self-explanatory first per Nielsen's own guidance, searchable docs as backup, not the other way around. |

### 4.2 Feedback & error-message quality (beyond the heuristics table)

Applying current UX-writing practice directly, not just "have an error message" —
[error message design guidance](https://www.linkedin.com/pulse/guide-error-messages-user-guidance-agetech-ux-ezra-schwartz-vh07c):
a good error message says **what happened and what to do next** ("Your card was declined. Try a different
payment method"), not just that something failed. Audited against this project's actual failure surfaces:

- `bin/debug.sh`'s output (surfaced in the UI on failure) already does this reasonably well — it shows the
  real command, the real stderr, and a hint (`Tip: fix, then re-run with '-resume'...`). Keep this standard
  for any *new* failure-reporting surface added.
- The disk-space warning ("Only X GB free... a run may fail partway through") says what *might* happen but
  not what to do about it. **Requirement**: extend it to name the actual action ("free up space, or point
  `TMPDIR`/workDir elsewhere") rather than just flagging the risk.
- **Loading-state requirement**: a blank or static state during a long operation reads as broken, not
  in-progress — [loading-state UX guidance](https://medium.com/@atul.shashikumar/product-design-ui-ux-review-checklist-525a0a1b0c77).
  The current "Running..." status with a live log tail already satisfies this (the log visibly changes),
  but the *disk-space check itself* and any future preflight check should show something immediately on
  click, not go silent while `shutil.disk_usage`/equivalent runs — trivial today (it's fast), worth
  re-checking if a future preflight check becomes slow (e.g., an actual DB-integrity check).

### 4.3 CLI UX criteria — the other real UI this project has

`bin/run.sh`, `bin/download-dbs.sh`, `bin/debug.sh`, `bin/setup-dev.sh` are a CLI UX surface, not just
"scripts" — evaluated against the current standard reference for this exact problem,
[Command Line Interface Guidelines (clig.dev)](https://clig.dev/), and
[Thoughtworks' CLI design guidelines](https://www.thoughtworks.com/insights/blog/engineering-effectiveness/elevate-developer-experiences-cli-design-guidelines):

- **Human-first, but pipeline-safe** — a well-designed CLI infers its context (is output going to a human
  terminal or being piped/redirected?) and adjusts, e.g. disabling color codes when not attached to a TTY
  so piped/logged output doesn't fill with escape codes — [clig.dev, "go upscale intelligently"](https://relay.sh/blog/command-line-ux-in-2020/).
  **Not yet verified for this project**: Nextflow's own console output is colorized by default; `bin/run.sh`
  pipes it through `tee` to a log file — worth confirming the log file doesn't fill with raw ANSI escape
  codes (harmless but noisy) and that `NXF_ANSI_LOG=false` or equivalent is set when writing to a file if
  it currently does. Check as part of §10's checklist next time `bin/run.sh` changes.
- **Clear usage on missing/wrong arguments** — this project already does this well
  (`"${1:?Usage: download-dbs.sh <variant> [target_dir]  (variants: ...)}"`, `bin/run.sh`'s equivalent) —
  keep this bar for any new script/flag.
- **Progressive discovery** — a user starting with minimal knowledge should be guided in plain language,
  not required to already know the tool — `bin/setup-dev.sh`'s own final "what to do next" printout
  already does this; extend the same courtesy to any new script.
- **Non-destructive by default** — no script in this repo currently deletes anything without the user
  explicitly invoking that specific action (`rm -rf` only ever appears scoped to this project's own
  generated dirs, never a broad/ambiguous path) — keep this invariant; any future script that could delete
  real data needs an explicit confirmation step or a `--force` flag, never delete-by-default.

### 4.4 Visual regression testing

Not yet done for this project, worth adding once the UI has more than one visual state worth protecting —
current tooling landscape: Playwright's built-in visual comparison (free, already in this project's toolkit
via `claude-in-chrome`-adjacent tooling), BackstopJS (free/open-source), or Percy/Chromatic/Applitools for
AI-assisted diffing at scale — [visual regression tools 2026](https://percy.io/blog/visual-regression-testing-tools/).
Best-practice scope: **focus on high-impact components, not every page/state**
([Percy, screenshot testing guide](https://percy.io/blog/visual-screenshot-testing)) — for this project
that's the Run/status panel and the embedded MultiQC report container, not every possible flag combination's
rendering. **Not currently justified to build yet** given the UI's small surface area (§4.1's aesthetic
note — it's still very minimal), but revisit once the DB-status panel, in-app help, or the future
node-composer (PLAN.md §6.15) meaningfully grow the visual surface.

### 4.5 Exploratory & usability testing sessions

Distinct from scripted `nf-test`/`AppTest`/Playwright tests — a **time-boxed (60–90 minute), unscripted
session** where a real or simulated first-time user tries to accomplish a real task with no prior guidance
beyond what the app itself offers, logging every point of confusion —
[exploratory testing methodology](https://www.globalapptesting.com/blog/exploratory-testing-checklist),
[Wikipedia, exploratory testing](https://en.wikipedia.org/wiki/Exploratory_testing). This project has never
done this formally — every UI verification this session was the *builder* driving a *known-working* flow,
which by construction can't surface the first-time-user confusion §4.1 item 10 already flags (no in-app
help). **Requirement**: before the next UI-facing milestone (or the node-composer, PLAN.md §6.10), run one
real exploratory session — ideally with someone who didn't build the UI — with a charter as simple as "get
a real sample classified, using only what's on screen," and log every point of hesitation as a finding,
the same way `docs/KNOWN_ISSUES.md` already logs bugs.

---

## 5. Resilience / chaos testing requirements

Directly grown out of the owner's "what if they lose internet, what if they go home and comeback the next
day" directive (`docs/planning/PLAN.md` §6.14) — this is a real, named discipline
([chaos engineering / fault injection](https://katalon.com/resources-center/blog/chaos-testing-a-complete-guide),
[AWS well-architected — test resiliency with chaos engineering](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_failure_injection_resiliency.html)),
with a standard method this project should keep following even informally: **define the expected steady
state, inject a real fault, observe what actually happens, fix what's wrong, re-verify** — not just reason
about what "should" happen.

Faults worth deliberately injecting for this project, in order of how directly they map to a real
owner-named scenario:

- **Kill the pipeline process mid-run** (`kill -9` on the `nextflow` PID, or the whole process group) and
  confirm `-resume` genuinely picks up cached progress on the next invocation, not just that the flag is
  present. Verified informally this session via real crashes (OOM kills); worth a deliberate, repeatable
  test case rather than only relying on accidental crashes to exercise this path.
- **Network loss mid-download** (already found and fixed for real: the CheckV NERSC-portal slow-download
  and the mid-transfer HTTP/2 reset, `docs/KNOWN_ISSUES.md`) — `curl -C -` resume behavior should be
  re-verified any time a download mechanism changes, by actually interrupting a download (not just reading
  the flag is there).
- **Close the terminal / disconnect the only WSL client** while a run is in progress — the real, confirmed
  WSL2 VM-lifecycle finding (`docs/planning/PLAN.md` §6.14). Re-test this specifically after any change to
  `bin/run-ui.sh` or the process-detachment mechanism; it's exactly the kind of fix that looks correct on
  inspection and isn't (this session's own first attempt was wrong until actually tested).
- **Disk fills up mid-run** — not yet deliberately tested (the disk-space preflight warning added
  2026-09-12 checks *before* a run starts, not during). A real test: start a run against a disk with little
  free space and confirm the failure is diagnosable via `bin/debug.sh`, not a cryptic Docker/Nextflow error.
- **A required DB/reference path is missing or wrong** — already covered by existing `nf-test` assertions
  (`checkIfExists: true` failing loudly) but worth explicitly listing here since it's a fault class, not
  just an input-validation nicety.
- **Out-of-memory on a single task** (this session's real, repeated experience with Kraken2 and geNomad) —
  the standard here is now established: reproduce it for real, don't guess at a memory ceiling; fix via the
  tool's own documented remedy where one exists (geNomad's `--splits`) before reaching for "just add more
  RAM"; scope any `resourceLimits` override to the specific process via `withName`, never raise the
  general profile-wide ceiling and quietly break the "works on a weak machine" guarantee for every other
  process.

---

## 6. Security testing requirements

Scoped honestly to what actually applies — this is a `127.0.0.1`-only, single-machine, single-user
bioinformatics tool with no auth and no exposed network surface by design
(`docs/planning/PLAN.md` §6.8 item 10), so most of the OWASP Web Security Testing Guide's ~90+ web-facing
test cases genuinely don't apply
([OWASP WSTG overview](https://hackerdna.com/blog/owasp-web-security-testing-guide)). What does apply:

- **Supply-chain / dependency hygiene**: every container image pinned by exact tag (already a hard project
  rule). **Status as of 2026-09-13**: Docker Scout (already installed, v1.23.1) turned out to require a
  Docker Hub login to run any scan — not something to do non-interactively, and not worth making a
  maintainer create/link a Docker ID just to lint containers. Installed `trivy` instead (open-source,
  no login required, via the official apt repo with GPG key verification) and ran
  `trivy image --scanners vuln --severity HIGH,CRITICAL` against all 11 unique pinned images this pipeline
  actually depends on (verified by grepping every `modules/**/main.nf` for its `container` line — not ~15,
  11: fastp, fastqc, the combined bowtie2/htslib/samtools/pigz image, megahit, spades, the combined
  kraken2/coreutils/pigz image, bracken, quast, genomad, checkv, multiqc). See
  `docs/KNOWN_ISSUES.md` for the findings. Re-run this after pinning any new/upgraded tag — see
  `CONTRIBUTING.md` §2 — and periodically even for unchanged tags, since new CVEs get disclosed against
  already-pinned versions over time —
  [Docker/Trivy scanning best practice](https://checkmarx.com/learn/container-security/docker-container-security-best-practices-image-scanning-is-non-negotiable/).
- **Software Bill of Materials (SBOM) and license auditing** — expanded 2026-09-12. This project pulls in
  ~15+ pinned bioconda/biocontainers images plus Python packages (`streamlit`, `nf-core` tools) and the
  Nextflow runtime itself; none of that is currently inventoried in one place. A real SBOM captures
  component identity (exact name/version/supplier), the direct-vs-transitive dependency graph, licensing
  metadata, and integrity hashes —
  [SBOM minimum elements, NTIA](https://www.ntia.gov/sites/default/files/publications/sbom_minimum_elements_report_0.pdf),
  [SBOM standards guide](https://www.kiuwan.com/blog/sbom-standards/). **Why this matters even for an
  internal tool**: license auditing specifically — copyleft licenses (GPL) carry source-disclosure
  obligations that permissive ones (MIT/Apache/BSD, what most bioinformatics tools use) don't
  ([license compliance with SBOM](https://safedep.io/license-compliance-with-sbom/)) — worth knowing before
  this project is ever distributed or commercialized, not discovered after the fact. **Status as of
  2026-09-13**: done — see `docs/SBOM.md` for the full inventory (all 11 pinned images + the UI's
  `.venv-ui`, generated with `syft`, license histogram per source, and a copyleft-obligation risk
  assessment). Regenerate it whenever a tool/tag changes, per §10.
- **Secrets hygiene**: this repo already avoids committing credentials (`.gitignore` covers `.env`,
  `*.pem`, `credentials*.json`); the WSL sudo password given this session was stored only in Claude's own
  memory system, never in a repo file — keep this discipline for anything future (API keys for AWS/Seqera
  when that phase starts). Standard CI/CD practice: automated secrets scanning in the pipeline
  ([CI/CD secrets scanning](https://www.paloaltonetworks.com/resources/datasheets/cicd-security-checklist)).
  **Status as of 2026-09-13**: done — `.github/workflows/ci.yml`'s `secrets-scan` job runs `gitleaks detect`
  against the full git history on every push (installed as a checksum-verified binary, not the marketplace
  Action, which requires a paid license for private repos). Verified locally first: 24-commit real git
  history scanned clean; a separate filesystem-only pass found 2 false positives inside the gitignored
  `.venv-ui/` (a vendored JS source map), which a real CI checkout never even has present.
- **Input handling**: the one real "untrusted input" surface this project has is the user-supplied
  samplesheet CSV (fastq/contigs file *paths*, not arbitrary code) — Nextflow's own `file(x,
  checkIfExists: true)` staging is the validation boundary already in place. No SQL, no shell
  interpolation of user-controlled strings into a command anywhere in this codebase (verified by inspection
  of `bin/run.sh`/`ui/app.py`'s `subprocess.Popen` calls, which pass argument lists, never a shell string
  built from user input) — keep this invariant for any future param the UI exposes: always pass as a list
  argument, never format user input into a shell string.
- **Least privilege**: containers already run as the host user, not root (`docker.runOptions`); the
  `.wslconfig`/`vmIdleTimeout` change discussed in §6.14 is explicitly left to the user rather than applied
  by an agent, matching the general principle that system-level configuration changes need a human decision,
  not an automated one.

---

## 7. Observability & production-readiness requirements — new 2026-09-12

A production-readiness review checks a service is reliable, observable, secure, and operable across a
fixed set of dimensions before it's trusted —
[production readiness checklist](https://signoz.io/guides/production-readiness-checklist/). "Observable"
specifically means: when something goes wrong, can you tell *what* and *why* without reproducing it live?
This project already has real strengths here worth naming explicitly, plus real gaps against the standard
**four golden signals** (latency, traffic, errors, saturation) from SRE practice
([observability fundamentals](https://signoz.io/guides/production-readiness-checklist/)):

- **Structured, correlatable logs — partially done.** The FAIR run-report (`results/run-report/run_<ts>.md`)
  already captures run ID/timestamp/params/tool-versions/failure-detail in one place, and `bin/debug.sh`
  surfaces the real failing task's command/stderr — this is a genuinely good, already-built observability
  primitive most projects this size don't bother with. **Gap**: it's a human-readable Markdown file, not a
  structured format (JSON/similar) — fine for a human reading it directly (this project's actual use case),
  but worth noting if this ever needs machine-parsing (e.g., a future dashboard aggregating run history).
- **The harder case — a run succeeded but the result is scientifically wrong — added 2026-09-13**
  (`bin/inspect.sh`). `bin/debug.sh` only helps when Nextflow itself reports a failure; it has nothing to say
  when every task exits 0 but the output doesn't match what the R&D team expected. `bin/inspect.sh <run>`
  lists every task Nextflow executed (process, status, exit, duration, peak RSS); `bin/inspect.sh <run>
  <process>` deep-dives one - its exact command, every file staged into it **with which upstream task
  produced each one** (resolved via the staged symlink's real target, matched back against every task's own
  workdir), and everything it produced for the next node. This is the concrete answer to "read carefully
  what goes into a node and what goes into the next one" - built entirely on what Nextflow already keeps in
  `work/` for every task, not new instrumentation. `bin/inspect.sh --bundle <run>` packages a run's
  `.nextflow.log`, run-report, `pipeline_info/` (trace/DAG/software-versions), a full task manifest, and any
  failed task's command+stderr+stdout into one zip under `debug-bundles/` (gitignored) - for handing a run to
  someone else to diagnose without needing shell access to the machine that ran it. Verified against a real
  pipeline run (not just read for correctness): task listing, cross-task input-lineage resolution
  (`MEGAHIT`'s two input FASTQs correctly traced back to `BOWTIE2_ALIGN`), multi-process substring matching,
  and the bundle - which caught a real bug while testing it: the bundle initially hardcoded `results/` for
  the run-report/pipeline_info, but `--outdir` is a runtime param that can differ per run (as it did in the
  test), so it silently grabbed a *different* run's reports - fixed by recovering the real `--outdir` from
  the run's own recorded command line instead of assuming a fixed path.
- **Metrics — exists but not surfaced.** Nextflow's own trace file
  (`pipeline_info/execution_trace.txt`) already records per-task CPU/memory/realtime/exit-status for every
  run — this *is* the "latency/errors/saturation" data the golden-signals model wants, it's just never been
  aggregated across runs or surfaced anywhere beyond that one run's own file. **Requirement, ties to PLAN.md
  §6.15**: any future dashboard/UI work should treat this trace data as the primary metrics source rather
  than inventing new instrumentation.
- **Alerts — genuinely absent, and honestly out of scope for now.** No alerting exists or is needed for a
  single-user, foreground-launched tool where the user is watching the UI directly; revisit only if this
  ever becomes a genuinely unattended/scheduled service (ties to PLAN.md §6.14's "not yet built" note about
  a real supervising service for unattended recovery).
- **Traces — not applicable in the distributed-tracing sense** (single machine, no microservices), but
  Nextflow's own DAG (`pipeline_info/pipeline_dag.html`, already generated every run) is the closest
  equivalent — a visual record of what ran and in what order, which is what distributed tracing gives a
  microservices architecture. Already built; no gap here.

**Standing rule going forward**: any new failure mode this project's own testing discovers should ask "how
would a user *diagnose* this without me explaining it to them" — and if the answer is "they'd have to ask
someone who understands the internals," that's an observability gap, not just a bug, and belongs in
`docs/KNOWN_ISSUES.md` and/or a `bin/debug.sh` improvement, not just a code fix.

---

## 8. Performance / resource testing requirements

- **Every new tool needs a real, measured resource ceiling before it ships**, not the advertised nf-core
  label taken on faith — this project's own repeated real finding (Kraken2's DB needing far more than the
  test-profile default, geNomad's `mmseqs2` needing ~9GB even with `--splits`) is exactly what the general
  performance-testing literature calls out: measure CPU/memory/disk I/O under a realistic load, don't
  assume — [performance testing checklist](https://www.qasource.com/blog/performance-testing-checklist-10-considerations-when-preparing-for-performance-testing/).
  **Standing procedure for every new module**: run it for real against both the toy fixture and (where
  feasible) a real-scale input, watch `free -h`/`docker stats` while it runs, and pin whatever
  `resourceLimits`/`ext.args` the *real* behavior demands — never guess a number and move on.
- **This project's "load" is different from a typical web app's**: there's no concurrent-user load to
  simulate (single local user), so classic load/stress tooling (JMeter, k6, Gatling) doesn't apply. The
  real performance dimension here is **per-task resource ceiling** and **total wall-clock time for a
  realistic real-data run** — both already tracked informally in `docs/KNOWN_ISSUES.md`'s "Real-data
  validation" entries; worth keeping that habit for every future tool addition (record real timings, not
  just "it finished").
- **Concurrency is a real resource-contention risk on this dev machine specifically** (documented finding,
  `docs/planning/PLAN.md` §1.1): running two memory-heavy things at once can OOM even when each fits
  individually. Any new background/parallel work (another DB download, another real-data run) should check
  `free -h` first and avoid stacking heavy jobs, exactly as this session's own real-data testing had to
  learn the hard way.

---

## 9. Regression testing discipline

- **Prioritize by risk, not by volume** — pick regression cases based on which features are most critical
  and most likely to be affected by a given change, not an attempt to re-run everything every time
  ([regression testing best practices](https://www.opkey.com/blog/top-10-regression-testing-best-practices)).
  This project's `basic`/`requires_db` `nf-test` tag split already implements this (fast suite every time,
  slow DB-dependent suite when relevant) — keep extending new tests into the right tag, not defaulting
  everything into `basic` just because it's simpler to write.
- **Document the regression, not just fix it** — this project's own `docs/KNOWN_ISSUES.md` culture already
  does this (every Fixed entry explains *why* the code looks the way it does specifically so a future
  change doesn't silently reintroduce the same bug) — this is regression-testing best practice by another
  name ("thoroughly documenting your testing process to ensure repeatability,"
  [regression testing checklist](https://gigatester.com/regression-testing-checklist/)); keep doing exactly
  this for every future fix, it's already this project's biggest testing strength.
- **A failed-then-fixed test stays in the suite permanently** — every bug this session found and fixed
  (Fixed #13, #15, #21, the PID-file race, the `bin/run-ui.sh` venv-path bug) has a corresponding assertion
  now baked into `tests/main.nf.test` or verified via the manual browser-test procedure documented in
  `docs/KNOWN_ISSUES.md` — don't let a fix ship without the regression case that proves it, and proves it
  stays fixed.

---

## 10. The post-change checklist

Run through this after *every* update or new implementation, scaled to what actually changed — not every
item applies to every change, but check off which ones do rather than skipping the whole list.

**Always, for any change:**
- [ ] `.venv-ui/bin/ruff check ui/app.py` (installed 2026-09-13) if `ui/app.py` changed - fix real findings,
      `# noqa: CODE` with a one-line reason only for a genuine, deliberate exception (§2.1).
- [ ] `.venv-ui/bin/pytest ui/test_app.py` (installed 2026-09-13, §2.2) if `ui/app.py`'s logic changed -
      the fast, no-browser layer; add a new test case for any new state the UI can be in.
- [ ] `shellcheck bin/*.sh` (installed 2026-09-13, §2.1) if any `bin/*.sh` file changed - this project's
      whole `bin/` directory currently passes clean, keep it that way.
- [ ] Sync Windows ↔ WSL copies and diff-verify (`diff -q`) every touched file — this project's own
      established two-copy workflow, a real and recurring source of "it works on one side but not the
      other" bugs this session hit repeatedly.
- [ ] `nf-test test tests/main.nf.test --tag basic --profile test,docker` — must stay green. If it wasn't
      already green before your change, fix that first; don't add new work on top of a known-red suite.

**If a pipeline module/workflow file changed (`workflows/microbox.nf`, `modules/`, `conf/*.config`):**
- [ ] New/changed behavior has a `nf-test` case asserting **real content**, not just `workflow.success` or
      `path(...).exists()` (§2's data-integrity rule).
- [ ] If it touches a DB-dependent stage: run the relevant `requires_db`-tagged test(s) too, with the real
      DB actually downloaded, not skipped.
- [ ] If it's a new tool: real, measured `resourceLimits` (§8), verified container tag with a real
      checksum if it's a fetched artifact (§2), and a check of whether MultiQC has native support for it
      (verify live against `docs.seqera.io/multiqc/modules/`, don't assume) — if not, either add a small
      custom-content `_mqc.yml` summary or explicitly document why the report gap is acceptable.
- [ ] Full `basic` + (if relevant) `requires_db` suite green, checked by actually reading the pass/fail
      output, not assumed from "the command didn't error."

**If `ui/app.py` changed:**
- [ ] Manually click through the real flow at least once via browser automation (`claude-in-chrome`) —
      upload, run, watch status, reload as a *second, independent* session, check the report renders.
- [ ] If it touches shared on-disk state (a PID file, a log file, anything not scoped to one session):
      explicitly test from two independent sessions/tabs, not just one (§4.1's session-state rule).
- [ ] If it touches process launching/lifecycle: verify with `ps -o pid,ppid,pgid,sid` that the process
      tree looks the way the code assumes (own process group if that's claimed, etc.) — don't trust the
      `subprocess.Popen` call looks right by reading it.
- [ ] Re-check the change against §4.1's Nielsen-heuristic table — does it introduce a new error state
      without a plain-language message (heuristic 9)? A new option without an explanation (heuristic 2)? A
      new piece of state the user has to remember (heuristic 6)? Update the table if the answer changes it.

**If `bin/run.sh`, `bin/run-ui.sh`, or the CLI/UI contract changed:**
- [ ] Re-verify the contract from *both* directions (§3): a CLI run and a UI-triggered run both still
      produce the same `results/` shape.
- [ ] If it touches process detachment/backgrounding: actually test surviving what it claims to survive
      (closing the shell that launched it, a SIGHUP, etc.) — this session's own first `setsid`/`nohup`
      attempt looked correct and wasn't; only a real test caught it.
- [ ] Grep the other side of the contract (`ui/app.py` ↔ `bin/*.sh`) for any hardcoded path/flag that the
      change might have silently broken.
- [ ] Re-check against §4.3's CLI UX criteria (clear usage message on bad args, non-destructive by default).

**If a download/DB-fetch mechanism changed (`bin/download-dbs.sh` or similar):**
- [ ] Actually delete the target and re-download for real at least once — don't just verify the "already
      downloaded" skip-path.
- [ ] Verify the resulting files are readable by the *pipeline's* containers (host-user-mapped), not just
      by whichever shell ran the download — the `-u $(id -u):$(id -g)` permission bug found twice this
      session (`docs/KNOWN_ISSUES.md`) is exactly the failure mode this step catches.

**Before anything gets called "done" against real data (not just the toy fixture):**
- [ ] Run against real-scale data at least once, watching `free -h`/`docker stats` throughout (§8).
- [ ] Sanity-check the *scientific* result against known truth where possible (this session's
      Coronaviridae/ZymoBIOMICS-composition checks), not just "the process exited 0."

**Occasionally, not per-change (revisit cadence in parentheses):**
- [ ] Scan pinned container images for new CVEs (§6) — before adopting any new tag, and periodically for
      already-adopted ones.
- [ ] Regenerate an SBOM / license inventory (§6) — before any release/handover milestone, and whenever a
      new tool/dependency is added.
- [ ] Re-run a full real-data E2E pass end to end (CLI and UI) — before any release/handover milestone.
- [ ] Run one real, unscripted exploratory/usability session (§4.5) — before any UI-facing milestone,
      ideally with someone who didn't build the feature.
- [ ] Revisit this document itself when a new layer or contract gets added (e.g., if a REST API or a
      different UI framework is ever introduced per the GUI-agnostic principle) — the pyramid in §1 and the
      contract discipline in §3 need a fresh pass any time the number of layers changes.

---

## Sources

- [Testing Pyramid 2026 guide](https://testomat.io/blog/testing-pyramid-role-in-modern-software-testing-strategies/) — testomat.io
- [The Test Pyramid in 2026](https://www.onpathtesting.com/blog/the-test-pyramid-in-2026-still-relevant-still-necessary/) — onpathtesting.com
- [Testing pyramid explainer](https://circleci.com/blog/testing-pyramid/) — CircleCI
- [nf-core testing guidelines](https://nf-co.re/docs/guidelines/pipelines/recommendations/testing)
- [Leveraging nf-test for quality control in nf-core](https://seqera.io/blog/nf-test-in-nf-core/) — Seqera
- [nf-test official docs](https://www.nf-test.com/)
- [Reproducible bioinformatics pipeline engineering](https://www.frontiersin.org/journals/bioinformatics/articles/10.3389/fbinf.2026.1824590/full) — Frontiers
- [Streamlit app testing framework](https://docs.streamlit.io/develop/concepts/app-testing)
- [Streamlit AppTest API reference](https://docs.streamlit.io/develop/api-reference/app-testing/st.testing.v1.apptest)
- [API contract testing best practices](https://www.accelq.com/blog/api-contract-testing/) — AccelQ
- [Guide to contract testing](https://zuplo.com/learning-center/guide-to-contract-testing-for-api-reliability) — Zuplo
- [OWASP Web Security Testing Guide overview](https://hackerdna.com/blog/owasp-web-security-testing-guide)
- [Chaos testing complete guide](https://katalon.com/resources-center/blog/chaos-testing-a-complete-guide) — Katalon
- [AWS Well-Architected — test resiliency with chaos engineering](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_failure_injection_resiliency.html)
- [Docker container security best practices](https://www.wiz.io/academy/container-security/docker-container-security-best-practices) — Wiz
- [Container image scanning best practices](https://www.sysdig.com/learn-cloud-native/12-container-image-scanning-best-practices) — Sysdig
- [WCAG 2.2 accessibility testing guide](https://www.thewcag.com/testing-guide)
- [Performance testing checklist](https://www.qasource.com/blog/performance-testing-checklist-10-considerations-when-preparing-for-performance-testing/) — QASource
- [Regression testing best practices](https://www.opkey.com/blog/top-10-regression-testing-best-practices) — Opkey
- [Regression testing checklist](https://gigatester.com/regression-testing-checklist/) — GigaTester
- [Snapshot testing benefits and pitfalls](https://teachmeidea.com/snapshot-testing-benefits-pitfalls-when-to-use/)
- [Data integrity in a data pipeline](https://medium.com/@georgemichaeldagogomaynard/data-integrity-in-a-data-pipeline-best-practices-and-strategies-for-data-quality-checks-dim-71af7a3bf21e)
- [AWS Life Sciences Lens — data integrity monitoring](https://docs.aws.amazon.com/wellarchitected/latest/life-sciences-lens/lsrel13-bp02.html)
- [CI/CD pipeline security checklist](https://www.paloaltonetworks.com/resources/datasheets/cicd-security-checklist) — Palo Alto Networks
- [Playwright best practices 2026](https://www.browserstack.com/guide/playwright-best-practices) — BrowserStack
- [Avoiding flaky Playwright tests](https://testdino.com/blog/playwright-automation-checklist) — TestDino
- [Nielsen's 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) — Nielsen Norman Group
- [UX audit checklist based on Nielsen's heuristics](https://www.eleken.co/blog-posts/a-checklist-for-ux-design-audit-based-on-jakob-nielsens-10-usability-heuristics) — Eleken
- [Error message & user guidance design](https://www.linkedin.com/pulse/guide-error-messages-user-guidance-agetech-ux-ezra-schwartz-vh07c)
- [Product design UI/UX review checklist](https://medium.com/@atul.shashikumar/product-design-ui-ux-review-checklist-525a0a1b0c77)
- [Command Line Interface Guidelines (clig.dev)](https://clig.dev/)
- [Thoughtworks CLI design guidelines](https://www.thoughtworks.com/insights/blog/engineering-effectiveness/elevate-developer-experiences-cli-design-guidelines)
- [Command-line UX principles](https://relay.sh/blog/command-line-ux-in-2020/) — Puppet Relay
- [Visual regression testing tools 2026](https://percy.io/blog/visual-regression-testing-tools/) — Percy
- [Screenshot testing guide](https://percy.io/blog/visual-screenshot-testing) — Percy
- [Exploratory testing checklist](https://www.globalapptesting.com/blog/exploratory-testing-checklist) — Global App Testing
- [Exploratory testing](https://en.wikipedia.org/wiki/Exploratory_testing) — Wikipedia
- [Mutation testing vs. code coverage](https://about.codecov.io/blog/mutation-testing-how-to-ensure-code-coverage-isnt-a-vanity-metric/) — Codecov
- [Mutation testing vs. code coverage, further](https://getautonoma.com/blog/mutation-testing-vs-code-coverage) — Autonoma
- [Mutation testing guide](https://bell-sw.com/blog/a-comprehensive-guide-to-mutation-testing-in-java/) — BellSoft
- [Static code analysis strategy 2026](https://cycode.com/blog/static-code-analysis/) — Cycode
- [SBOM minimum elements (NTIA)](https://www.ntia.gov/sites/default/files/publications/sbom_minimum_elements_report_0.pdf)
- [SBOM standards guide](https://www.kiuwan.com/blog/sbom-standards/) — Kiuwan
- [License compliance with SBOM](https://safedep.io/license-compliance-with-sbom/) — SafeDep
- [Production readiness checklist](https://signoz.io/guides/production-readiness-checklist/) — SigNoz
