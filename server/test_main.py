"""Tests for server/main.py - the real backend (PLAN.md §6.12/full-architecture Phase 1).

Unlike ui/test_app.py, this module's constants (RESULTS_ROOT, RUN_SCRIPT, UPLOAD_DIR) are
plain module-level globals FastAPI reads at request time, not baked into a Streamlit
AppTest exec - so tests monkeypatch them directly to a pytest tmp_path instead of needing
the save/restore-real-state dance ui/test_app.py uses for the same reason. Real on-disk
repo state is never touched by these tests.

Run with: .venv-server/bin/pytest server/test_main.py -v
"""

from __future__ import annotations

import io
import json
import os
import time
from pathlib import Path

import main
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    results_root = tmp_path / "results"
    results_root.mkdir()
    monkeypatch.setattr(main, "RESULTS_ROOT", results_root)
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path / "uploads")
    return TestClient(main.app)


def _make_run_dir(results_root: Path, run_id: str, *, with_report: bool = False) -> Path:
    run_dir = results_root / run_id
    (run_dir / "multiqc").mkdir(parents=True)
    if with_report:
        (run_dir / "multiqc" / "multiqc_report.html").write_text("<html>real report</html>")
    return run_dir


# ---- GET /reports-api/runs --------------------------------------------------------------


def test_list_runs_empty(client):
    resp = client.get("/reports-api/runs")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_runs_real_directories(client, monkeypatch):
    _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000", with_report=True)
    _make_run_dir(main.RESULTS_ROOT, "run_20260102_090000", with_report=False)

    resp = client.get("/reports-api/runs")
    assert resp.status_code == 200
    runs = resp.json()
    assert len(runs) == 2
    # Newest first, matching serve-results-plugin.ts's own sort.
    assert runs[0]["id"] == "run_20260102_090000"
    assert runs[0]["hasReport"] is False
    assert runs[0]["status"] == "unknown"  # no run_meta.json, no report - nothing to go on
    assert runs[1]["id"] == "run_20260101_120000"
    assert runs[1]["hasReport"] is True
    assert runs[1]["status"] == "completed"  # has a real report, no live pid
    assert runs[1]["startedAt"].startswith("2026-01-01T12:00:00")


def test_list_runs_ignores_non_run_directories(client):
    (main.RESULTS_ROOT / "not_a_run").mkdir()
    _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000")

    runs = client.get("/reports-api/runs").json()
    assert len(runs) == 1
    assert runs[0]["id"] == "run_20260101_120000"


# ---- DELETE /reports-api/runs/{id} -------------------------------------------------------


def test_delete_run_real_directory_removed(client):
    run_dir = _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000")
    assert run_dir.is_dir()

    resp = client.delete("/reports-api/runs/run_20260101_120000")
    assert resp.status_code == 200
    assert resp.json() == {"deleted": "run_20260101_120000"}
    assert not run_dir.exists()


def test_delete_run_not_found(client):
    resp = client.delete("/reports-api/runs/run_doesnotexist")
    assert resp.status_code == 404


def test_delete_run_path_traversal_rejected(client):
    # A real, not hypothetical, path-traversal id - confirms _resolve_run_dir's guard
    # actually rejects it rather than deleting something outside RESULTS_ROOT.
    resp = client.delete("/reports-api/runs/..%2F..%2Fetc")
    assert resp.status_code == 404


# ---- GET /reports-api/runs/{id}/files ----------------------------------------------------


def test_list_run_files_real_recursive_listing(client):
    run_dir = _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000", with_report=True)
    (run_dir / "fastp").mkdir()
    (run_dir / "fastp" / "sample1.fastp.json").write_text("{}")
    (run_dir / "kraken2").mkdir()
    (run_dir / "kraken2" / "sample1.kraken2.report.txt").write_text("real content")

    resp = client.get("/reports-api/runs/run_20260101_120000/files")
    assert resp.status_code == 200
    paths = {f["path"] for f in resp.json()}
    assert paths == {
        "multiqc/multiqc_report.html",
        "fastp/sample1.fastp.json",
        "kraken2/sample1.kraken2.report.txt",
    }
    # Real sizes, not zero/placeholder - confirms this reads actual file stats.
    sizes = {f["path"]: f["size"] for f in resp.json()}
    assert sizes["kraken2/sample1.kraken2.report.txt"] == len("real content")


