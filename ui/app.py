"""Thin launcher UI: drag in a samplesheet, run the pipeline, open the report.

No official Streamlit primitive exists for background subprocesses (see
streamlit/streamlit#9310). Pattern used here: subprocess.Popen (never the
blocking .run()) + st.session_state to keep the process handle across
reruns + st.fragment(run_every=...) to poll it without a full-page rerun.
"""

import datetime
import json
import os
import shutil
import signal
import subprocess
from pathlib import Path

import streamlit as st

REPO_ROOT = Path(__file__).resolve().parent.parent
RUN_SCRIPT = REPO_ROOT / "bin" / "run.sh"
DEBUG_SCRIPT = REPO_ROOT / "bin" / "debug.sh"
RESULTS_ROOT = REPO_ROOT / "results"
UPLOAD_DIR = REPO_ROOT / "assets" / "uploads"
LOG_PATH = REPO_ROOT / ".streamlit_run.log"
# Replaces the old bare-PID-text .streamlit_run.pid, 2026-09-13 (owner: "we
# see all previous runs, we can delete some, export some and view what we
# select"): each run now gets its own timestamped --outdir (bin/run.sh),
# so reattaching to a run that's still in progress needs to know WHICH
# outdir it's using, not just that it's alive - a plain pid number isn't
# enough information anymore. Written when a run starts, removed when the
# UI itself notices it finished. Survives independently of any one browser
# session's st.session_state, same reasoning as the file it replaces.
RUN_META_FILE = REPO_ROOT / ".streamlit_run.json"


def _pid_alive(pid: int) -> bool:
    """True if a process with this PID exists (doesn't need to be ours)."""
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _report_path(outdir: str) -> Path:
    return REPO_ROOT / outdir / "multiqc" / "multiqc_report.html"


def _latest_report() -> Path | None:
    """Most recently generated report across every retained run, or None.

    Used only when nothing (this session or a reattached one) names a
    specific run to show - the general "no run tracked, but something
    finished at some point" fallback. Run History (composer-ui) is the
    real way to browse every retained run; this is just this page's own
    still-useful default view.
    """
    reports = list(RESULTS_ROOT.glob("run_*/multiqc/multiqc_report.html"))
    return max(reports, key=lambda p: p.stat().st_mtime) if reports else None


# layout="wide" (was "centered") - owner 2026-09-13: "so much wasted space".
# Streamlit's "centered" layout fixes content to a narrow, ~730px column
# regardless of window width, leaving large empty margins on wide screens -
# especially noticeable once this page is itself embedded as a full-height
# iframe inside composer-ui (RunPipelinePage.tsx) rather than viewed as its
# own standalone browser tab.
st.set_page_config(page_title="microbox", page_icon="\U0001f9ec", layout="wide")
st.title("microbox")
st.caption("Drop a samplesheet, click Run, open the report when it's done.")

st.session_state.setdefault("proc", None)
st.session_state.setdefault("outdir", None)

# "test" listed (and defaulted to) first, not "dev": found 2026-09-11
# click-testing this exact dropdown end to end - dev/prod have no Nextflow
# profile block yet (docs/KNOWN_ISSUES.md #3, a known and documented gap),
# so defaulting to "dev" meant every first-time user who just uploaded a
# file and clicked Run got an opaque failure before ever seeing the
# pipeline itself run. "test" is the only profile that works with zero
# setup today; the others stay in the list (so the option is visible and
# the gap stays honest) but never as the trap a new user lands on by
# default. No separate "test_aws" tier - removed 2026-09-13 (owner:
# "its going to be just a windows running in ec2... there should be just
# dev and prod") - production is one normal Windows EC2 VM (PLAN.md §7's
# resolved deployment decision), not a distinct AWS-only environment.
profile = st.selectbox("Environment", ["test", "dev", "prod"], index=0)
uploaded = st.file_uploader("Samplesheet (CSV)", type="csv")

proc = st.session_state.proc
is_running = proc is not None and proc.poll() is None
if not is_running and RUN_META_FILE.exists():
    # No live Popen in *this* session, but a run started from a different
    # session (another tab, another browser, a fresh reload) might still be
    # going - check the PID it left behind. Needed so the `run_every=2`
    # auto-poll below actually fires for a reattached run too, not just one
    # this exact session started.
    try:
        meta = json.loads(RUN_META_FILE.read_text())
        is_running = _pid_alive(int(meta["pid"]))
    except (ValueError, KeyError, json.JSONDecodeError):
        pass

