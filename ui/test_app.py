"""Unit tests for ui/app.py using Streamlit's headless AppTest framework.

Added 2026-09-12 to close a real gap flagged in docs/TESTING.md §3: every prior
verification of this file was either a bare syntax check or a full browser
session via claude-in-chrome - there was no fast, no-browser-needed unit-test
layer at all. These tests specifically target the bug classes this project has
actually hit here (the run-reattachment logic, the finished-vs-live-vs-
never-started state machine, the disk-space warning) - not generic coverage.

Caveat, and why the fixture below exists: `app.py`'s module-level constants
(RUN_META_FILE, RESULTS_ROOT, LOG_PATH, UPLOAD_DIR) are hardcoded to real paths
under this repo, not injectable - AppTest.from_file() execs the real source,
so these tests genuinely read/write the real on-disk state at those paths.
Refactoring the whole app to take injectable paths just to make it more
testable was judged out of proportion for a ~300-line thin launcher (project's
own minimalism principle) - instead, `_clean_ui_state` below saves/removes
whatever was there before each test and restores it after, so a test run never
leaves the repo's real state altered and never depends on it being empty
beforehand.

Run with: .venv-ui/bin/pytest ui/test_app.py -v
"""

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

APP_PATH = Path(__file__).resolve().parent / "app.py"
REPO_ROOT = APP_PATH.parent.parent
RUN_META_FILE = REPO_ROOT / ".streamlit_run.json"
LOG_PATH = REPO_ROOT / ".streamlit_run.log"
RESULTS_ROOT = REPO_ROOT / "results"
# A fixed, obviously-fake run id (not a real timestamp) - 2026-09-13, since
# each real run now gets its own results/run_<timestamp>/ directory rather
# than the old fixed results/multiqc/. Using one constant, predictable
# directory here (rather than a fresh timestamp per test) keeps cleanup in
# _clean_ui_state simple - remove exactly this one directory afterward,
# nothing else under results/ is ever touched by these tests.
TEST_RUN_OUTDIR = "results/run_TESTFIXTURE"
TEST_REPORT = REPO_ROOT / TEST_RUN_OUTDIR / "multiqc" / "multiqc_report.html"


@pytest.fixture(autouse=True)
def _clean_ui_state():
    """Save/restore the real on-disk UI state so tests never alter it permanently."""
    saved = {}
    for p in (RUN_META_FILE, LOG_PATH):
        saved[p] = p.read_bytes() if p.exists() else None
        if p.exists():
            p.unlink()
    # app.py's own _latest_report() scans EVERY real results/run_* directory,
    # not just this fixture's own TEST_RUN_OUTDIR - found the hard way
    # 2026-09-13 running these tests on a machine that already had genuine
    # runs on disk from real manual testing: test_no_run_and_no_report_shows_
    # never_started failed because a real prior run's report got picked up
    # as "the latest," not because anything in app.py was wrong. Every
    # existing run_* directory is moved out of the way for the duration of
    # each test and moved straight back afterward, so these tests see a
    # genuinely empty results/ regardless of what real runs already exist on
    # whatever machine they're run on.
    stash_dir = Path(tempfile.mkdtemp(prefix="microbox-ui-test-stash-"))
    stashed_runs = []
    if RESULTS_ROOT.exists():
        for entry in RESULTS_ROOT.iterdir():
            if entry.is_dir() and entry.name.startswith("run_"):
                destination = stash_dir / entry.name
                shutil.move(str(entry), str(destination))
                stashed_runs.append(destination)
    yield
    for p, content in saved.items():
        if content is None:
            p.unlink(missing_ok=True)
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(content)
    shutil.rmtree(REPO_ROOT / TEST_RUN_OUTDIR, ignore_errors=True)
    if stashed_runs:
        RESULTS_ROOT.mkdir(parents=True, exist_ok=True)
        for stashed in stashed_runs:
            shutil.move(str(stashed), str(RESULTS_ROOT / stashed.name))
    shutil.rmtree(stash_dir, ignore_errors=True)


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


def _write_run_meta(pid: int, outdir: str = TEST_RUN_OUTDIR) -> None:
    RUN_META_FILE.write_text(json.dumps({"pid": pid, "outdir": outdir}))


def test_no_run_and_no_report_shows_never_started():
    at = AppTest.from_file(str(APP_PATH))
    at.run()
    assert not at.exception
    assert any("No run started yet" in i.value for i in at.info)


def test_finished_report_shown_after_fresh_session():
    """The Fixed #21 scenario: a fresh session with no session_state, but a
    real report already on disk, must show it - not 'no run started yet'."""
    TEST_REPORT.parent.mkdir(parents=True, exist_ok=True)
    TEST_REPORT.write_text("<html><body>fixture report</body></html>")

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
        _write_run_meta(proc.pid)

        at = AppTest.from_file(str(APP_PATH))
        at.run()

        assert not at.exception
        # No longer asserts on a raw PID in the message text - owner
        # 2026-09-13 feedback ("wasted space"/"complicated paths") led to
        # dropping the bare process id from the user-facing message; it's
        # still real, just no longer surfaced as this dev-only detail.
        assert any("still in progress" in i.value for i in at.info)
        assert any(b.key == "cancel_reattached" for b in at.button)
    finally:
        proc.terminate()
        proc.wait(timeout=5)


def test_stale_run_meta_is_cleaned_up_not_shown_as_running():
    """A meta file naming a process that's actually gone (crash, or a session
    that never got to clean up) must not be reported as still running."""
    # A PID essentially guaranteed not to be a real running process right now.
    _write_run_meta(999999)

    at = AppTest.from_file(str(APP_PATH))
    at.run()

    assert not at.exception
    assert not any("still in progress" in i.value for i in at.info)
    assert not RUN_META_FILE.exists(), "stale run meta file should have been cleaned up"


def test_cancel_button_actually_terminates_the_process():
    """Real regression test for the exact thing verified manually 2026-09-12:
    clicking Cancel on a reattached run must actually kill the process and
    clean up the run meta file, not just change what the UI displays."""
    proc = _spawn_long_lived_process()
    try:
        _write_run_meta(proc.pid)

        at = AppTest.from_file(str(APP_PATH))
        at.run()
        at.button(key="cancel_reattached").click().run()

        assert not at.exception
        # Give the SIGTERM a moment to land, same as the manual test did.
        proc.wait(timeout=5)
        assert proc.poll() is not None, "process should have been terminated"
        assert not RUN_META_FILE.exists(), "run meta file should be cleaned up after cancel"
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