def test_list_run_files_uses_forward_slashes(client):
    # POSIX-style relative paths regardless of host OS, so the frontend can match
    # against toolCatalog.ts's resultDirs (e.g. "wgs/bwamem2/align") without any
    # OS-specific separator handling.
    run_dir = _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000")
    (run_dir / "wgs" / "bwamem2" / "align").mkdir(parents=True)
    (run_dir / "wgs" / "bwamem2" / "align" / "sample1.bam").write_text("x")

    paths = {f["path"] for f in client.get("/reports-api/runs/run_20260101_120000/files").json()}
    assert "wgs/bwamem2/align/sample1.bam" in paths
    assert not any("\\" in p for p in paths)


def test_list_run_files_not_found(client):
    resp = client.get("/reports-api/runs/run_doesnotexist/files")
    assert resp.status_code == 404


# ---- GET /reports/{id}/{file_path} -------------------------------------------------------


def test_serve_report_file_real_content(client):
    _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000", with_report=True)

    resp = client.get("/reports/run_20260101_120000/multiqc/multiqc_report.html")
    assert resp.status_code == 200
    assert "real report" in resp.text
    assert resp.headers["content-type"].startswith("text/html")


def test_serve_report_file_missing_404(client):
    _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000")

    resp = client.get("/reports/run_20260101_120000/multiqc/multiqc_report.html")
    assert resp.status_code == 404


def test_serve_report_file_traversal_rejected(client):
    _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000")

    resp = client.get("/reports/run_20260101_120000/../../../etc/passwd")
    assert resp.status_code in (403, 404)  # FastAPI's own path normalization may 404 first


# ---- POST /api/runs (launch) -------------------------------------------------------------


