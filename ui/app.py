"""Thin launcher UI: drag in a samplesheet, run the pipeline, open the report.

No official Streamlit primitive exists for background subprocesses (see
streamlit/streamlit#9310). Pattern used here: subprocess.Popen (never the
blocking .run()) + st.session_state to keep the process handle across
reruns + st.fragment(run_every=...) to poll it without a full-page rerun.
"""

import datetime
import os
import shutil
import signal
import subprocess
from pathlib import Path

import streamlit as st

REPO_ROOT = Path(__file__).resolve().parent.parent
RUN_SCRIPT = REPO_ROOT / "bin" / "run.sh"
DEBUG_SCRIPT = REPO_ROOT / "bin" / "debug.sh"
MULTIQC_REPORT = REPO_ROOT / "results" / "multiqc" / "multiqc_report.html"
UPLOAD_DIR = REPO_ROOT / "assets" / "uploads"
LOG_PATH = REPO_ROOT / ".streamlit_run.log"
# Written when a run starts, removed when the UI itself notices it finished -
# added 2026-09-12 (owner: "what if they go home and comeback the next day")
# to close the one gap Fixed #21 deliberately left open: that fix recovers a
# *finished* run's report after a fresh session (page reload, new tab,
# another device), but a session that reloads while a run is still genuinely
# in progress had no way to know that - only "no run tracked" or "here's an
# old report," never "still running, check back." A live process's PID
# survives independently of any one browser session's st.session_state.
PID_FILE = REPO_ROOT / ".streamlit_run.pid"


def _pid_alive(pid: int) -> bool:
    """True if a process with this PID exists (doesn't need to be ours)."""
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True

st.set_page_config(page_title="microbox", page_icon="\U0001f9ec", layout="centered")
st.title("microbox")
st.caption("Drop a samplesheet, click Run, open the report when it's done.")

st.session_state.setdefault("proc", None)

# "test" listed (and defaulted to) first, not "dev": found 2026-09-11
# click-testing this exact dropdown end to end - dev/test_aws/prod have no
# Nextflow profile block yet (docs/KNOWN_ISSUES.md #3, a known and
# documented gap), so defaulting to "dev" meant every first-time user who
# just uploaded a file and clicked Run got an opaque failure before ever
# seeing the pipeline itself run. "test" is the only profile that works with
# zero setup today; the others stay in the list (so the option is visible
# and the gap stays honest) but never as the trap a new user lands on by
# default.
profile = st.selectbox("Environment", ["test", "dev", "test_aws", "prod"], index=0)
uploaded = st.file_uploader("Samplesheet (CSV)", type="csv")

proc = st.session_state.proc
is_running = proc is not None and proc.poll() is None
if not is_running and PID_FILE.exists():
    # No live Popen in *this* session, but a run started from a different
    # session (another tab, another browser, a fresh reload) might still be
    # going - check the PID it left behind. Needed so the `run_every=2`
    # auto-poll below actually fires for a reattached run too, not just one
    # this exact session started.
    try:
        is_running = _pid_alive(int(PID_FILE.read_text().strip()))
    except ValueError:
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
        ["bash", str(RUN_SCRIPT), str(samplesheet_path), "--profile", profile],
        cwd=REPO_ROOT,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    st.session_state.proc = new_proc
    PID_FILE.write_text(str(new_proc.pid))
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
    PID_FILE.unlink(missing_ok=True)


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
        # never "it's still going, check back." PID_FILE (written when Run is
        # clicked) survives independently of any one session's
        # st.session_state, so a fresh session can tell the difference.
        if PID_FILE.exists():
            try:
                pid = int(PID_FILE.read_text().strip())
            except ValueError:
                pid = None
            if pid is not None and _pid_alive(pid):
                st.info(
                    f"A run (PID {pid}) is still in progress, started from a different "
                    "session - this page will keep checking while it's open."
                )
                if LOG_PATH.exists():
                    tail = LOG_PATH.read_text(errors="ignore")[-3000:]
                    st.code(tail or "(no output yet)", language="text")
                if st.button("Cancel this run", key="cancel_reattached"):
                    _cancel_run(pid)
                    st.rerun()
                return
            # Stale file - the process it named is gone (crashed, or finished
            # in a session that never got the chance to clean up after it).
            PID_FILE.unlink(missing_ok=True)
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
        # the viewer can judge freshness themselves.
        if MULTIQC_REPORT.exists():
            # .astimezone() attaches the system's local tzinfo to what would
            # otherwise be a naive datetime - same displayed wall-clock value
            # as before (this machine's local time), just explicit about it
            # rather than ambiguous, per Ruff's DTZ006.
            mtime = datetime.datetime.fromtimestamp(MULTIQC_REPORT.stat().st_mtime).astimezone()
            st.info(
                "No run is tracked in this browser session, but a report already exists on disk "
                f"(generated {mtime:%Y-%m-%d %H:%M:%S}) - showing it below. If you just started a run "
                "in another tab, wait for it to finish, then refresh this page."
            )
            st.components.v1.html(MULTIQC_REPORT.read_text(errors="ignore"), height=800, scrolling=True)
        else:
            st.info("No run started yet.")
        return

    return_code = proc.poll()
    label = "Running..." if return_code is None else "Completed" if return_code == 0 else f"Failed (exit {return_code})"
    state = "running" if return_code is None else "complete" if return_code == 0 else "error"

    if return_code is None:
        if st.button("Cancel this run", key="cancel_tracked"):
            _cancel_run(proc.pid)
            st.rerun()
    else:
        # Run reached a real end state - clean up the PID file, but ONLY if
        # it still names *this* run. Found the hard way testing this exact
        # scenario 2026-09-12: PID_FILE is a single shared file, not scoped
        # per session - a tab left open after its own run finished still
        # reruns this fragment periodically (Streamlit reruns on almost any
        # interaction, not just the run_every timer), and an unconditional
        # unlink() here would delete a *different*, newer run's PID file out
        # from under it if one had since started elsewhere. Comparing
        # against proc.pid before deleting is what makes this safe.
        try:
            if PID_FILE.exists() and int(PID_FILE.read_text().strip()) == proc.pid:
                PID_FILE.unlink()
        except ValueError:
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

    if return_code == 0 and MULTIQC_REPORT.exists():
        st.success("Report ready.")
        st.components.v1.html(MULTIQC_REPORT.read_text(errors="ignore"), height=800, scrolling=True)
    elif return_code == 0:
        st.warning(f"Run finished but no report found at {MULTIQC_REPORT}.")


status_panel()
