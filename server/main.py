"""Real backend for the UI (PLAN.md §6.12/Phase 1 of the full-architecture plan).

Consolidates two previously-separate, dev-only/single-app implementations of "list/serve
real run results" and "launch a real run" into one real service, reusable by BOTH the
Composer canvas (once its own Run button goes live, Phase 3) and a rebuilt Run/History
experience - rather than three different pieces (Streamlit's own subprocess launcher,
composer-ui's dev-only serve-results-plugin.ts, and whatever Composer would otherwise need
built from scratch) doing overlapping jobs.

Phase 1: list/get/delete a run's real results, serve its files, and launch a new run by
reusing bin/run.sh exactly as ui/app.py already does (subprocess.Popen,
start_new_session=True so the whole process tree - bin/run.sh, nextflow, tee - can be
signalled together on cancel). Legacy URL paths (`/reports-api/runs`, `/reports/...`) are
preserved exactly so the existing HistoryPage.tsx needs zero changes to point at this real
backend instead of the Vite dev plugin.

Phase 2 (added 2026-09-14): live per-run status via Nextflow's own `-with-weblog`. launch_run
now passes `--weblog-url http://127.0.0.1:<port>/api/telemetry/{run_id}` to bin/run.sh (a
no-op for every other caller - the flag is optional there); the receiver appends each event
to that run's own `pipeline_info/weblog_events.jsonl` (filesystem-first, matching this
project's no-DB pattern - see the plan's item 4). `GET /api/runs/{run_id}` parses that file
into a per-process status map. Per the plan's own documented caveat (and the
seandavi/nextflow_telemetry reference implementation it's modeled on), Nextflow's last
weblog event(s) can drop on exit - so this endpoint never trusts the weblog alone for
*final* state: it also checks whether the launching pid is still alive (run_meta.json,
written at launch) and whether a report now exists, and prefers those once the process has
actually exited. The weblog is for live progress only.
"""

from __future__ import annotations

import datetime
import json
import os
import re
import signal
import subprocess
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parent.parent
RUN_SCRIPT = REPO_ROOT / "bin" / "run.sh"
RESULTS_ROOT = REPO_ROOT / "results"
UPLOAD_DIR = REPO_ROOT / "assets" / "uploads"

RUN_ID_PATTERN = re.compile(r"^run_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$")

# Used only to build the --weblog-url this backend hands to bin/run.sh (Nextflow calls
# this backend back on this same port) - not a general "where am I" setting, since this
# process only ever runs on 127.0.0.1 for a single local user (§6.8 item 10).
BACKEND_PORT = 8000

app = FastAPI(title="microbox backend")


# ---- Run listing/serving - same contract as composer-ui/serve-results-plugin.ts -------


def _parse_run_id(run_id: str, fallback_mtime: float) -> str:
    """Mirrors serve-results-plugin.ts's parseRunId exactly - same ISO-string shape,
    same fallback-to-mtime behavior for a run directory that doesn't match the naming
    convention (e.g. one created by hand), so a run never silently fails to list."""
    match = RUN_ID_PATTERN.match(run_id)
    if not match:
        return datetime.datetime.fromtimestamp(fallback_mtime, tz=datetime.UTC).isoformat()
    year, month, day, hour, minute, second = match.groups()
    # .astimezone() attaches this machine's local tzinfo to what's otherwise a naive
    # datetime - matches the run id's own generation (launch_run below uses
    # datetime.now().astimezone(), local time), and matches serve-results-plugin.ts's own
    # JS `new Date("YYYY-MM-DDTHH:MM:SS")` (no Z suffix = local time in JS too) - same
    # displayed value as before, just explicit about it rather than ambiguous, same
    # reasoning ui/app.py already documents for its own identical DTZ fix.
    return datetime.datetime(
        int(year), int(month), int(day), int(hour), int(minute), int(second)
    ).astimezone().isoformat()


def _resolve_run_dir(run_id: str) -> Path | None:
    """Same path-traversal guard as resolveRunDir in serve-results-plugin.ts - a bare
    directory name directly under RESULTS_ROOT, nothing that escapes it."""
    if not run_id or "/" in run_id or "\\" in run_id or not run_id.startswith("run_"):
        return None
    candidate = (RESULTS_ROOT / run_id).resolve()
    try:
        candidate.relative_to(RESULTS_ROOT.resolve())
    except ValueError:
        return None
    return candidate


