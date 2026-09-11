"""Thin launcher UI: drag in a samplesheet, run the pipeline, open the report.

No official Streamlit primitive exists for background subprocesses (see
streamlit/streamlit#9310). Pattern used here: subprocess.Popen (never the
blocking .run()) + st.session_state to keep the process handle across
reruns + st.fragment(run_every=...) to poll it without a full-page rerun.
"""

import subprocess
from pathlib import Path

import streamlit as st

REPO_ROOT = Path(__file__).resolve().parent.parent
RUN_SCRIPT = REPO_ROOT / "bin" / "run.sh"
MULTIQC_REPORT = REPO_ROOT / "results" / "multiqc" / "multiqc_report.html"
UPLOAD_DIR = REPO_ROOT / "assets" / "uploads"
LOG_PATH = REPO_ROOT / ".streamlit_run.log"

st.set_page_config(page_title="microbox", page_icon="\U0001f9ec", layout="centered")
st.title("microbox")
st.caption("Drop a samplesheet, click Run, open the report when it's done.")

st.session_state.setdefault("proc", None)

profile = st.selectbox("Environment", ["dev", "test", "test_aws", "prod"], index=0)
uploaded = st.file_uploader("Samplesheet (CSV)", type="csv")

proc = st.session_state.proc
is_running = proc is not None and proc.poll() is None

if st.button("Run", disabled=is_running or uploaded is None, type="primary"):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    samplesheet_path = UPLOAD_DIR / uploaded.name
    samplesheet_path.write_bytes(uploaded.getvalue())

    log_file = open(LOG_PATH, "w")
    st.session_state.proc = subprocess.Popen(
        ["bash", str(RUN_SCRIPT), str(samplesheet_path), "--profile", profile],
        cwd=REPO_ROOT,
        stdout=log_file,
        stderr=subprocess.STDOUT,
    )
    st.rerun()


@st.fragment(run_every=2 if is_running else None)
def status_panel() -> None:
    proc = st.session_state.proc
    if proc is None:
        st.info("No run started yet.")
        return

    return_code = proc.poll()
    label = "Running..." if return_code is None else "Completed" if return_code == 0 else f"Failed (exit {return_code})"
    state = "running" if return_code is None else "complete" if return_code == 0 else "error"

    with st.status(label, state=state, expanded=return_code not in (None, 0)):
        if LOG_PATH.exists():
            tail = LOG_PATH.read_text(errors="ignore")[-3000:]
            st.code(tail or "(no output yet)", language="text")

    if return_code == 0 and MULTIQC_REPORT.exists():
        st.success("Report ready.")
        st.components.v1.html(MULTIQC_REPORT.read_text(errors="ignore"), height=800, scrolling=True)
    elif return_code == 0:
        st.warning(f"Run finished but no report found at {MULTIQC_REPORT}.")


status_panel()