# Disk-space preflight - added 2026-09-12, same "go home and comeback"
# quality-of-life pass. Real DBs downloaded this session were multi-GB
# (Kraken2 ~6GB, geNomad ~5GB, CheckV ~1.6GB) and a run failing hours in
# because the disk quietly filled up is a much worse experience than a
# warning before it even starts. A fixed 10GB floor is a deliberately
# simple heuristic, not a real per-run estimate (that would need knowing
# which DBs/tools this particular run will touch, which the UI doesn't
# have enough parameter visibility into yet - PLAN.md's node-based
# composer, once built, is where a real per-selection estimate belongs).
_free_gb = shutil.disk_usage(REPO_ROOT).free / (1024**3)
if _free_gb < 10:
    st.warning(
        f"Only {_free_gb:.1f} GB free on this disk. Real database downloads and "
        "assembly outputs can need several GB each - a run may fail partway through "
        "if space runs out. Not blocking the run, just flagging it before it starts."
    )

if st.button("Run", disabled=is_running or uploaded is None, type="primary"):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    samplesheet_path = UPLOAD_DIR / uploaded.name
    samplesheet_path.write_bytes(uploaded.getvalue())

    # A fresh, timestamped --outdir per run (not the old fixed 'results/')
    # - 2026-09-13, so every run's full output (including its own
    # multiqc_report.html) is retained side by side instead of the next
    # run silently overwriting it. bin/run.sh's own default is unchanged
    # for plain CLI use (no --outdir given there still means 'results/') -
    # this UI is the one caller that actually wants per-run history, so it's
    # the one that asks for it explicitly.
    run_outdir = f"results/run_{datetime.datetime.now().astimezone():%Y%m%d_%H%M%S}"

    # Deliberate, not an oversight, hence the noqa below: this handle is
    # NOT closed here or wrapped in `with` - it's handed to subprocess.Popen
    # below as stdout and must stay open for the run's entire lifetime,
    # which starting immediately after Popen returns (as `with` would force)
    # would break. Python closes it when this variable is reassigned on the
    # next run or the process ends; an explicit close isn't needed since
    # nothing else in this process reads or writes LOG_PATH concurrently.
    log_file = open(LOG_PATH, "w")  # noqa: SIM115
    # start_new_session=True: makes this subprocess (and everything it in
    # turn spawns - nextflow, tee) its own process-group leader, separate
    # from Streamlit's own group. Needed for the Cancel button below to be
    # able to signal the whole run tree via os.killpg() without also
    # signaling the Streamlit server it's part of otherwise.
    new_proc = subprocess.Popen(
        ["bash", str(RUN_SCRIPT), str(samplesheet_path), "--profile", profile, "--outdir", run_outdir],
        cwd=REPO_ROOT,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    st.session_state.proc = new_proc
    st.session_state.outdir = run_outdir
    RUN_META_FILE.write_text(json.dumps({"pid": new_proc.pid, "outdir": run_outdir}))
    st.rerun()


def _cancel_run(pid: int) -> None:
    # Signal the whole process GROUP, not just this one pid - bin/run.sh's
    # own PID is a bash script running `nextflow run ... | tee ...` in its
    # foreground; bash's default disposition for SIGTERM is to just die
    # immediately, which does NOT propagate to its own nextflow/tee children
    # (Unix doesn't auto-kill children when a parent dies). Popen was
    # launched with start_new_session=True specifically so this pid is its
    # own process-group leader, separate from Streamlit's - killpg reaches
    # bin/run.sh, nextflow, and tee together. Nextflow's own SIGTERM handler
    # then does its usual best-effort cleanup of task containers it started;
    # a container for a task that's deep into its own execution may still
    # finish naturally rather than stopping instantly - not fixable from out
    # here, and worth knowing about rather than assuming Cancel is instant.
    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
    except ProcessLookupError:
        pass
    RUN_META_FILE.unlink(missing_ok=True)


@st.fragment(run_every=2 if is_running else None)
def status_panel() -> None:
    proc = st.session_state.proc
    if proc is None:
        # Reattachment - added 2026-09-12 (owner: "what if they go home and
        # comeback the next day"), closing the one gap Fixed #21 deliberately
        # left open: that fix recovers a *finished* run's report after a
        # fresh session (page reload, new tab, another device), but gives no
        # signal at all for a run that's still genuinely in progress when the
        # session reloads - only "no run tracked" or "here's an old report,"
        # never "it's still going, check back." RUN_META_FILE (written when
        # Run is clicked) survives independently of any one session's
        # st.session_state, so a fresh session can tell the difference.
        if RUN_META_FILE.exists():
            pid = None
            try:
                meta = json.loads(RUN_META_FILE.read_text())
                pid = int(meta["pid"])
            except (ValueError, KeyError, json.JSONDecodeError):
                pass
            if pid is not None and _pid_alive(pid):
                st.info("A run is still in progress, started from a different session - this page will keep checking while it's open.")
                # Raw Nextflow output (container pull logs, work-directory
                # paths, etc.) - real, but not meant for a first glance;
                # owner 2026-09-13: "i dont understand the complicated wsl
                # paths like that". Opt-in via an expander, same pattern used
                # everywhere else in this file this pass touches.
                if LOG_PATH.exists():
                    with st.expander("Technical details (raw pipeline output)"):
                        tail = LOG_PATH.read_text(errors="ignore")[-3000:]
                        st.code(tail or "(no output yet)", language="text")
                if st.button("Cancel this run", key="cancel_reattached"):
                    _cancel_run(pid)
                    st.rerun()
                return
            # Stale file - the process it named is gone (crashed, or finished
            # in a session that never got the chance to clean up after it).
            RUN_META_FILE.unlink(missing_ok=True)
        # A page reload/reconnect (new tab, refresh, different device) starts
        # a brand new Streamlit session with no session_state at all - the
        # subprocess handle above is gone even if that subprocess finished
        # successfully seconds ago. Found 2026-09-12 real-data UI testing: a
        # completed run with a real report sitting on disk showed as "No run
        # started yet.", making the result invisible unless the same browser
        # tab stayed open and focused the whole time (background-tab timer
        # throttling alone can make a still-open tab look stuck on
        # "Running..." for minutes after the process actually exited). A
        # finished run's report is just a file, and hiding a file that's
        # already on disk is strictly worse than showing it with its age so
        # the viewer can judge freshness themselves. Every past run is kept
        # now (2026-09-13, its own timestamped outdir), so this shows
        # whichever one is genuinely the most recent - see Run History for
        # every other one.
        latest_report = _latest_report()
        if latest_report is not None:
            # .astimezone() attaches the system's local tzinfo to what would
            # otherwise be a naive datetime - same displayed wall-clock value
            # as before (this machine's local time), just explicit about it
            # rather than ambiguous, per Ruff's DTZ006.
            mtime = datetime.datetime.fromtimestamp(latest_report.stat().st_mtime).astimezone()
            st.info(
                "No run is tracked in this browser session, but a report already exists on disk "
                f"(generated {mtime:%Y-%m-%d %H:%M:%S}) - showing it below. If you just started a run "
                "in another tab, wait for it to finish, then refresh this page. Every past run is kept - "
                "see Run History to browse all of them."
            )
            st.components.v1.html(latest_report.read_text(errors="ignore"), height=800, scrolling=True)
        else:
            st.info("No run started yet.")
        return

    return_code = proc.poll()
    label = "Running..." if return_code is None else "Completed" if return_code == 0 else f"Failed (exit {return_code})"
    state = "running" if return_code is None else "complete" if return_code == 0 else "error"
    multiqc_report = _report_path(st.session_state.outdir)

    if return_code is None:
        if st.button("Cancel this run", key="cancel_tracked"):
            _cancel_run(proc.pid)
            st.rerun()
    else:
        # Run reached a real end state - clean up the meta file, but ONLY if
        # it still names *this* run. Found the hard way testing this exact
        # scenario 2026-09-12: the meta file is shared, not scoped per
        # session - a tab left open after its own run finished still reruns
        # this fragment periodically (Streamlit reruns on almost any
        # interaction, not just the run_every timer), and an unconditional
        # unlink() here would delete a *different*, newer run's meta file out
        # from under it if one had since started elsewhere. Comparing
        # against proc.pid before deleting is what makes this safe.
        try:
            if RUN_META_FILE.exists() and json.loads(RUN_META_FILE.read_text())["pid"] == proc.pid:
                RUN_META_FILE.unlink()
        except (ValueError, KeyError, json.JSONDecodeError):
            pass

    with st.status(label, state=state, expanded=return_code not in (None, 0)):
        if LOG_PATH.exists():
            tail = LOG_PATH.read_text(errors="ignore")[-3000:]
            st.code(tail or "(no output yet)", language="text")

    # Added 2026-09-11 (owner: "add debugging, to make fixing bugs easier"),
    # same session bin/debug.sh was built in. The raw log tail above is
    # capped at the last 3000 characters - on a run with a lot of container-
    # pull noise (this repo has hit that constantly during development) the
    # actual error can scroll off the top of that window entirely. Running
    # bin/debug.sh here surfaces the failed task's real command/stderr
    # directly, the same way it does from the CLI - no need to already know
    # the tool exists or go find a terminal to run it in.
    if return_code not in (None, 0):
        debug_result = subprocess.run(
            ["bash", str(DEBUG_SCRIPT)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,  # bin/debug.sh's own exit code isn't meaningful here - its stdout/stderr is
        )
        st.subheader("What failed")
        st.code(debug_result.stdout or "(bin/debug.sh produced no output)", language="text")
        if debug_result.stderr:
            st.caption(debug_result.stderr)

    if return_code == 0 and multiqc_report.exists():
        st.success("Report ready - also available anytime from the Run History page.")
        st.components.v1.html(multiqc_report.read_text(errors="ignore"), height=800, scrolling=True)
    elif return_code == 0:
        # No raw filesystem path in the message - owner 2026-09-13: "i dont
        # expect nontechnical people to have to access a path... like that."
        # The real path is still in "Technical details" for anyone who does
        # want it.
        st.warning("Run finished, but no report was produced.")
        with st.expander("Technical details"):
            st.code(str(multiqc_report), language="text")


status_panel()