def _list_runs() -> list[dict]:
    if not RESULTS_ROOT.is_dir():
        return []
    runs = []
    for entry in RESULTS_ROOT.iterdir():
        if not entry.is_dir() or not entry.name.startswith("run_"):
            continue
        # status/hasReport come from the same _compute_run_status used by
        # GET /api/runs/{id} (Phase 2) - one rule, not two that could drift. Adds
        # "running" as a real, live-updating value the History table can show, not just
        # ready/no-report as before Phase 2.
        computed = _compute_run_status(entry)
        runs.append(
            {
                "id": entry.name,
                "startedAt": _parse_run_id(entry.name, entry.stat().st_mtime),
                "hasReport": computed["hasReport"],
                "status": computed["status"],
            }
        )
    runs.sort(key=lambda r: r["startedAt"], reverse=True)
    return runs


@app.get("/reports-api/runs")
def list_runs() -> list[dict]:
    return _list_runs()


@app.delete("/reports-api/runs/{run_id}")
def delete_run(run_id: str) -> dict:
    run_dir = _resolve_run_dir(run_id)
    if run_dir is None or not run_dir.is_dir():
        raise HTTPException(status_code=404, detail="Run not found")
    import shutil

    shutil.rmtree(run_dir)
    return {"deleted": run_id}


@app.get("/reports-api/runs/{run_id}/files")
def list_run_files(run_id: str) -> list[dict]:
    """Full-UI-architecture Phase 4b (§6.17 requirement: "the data already exists
    per-node, it just isn't surfaced yet"). A flat, recursive listing of every real file
    published under this run's outdir (relative paths, POSIX-style so the frontend can
    match them against toolCatalog.ts's own resultDirs without OS-specific separator
    handling) - the frontend groups these by which tool's resultDirs prefix each path
    starts with, rather than this endpoint needing to know about tools/families at all.
    No depth cap: every real publishDir here is a small, flat-ish per-tool directory
    (verified against conf/modules.config / conf/modules_wgs.config directly, not
    assumed), not an arbitrarily deep tree - Nextflow's own work/ directory (which could
    be huge) is never under outdir, so this can't accidentally walk into it."""
    run_dir = _resolve_run_dir(run_id)
    if run_dir is None or not run_dir.is_dir():
        raise HTTPException(status_code=404, detail="Run not found")
    files = []
    for path in run_dir.rglob("*"):
        if path.is_file():
            files.append({"path": path.relative_to(run_dir).as_posix(), "size": path.stat().st_size})
    files.sort(key=lambda f: f["path"])
    return files


_CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".txt": "text/plain; charset=utf-8",
    ".tsv": "text/tab-separated-values",
    ".csv": "text/csv",
}


@app.get("/reports/{run_id}/{file_path:path}")
def serve_report_file(run_id: str, file_path: str):
    run_dir = _resolve_run_dir(run_id)
    if run_dir is None:
        raise HTTPException(status_code=403, detail="Invalid run id")
    target = (run_dir / file_path).resolve()
    try:
        target.relative_to(run_dir)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Path escapes run directory") from exc
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    media_type = _CONTENT_TYPES.get(target.suffix, "application/octet-stream")
    return FileResponse(target, media_type=media_type)


# ---- Launching a real run --------------------------------------------------------------


class LaunchResponse(BaseModel):
    run_id: str
    pid: int


def _params_to_yaml(params: dict[str, Any]) -> str:
    """Minimal, deliberately not a general YAML writer - matches this repo's own existing
    "simple-YAML convention" for generated files (workflows/wgs.nf's mash/versions _mqc.yml
    comments). Booleans render as bare true/false (what Nextflow's -params-file needs for a
    skip_* flag); everything else goes through json.dumps, which produces a valid quoted
    YAML flow scalar with correct escaping for free - no need to hand-roll YAML string
    escaping for values (DB paths, reference URLs) that could contain a stray quote/colon."""
    lines = [f"{key}: {'true' if value is True else 'false' if value is False else json.dumps(str(value))}" for key, value in params.items()]
    return "\n".join(lines) + "\n"