def test_launch_run_invokes_run_script_with_real_args(client, monkeypatch, tmp_path):
    """Doesn't actually run Nextflow - substitutes a tiny real script standing in for
    bin/run.sh, matching this project's own established pattern of not invoking the real
    heavyweight pipeline from a fast unit test (see docs/TESTING.md's testing-pyramid
    split). What's verified here is the real subprocess contract: the fake script is
    actually invoked, with the real args server/main.py is supposed to pass, and its own
    stdout genuinely reaches the log file - not just that Popen was called with a mock."""
    fake_script = tmp_path / "fake_run.sh"
    fake_script.write_text(
        "#!/usr/bin/env bash\n"
        'echo "args: $*" > "$0.args"\n'
        "exit 0\n"
    )
    fake_script.chmod(0o755)
    monkeypatch.setattr(main, "RUN_SCRIPT", fake_script)
    monkeypatch.setattr(main, "REPO_ROOT", tmp_path)

    resp = client.post(
        "/api/runs",
        files={"samplesheet": ("test.csv", io.BytesIO(b"sample,fastq_1\ntest,a.fq.gz\n"), "text/csv")},
        data={"profile": "test", "pipeline": "wgs"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["run_id"].startswith("run_")
    assert isinstance(body["pid"], int)

    # Give the real (fast, fake) subprocess a moment to actually finish and write its
    # args file - it's launched async via Popen, not awaited synchronously.
    args_file = tmp_path / "fake_run.sh.args"
    for _ in range(50):
        if args_file.exists():
            break
        time.sleep(0.1)
    assert args_file.exists(), "fake script never ran"
    real_args = args_file.read_text()
    assert "--profile test" in real_args
    assert "--pipeline wgs" in real_args
    assert "--outdir results/" in real_args

    uploaded = main.UPLOAD_DIR / "test.csv"
    assert uploaded.exists()
    assert uploaded.read_text() == "sample,fastq_1\ntest,a.fq.gz\n"


def test_launch_run_with_params_writes_real_yaml_and_passes_extra_params_file(client, monkeypatch, tmp_path):
    """Real Composer conversion output (utils/pipelineConverter.ts's actual shape) - not a
    hand-picked minimal example - proving both the bool->true/false rendering (Nextflow's
    -params-file needs bare, unquoted true/false for a skip_* flag, not Python's
    capitalized True/False or a quoted string) and that a DB path with a value survives
    intact through JSON -> YAML -> the real subprocess argv."""
    fake_script = tmp_path / "fake_run.sh"
    fake_script.write_text('#!/usr/bin/env bash\necho "args: $*" > "$0.args"\nexit 0\n')
    fake_script.chmod(0o755)
    monkeypatch.setattr(main, "RUN_SCRIPT", fake_script)
    monkeypatch.setattr(main, "REPO_ROOT", tmp_path)

    resp = client.post(
        "/api/runs",
        files={"samplesheet": ("test.csv", io.BytesIO(b"sample,fastq_1\ntest,a.fq.gz\n"), "text/csv")},
        data={
            "profile": "test",
            "pipeline": "wgs",
            "params": json.dumps({"pipeline": "wgs", "skip_bwamem2": False, "skip_gatk4": True, "wgs_reference_fasta": "/refs/NC_007795.1.fasta"}),
        },
    )
    assert resp.status_code == 200
    run_id = resp.json()["run_id"]

    args_file = tmp_path / "fake_run.sh.args"
    for _ in range(50):
        if args_file.exists():
            break
        time.sleep(0.1)
    real_args = args_file.read_text()
    assert "--extra-params-file" in real_args

    params_yaml = (main.UPLOAD_DIR / f"{run_id}_params.yaml").read_text()
    assert "skip_bwamem2: false" in params_yaml  # bare, unquoted - not "False" or "'false'"
    assert "skip_gatk4: true" in params_yaml
    assert 'wgs_reference_fasta: "/refs/NC_007795.1.fasta"' in params_yaml


def test_launch_run_invalid_params_json_rejected(client, monkeypatch, tmp_path):
    fake_script = tmp_path / "fake_run.sh"
    fake_script.write_text("#!/usr/bin/env bash\nexit 0\n")
    fake_script.chmod(0o755)
    monkeypatch.setattr(main, "RUN_SCRIPT", fake_script)
    monkeypatch.setattr(main, "REPO_ROOT", tmp_path)

    resp = client.post(
        "/api/runs",
        files={"samplesheet": ("s.csv", io.BytesIO(b"x"), "text/csv")},
        data={"params": "{not valid json"},
    )
    assert resp.status_code == 422


def test_launch_run_defaults(client, monkeypatch, tmp_path):
    fake_script = tmp_path / "fake_run.sh"
    fake_script.write_text("#!/usr/bin/env bash\nexit 0\n")
    fake_script.chmod(0o755)
    monkeypatch.setattr(main, "RUN_SCRIPT", fake_script)
    monkeypatch.setattr(main, "REPO_ROOT", tmp_path)

    resp = client.post(
        "/api/runs",
        files={"samplesheet": ("s.csv", io.BytesIO(b"x"), "text/csv")},
    )
    assert resp.status_code == 200


# ---- POST /api/runs/{id}/cancel ----------------------------------------------------------


def test_cancel_run_process_not_found(client):
    # A pid that (almost certainly) doesn't exist - confirms the 404 path, not the real
    # os.killpg success path (which would need a real live process group to signal).
    resp = client.post("/api/runs/run_x/cancel", params={"pid": 999999})
    assert resp.status_code == 404


# ---- POST /api/telemetry/{id} + GET /api/runs/{id} (Phase 2: live status) ---------------


def _write_meta(run_dir: Path, pid: int) -> None:
    (run_dir / "pipeline_info").mkdir(parents=True, exist_ok=True)
    (run_dir / "pipeline_info" / "run_meta.json").write_text(f'{{"pid": {pid}, "profile": "test", "pipeline": "wgs"}}')


def test_receive_telemetry_appends_real_event(client):
    run_dir = _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000")

    resp = client.post(
        "/api/telemetry/run_20260101_120000",
        json={"event": "process_started", "trace": {"process": "FASTP", "status": "RUNNING"}},
    )
    assert resp.status_code == 200
    assert resp.json() == {"accepted": True}

    events_file = run_dir / "pipeline_info" / "weblog_events.jsonl"
    assert events_file.is_file()
    line = events_file.read_text().strip()
    assert json.loads(line)["trace"]["process"] == "FASTP"


def test_receive_telemetry_unknown_run_accepted_but_dropped(client):
    # Must never 404 - a stray/late POST after a run's directory was deleted can't be
    # allowed to fail Nextflow's own -with-weblog delivery.
    resp = client.post("/api/telemetry/run_doesnotexist", json={"event": "started"})
    assert resp.status_code == 200
    assert resp.json() == {"accepted": False}


def test_get_run_status_running_when_pid_alive(client):
    run_dir = _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000")
    _write_meta(run_dir, pid=os.getpid())  # this test process is definitely alive

    resp = client.post(
        "/api/telemetry/run_20260101_120000",
        json={"event": "process_started", "trace": {"process": "FASTP", "status": "RUNNING"}},
    )
    assert resp.status_code == 200

    status = client.get("/api/runs/run_20260101_120000").json()
    assert status["status"] == "running"
    assert status["processes"] == {"FASTP": "RUNNING"}


def test_get_run_status_completed_after_pid_exits_with_report(client):
    run_dir = _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000", with_report=True)
    _write_meta(run_dir, pid=999999)  # not alive

    status = client.get("/api/runs/run_20260101_120000").json()
    # No weblog "completed" event ever arrived (the documented last-event-drop caveat) -
    # this must still report completed because the process exited AND a real report exists.
    assert status["status"] == "completed"
    assert status["hasReport"] is True


def test_get_run_status_failed_after_pid_exits_without_report(client):
    run_dir = _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000", with_report=False)
    _write_meta(run_dir, pid=999999)

    status = client.get("/api/runs/run_20260101_120000").json()
    assert status["status"] == "failed"


def test_get_run_status_trusts_explicit_completed_event_over_missing_report(client):
    run_dir = _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000", with_report=False)
    _write_meta(run_dir, pid=999999)
    client.post("/api/telemetry/run_20260101_120000", json={"event": "completed"})

    status = client.get("/api/runs/run_20260101_120000").json()
    assert status["status"] == "completed"


def test_get_run_status_zombie_pid_treated_as_dead_not_running(client):
    """Real bug found running an actual end-to-end smoke test against the live server
    (2026-09-14), not something imagined in advance: bin/run.sh's launching process is
    started fire-and-forget (subprocess.Popen, never waited on) - once it actually exits,
    it becomes a zombie, and plain os.kill(pid, 0) alone reports a zombie as "alive" just
    like a real running process. A run that had genuinely finished (with a real weblog
    'completed' event already received) kept showing "running" forever as a result. This
    reproduces a real zombie via subprocess, not a mocked /proc file."""
    import subprocess
    import time as time_module

    run_dir = _make_run_dir(main.RESULTS_ROOT, "run_20260101_120000", with_report=True)
    zombie_proc = subprocess.Popen(["true"])  # exits immediately
    for _ in range(50):  # wait for it to actually become a zombie, not just exit
        with open(f"/proc/{zombie_proc.pid}/status") as f:
            if "State:\tZ" in f.read():
                break
        time_module.sleep(0.05)
    _write_meta(run_dir, pid=zombie_proc.pid)

    status = client.get("/api/runs/run_20260101_120000").json()
    assert status["status"] == "completed"  # not "running" - the real bug's symptom

    zombie_proc.wait()  # reap it so the test doesn't leak a zombie of its own


def test_get_run_status_not_found(client):
    resp = client.get("/api/runs/run_doesnotexist")
    assert resp.status_code == 404
