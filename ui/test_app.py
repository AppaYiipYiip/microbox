"""Unit tests for ui/app.py using Streamlit's headless AppTest framework.

Added 2026-09-12 to close a real gap flagged in docs/TESTING.md §3: every prior
verification of this file was either a bare syntax check or a full browser
session via claude-in-chrome - there was no fast, no-browser-needed unit-test
layer at all. These tests specifically target the bug classes this project has
actually hit here (the PID-file reattachment logic, the finished-vs-live-vs-
never-started state machine, the disk-space warning) - not generic coverage.

Caveat, and why the fixture below exists: `app.py`'s module-level constants
(PID_FILE, MULTIQC_REPORT, LOG_PATH, UPLOAD_DIR) are hardcoded to real paths
under this repo, not injectable - AppTest.from_file() execs the real source,
so these tests genuinely read/write the real on-disk state at those paths.
Refactoring the whole app to take injectable paths just to make it more
testable was judged out of proportion for a ~260-line thin launcher (project's
own minimalism principle) - instead, `_clean_ui_state` below saves whatever
was there before each test and restores it after, so a test run never leaves
the repo's real state altered and never depends on it being empty beforehand.

Run with: .venv-ui/bin/pytest ui/test_app.py -v
"""

import shutil
import subprocess
import time
from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

APP_PATH = Path(__file__).resolve().parent / "app.py"
REPO_ROOT = APP_PATH.parent.parent
PID_FILE = REPO_ROOT / ".streamlit_run.pid"
LOG_PATH = REPO_ROOT / ".streamlit_run.log"
MULTIQC_REPORT = REPO_ROOT / "results" / "multiqc" / "multiqc_report.html"


@pytest.fixture(autouse=True)
def _clean_ui_state():
    """Save/restore the real on-disk UI state so tests never alter it permanently."""
    saved = {}
    for p in (PID_FILE, LOG_PATH, MULTIQC_REPORT):
        saved[p] = p.read_bytes() if p.exists() else None
        if p.exists():
            p.unlink()
    yield
    for p, content in saved.items():
        if content is None:
            p.unlink(missing_ok=True)
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(content)


def _spawn_long_lived_process() -> subprocess.Popen:
    """A real, harmless process to use as a stand-in 'still running' PID.

    start_new_session=True matters here, not just for realism: without it this
    process shares the *test runner's own* process group, and _cancel_run's
    os.killpg() would then SIGTERM the pytest process itself along with the
    target - found the hard way, it hung test_cancel_button_actually_
    terminates_the_process indefinitely (pytest catching a SIGTERM mid-test in
    a way that never progressed). This matches how ui/app.py's real Popen call
    spawns bin/run.sh, so it's the more accurate stand-in anyway, not just a
    workaround.
    """
    return subprocess.Popen(["sleep", "30"], start_new_session=True)


def test_no_run_and_no_report_shows_never_started():
    at = AppTest.from_file(str(APP_PATH))
    at.run()
    assert not at.exception
    assert any("No run started yet" in i.value for i in at.info)


def test_finished_report_shown_after_fresh_session():
    """The Fixed #21 scenario: a fresh session with no session_state, but a
    real report already on disk, must show it - not 'no run started yet'."""
    MULTIQC_REPORT.parent.mkdir(parents=True, exist_ok=True)
    MULTIQC_REPORT.write_text("<html><body>fixture report</body></html>")

    at = AppTest.from_file(str(APP_PATH))
    at.run()

    assert not at.exception
    assert any("report already exists on disk" in i.value for i in at.info)
    assert not any("No run started yet" in i.value for i in at.info)


def test_live_run_reattachment_shows_in_progress_and_cancel_button():
    """The 2026-09-12 addition: a fresh session must detect a run that's still
    genuinely alive, started from elsewhere, and offer to cancel it."""
    proc = _spawn_long_lived_process()
    try:
        PID_FILE.write_text(str(proc.pid))

        at = AppTest.from_file(str(APP_PATH))
        at.run()

        assert not at.exception
        assert any(f"PID {proc.pid}" in i.value and "still in progress" in i.value for i in at.info)
        assert any(b.key == "cancel_reattached" for b in at.button)
    finally:
        proc.terminate()
        proc.wait(timeout=5)


def test_stale_pid_file_is_cleaned_up_not_shown_as_running():
    """A PID file naming a process that's actually gone (crash, or a session
    that never got to clean up) must not be reported as still running."""
    # A PID essentially guaranteed not to be a real running process right now.
    dead_pid = 999999
    PID_FILE.write_text(str(dead_pid))

    at = AppTest.from_file(str(APP_PATH))
    at.run()

    assert not at.exception
    assert not any("still in progress" in i.value for i in at.info)
    assert not PID_FILE.exists(), "stale PID file should have been cleaned up"


def test_cancel_button_actually_terminates_the_process():
    """Real regression test for the exact thing verified manually 2026-09-12:
    clicking Cancel on a reattached run must actually kill the process and
    clean up the PID file, not just change what the UI displays."""
    proc = _spawn_long_lived_process()
    try:
        PID_FILE.write_text(str(proc.pid))

        at = AppTest.from_file(str(APP_PATH))
        at.run()
        at.button(key="cancel_reattached").click().run()

        assert not at.exception
        # Give the SIGTERM a moment to land, same as the manual test did.
        proc.wait(timeout=5)
        assert proc.poll() is not None, "process should have been terminated"
        assert not PID_FILE.exists(), "PID file should be cleaned up after cancel"
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait(timeout=5)


def test_disk_space_warning_appears_when_free_space_is_low(monkeypatch):
    """The 2026-09-12 preflight addition - verified via a real too-small disk
    quota is impractical in CI, so this mocks shutil.disk_usage the same way
    a genuinely low-disk machine would report it."""
    fake_usage = shutil.disk_usage(REPO_ROOT)._replace(free=5 * 1024**3)  # 5 GB
    monkeypatch.setattr(shutil, "disk_usage", lambda _path: fake_usage)

    at = AppTest.from_file(str(APP_PATH))
    at.run()

    assert not at.exception
    assert any("Only 5.0 GB free" in w.value for w in at.warning)


def test_disk_space_warning_absent_when_free_space_is_plentiful(monkeypatch):
    fake_usage = shutil.disk_usage(REPO_ROOT)._replace(free=50 * 1024**3)  # 50 GB
    monkeypatch.setattr(shutil, "disk_usage", lambda _path: fake_usage)

    at = AppTest.from_file(str(APP_PATH))
    at.run()

    assert not at.exception
    assert not any("free on this disk" in w.value for w in at.warning)


def test_environment_defaults_to_test_profile():
    """Fixed 2026-09-11: defaulting to 'dev' was a trap since no config exists
    for it yet (docs/KNOWN_ISSUES.md #3) - 'test' must stay the default."""
    at = AppTest.from_file(str(APP_PATH))
    at.run()

    assert not at.exception
    assert at.selectbox[0].value == "test"


if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v"]))