@app.post("/api/runs")
def launch_run(
    samplesheet: UploadFile,
    # Form(...), not a bare default: real bug found while testing this endpoint -
    # FastAPI does NOT reliably bind plain str/Literal parameters from multipart form
    # data alongside an UploadFile unless each is explicitly marked Form() - without it,
    # `pipeline`/`profile` silently kept their Python defaults regardless of what was
    # actually sent in the request body, a genuinely silent failure (200 OK, wrong
    # pipeline launched) caught by asserting the real subprocess args, not by trusting
    # the response status code alone.
    profile: str = Form("test"),
    pipeline: Literal["metagenomics", "wgs"] = Form("metagenomics"),
    # Optional JSON-encoded dict, e.g. '{"skip_fastp": false, "kraken2_db": "/data/db"}' -
    # Composer's real UI-to-engine converter output (utils/pipelineConverter.ts,
    # full-architecture Phase 3). Omitted entirely by the still-separate Streamlit Run
    # page - a run launched from there behaves exactly as before this field existed.
    params: str | None = Form(None),
) -> LaunchResponse:
    """Reuses bin/run.sh exactly as ui/app.py's own Run button does today - same
    subprocess.Popen + start_new_session=True pattern (so the whole process tree can be
    signalled together later), not a reimplementation."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    samplesheet_path = UPLOAD_DIR / (samplesheet.filename or "samplesheet.csv")
    samplesheet_path.write_bytes(samplesheet.file.read())

    run_id = f"run_{datetime.datetime.now().astimezone():%Y%m%d_%H%M%S}"
    run_outdir = f"results/{run_id}"
    weblog_url = f"http://127.0.0.1:{BACKEND_PORT}/api/telemetry/{run_id}"

    log_path = REPO_ROOT / "logs" / f"{run_id}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = open(log_path, "w")  # noqa: SIM115 - stays open for the run's lifetime, see ui/app.py's own identical pattern

    extra_args: list[str] = []
    if params:
        try:
            params_dict = json.loads(params)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="params must be valid JSON") from exc
        params_path = UPLOAD_DIR / f"{run_id}_params.yaml"
        params_path.write_text(_params_to_yaml(params_dict))
        extra_args = ["--extra-params-file", str(params_path)]

    proc = subprocess.Popen(
        [
            "bash",
            str(RUN_SCRIPT),
            str(samplesheet_path),
            "--profile",
            profile,
            "--pipeline",
            pipeline,
            "--outdir",
            run_outdir,
            "--weblog-url",
            weblog_url,
            *extra_args,
        ],
        cwd=REPO_ROOT,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )

    # Filesystem-first, not an in-memory dict - a backend restart mid-run (or a fresh
    # GET /api/runs/{id} from a different process) must still be able to tell whether
    # the launching pid is alive, same reasoning as the weblog JSONL itself (plan item 4).
    run_dir = REPO_ROOT / run_outdir
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "pipeline_info").mkdir(exist_ok=True)
    (run_dir / "pipeline_info" / "run_meta.json").write_text(
        json.dumps({"pid": proc.pid, "profile": profile, "pipeline": pipeline})
    )

    return LaunchResponse(run_id=run_id, pid=proc.pid)


@app.post("/api/runs/{run_id}/cancel")
def cancel_run(run_id: str, pid: int) -> dict:
    """Same os.killpg(os.getpgid(pid), SIGTERM) pattern as ui/app.py's _cancel_run -
    signals the whole process group (bin/run.sh, nextflow, tee), not just one pid, since
    bash's default SIGTERM disposition doesn't propagate to children on its own."""
    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
    except ProcessLookupError:
        return JSONResponse(status_code=404, content={"error": "Process not found"})
    return {"cancelled": run_id}


# ---- Phase 2: live status via -with-weblog ----------------------------------------------


@app.post("/api/telemetry/{run_id}")
async def receive_telemetry(run_id: str, request: Request) -> dict:
    """Nextflow's -with-weblog POSTs one JSON event per lifecycle transition
    (started/process_submitted/process_started/process_completed/completed/error) - this
    just appends each one as-is to that run's own JSONL file, no parsing here (parsing
    happens at read time in get_run_status, so a malformed/unexpected event shape never
    breaks ingestion of the next one). A run whose directory doesn't exist yet (a stray
    POST after the run was deleted, or a bad run_id) is silently accepted, not 404'd -
    losing one telemetry event is harmless and this must never be what fails Nextflow's
    own -with-weblog delivery."""
    run_dir = _resolve_run_dir(run_id)
    if run_dir is None or not run_dir.is_dir():
        return {"accepted": False}
    body = await request.body()
    pipeline_info = run_dir / "pipeline_info"
    pipeline_info.mkdir(parents=True, exist_ok=True)
    with (pipeline_info / "weblog_events.jsonl").open("ab") as f:
        f.write(body.strip() + b"\n")
    return {"accepted": True}


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        # Exists, just owned by someone else - can't happen for our own child process,
        # but treat as alive rather than guessing.
        return True

    # Real bug found running an actual live smoke test end to end (2026-09-14), not
    # caught by any unit test until this one was added: os.kill(pid, 0) alone answers
    # "alive" for a ZOMBIE process too - one that has already exited but hasn't been
    # reaped by its parent, exactly bin/run.sh's launching bash process once it finishes
    # (this backend launches it fire-and-forget via subprocess.Popen and never calls
    # .wait()/.poll() on it). A genuinely completed/failed run kept reporting "running"
    # forever as a result. /proc/<pid>/status's State field distinguishes a zombie from
    # a real live process - Linux/WSL2 only, matching this project's own target
    # environment (docs/DEV_SETUP.md).
    try:
        status = Path(f"/proc/{pid}/status").read_text()
    except (FileNotFoundError, PermissionError):
        return True  # can't tell on this platform - default to alive, not a false "failed"
    for line in status.splitlines():
        if line.startswith("State:"):
            return "Z" not in line
    return True


def _read_weblog_events(run_dir: Path) -> list[dict[str, Any]]:
    events_path = run_dir / "pipeline_info" / "weblog_events.jsonl"
    if not events_path.is_file():
        return []
    events = []
    for line in events_path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue  # a partially-written line (e.g. server killed mid-write) - skip it
    return events


def _compute_run_status(run_dir: Path) -> dict:
    """Shared by GET /api/runs/{id} (per-run detail, includes per-process breakdown) and
    _list_runs (so the History table can show live status for every run without a
    separate request per row) - one status-derivation rule, not two that could drift.

    Never trusts the weblog alone for FINAL state - its last event(s) can drop on exit
    (documented caveat, plan item 5/§6.12's own reference implementation). Once the
    launching process has actually exited, prefers what's really on disk over a possibly-
    incomplete event stream: a report means it really finished; no report and no live
    process means it really failed, regardless of what the last-seen weblog event said.
    A run with no run_meta.json at all (launched before Phase 2, or via the still-separate
    Streamlit path - ui/app.py doesn't write one) falls back to hasReport alone, same as
    Phase 1's behavior - "unknown" only when there's truly nothing to go on.
    """
    events = _read_weblog_events(run_dir)
    processes: dict[str, str] = {}
    flow_status: str | None = None
    for event in events:
        trace = event.get("trace")
        if trace and trace.get("process"):
            processes[trace["process"]] = trace.get("status", event.get("event", "unknown"))
        if event.get("event") == "completed":
            flow_status = "completed"
        elif event.get("event") == "error":
            flow_status = "failed"

    meta_path = run_dir / "pipeline_info" / "run_meta.json"
    pid: int | None = None
    if meta_path.is_file():
        try:
            pid = json.loads(meta_path.read_text()).get("pid")
        except json.JSONDecodeError:
            pid = None

    has_report = (run_dir / "multiqc" / "multiqc_report.html").is_file()

    if pid is not None and _pid_alive(pid):
        status = "running"
    elif flow_status is not None:
        status = flow_status
    elif has_report:
        status = "completed"
    elif pid is not None:
        status = "failed"
    else:
        status = "unknown"

    return {"status": status, "processes": processes, "hasReport": has_report}


@app.get("/api/runs/{run_id}")
def get_run_status(run_id: str) -> dict:
    run_dir = _resolve_run_dir(run_id)
    if run_dir is None or not run_dir.is_dir():
        raise HTTPException(status_code=404, detail="Run not found")
    return {"id": run_id, **_compute_run_status(run_dir)}
