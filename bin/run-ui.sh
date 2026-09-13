#!/usr/bin/env bash
# Launches the thin Streamlit UI, bound to localhost only, detached from
# THIS SHELL - found 2026-09-12 (owner: "what if they lose internet, what
# if they go home and comeback the next day") that the UI, and any
# pipeline run it launches as a subprocess.Popen child, previously ran in
# the foreground of whatever shell invoked this script - if something else
# in that same shell later sent it SIGHUP (or the shell itself exited
# without closing the whole WSL session), the whole tree died with it.
# setsid+nohup+disown below genuinely fixes that specific case.
#
# What this does NOT fix, verified experimentally 2026-09-12 (do not
# re-claim otherwise without re-testing): closing the WSL window/terminal
# app entirely does NOT just orphan this process on WSL2 the way it would
# on a real standalone Linux box. WSL2 tears down the ENTIRE VM for a
# distro shortly after its last `wsl.exe` client disconnects (confirmed
# via a plain `setsid nohup sleep 60 &` test - the process was gone within
# seconds, log file never even created) - that's the VM's own lifecycle
# policy, not a signal delivered to this process, so no amount of
# setsid/nohup/disown inside Linux can survive it. The actual fix for
# "close the terminal app entirely and it keeps running" is a Windows-side
# setting (`vmIdleTimeout` in `%USERPROFILE%\.wslconfig`) outside this
# repo and outside what should be changed unasked - see
# docs/KNOWN_ISSUES.md's "WSL2 VM lifecycle..." entry for the exact
# snippet and the practical workaround that needs no config change at all
# (just don't fully close the terminal window - minimizing it is enough).
#
# Multi-user auth is explicitly out of scope (PLAN.md §6.8 item 10) - this
# is not meant to be reachable beyond the machine it runs on without a
# deliberate port-forward.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p logs
LOG_FILE="logs/streamlit_ui.log"

# Full path to the venv's own streamlit, not a bare `streamlit` on PATH -
# found 2026-09-12 actually testing this script standalone (not via an
# interactive shell that happened to have .venv-ui pre-activated already):
# `nohup: failed to run command 'streamlit': No such file or directory`.
# Same class of bug as Fixed #17 (java not on PATH in a non-interactive
# shell) - a real terminal session that manually ran `source
# .venv-ui/bin/activate` first never hit this, so it went unnoticed until
# this script was run on its own, the way a script meant to "just work" is
# supposed to be run.
STREAMLIT="$REPO_ROOT/.venv-ui/bin/streamlit"
if [[ ! -x "$STREAMLIT" ]]; then
  echo "Error: $STREAMLIT not found - run bin/setup-dev.sh first to create .venv-ui." >&2
  exit 1
fi

# setsid: starts a new session with no controlling terminal at all, so a
# SIGHUP delivered to this terminal's process group never reaches it.
# nohup: belt-and-suspenders - also makes the process ignore SIGHUP
# directly, in case something further up the chain (e.g. wsl.exe itself
# closing) still tries to deliver one some other way. Output redirected to
# a log file since there's no terminal left to write to once detached;
# stdin from /dev/null since nothing will ever be there to read from it.
# --server.baseUrlPath: served under /run-app rather than at the root, so
# composer-ui (a separate app, port 5173) can proxy it in as one of its own
# pages ("Run Pipeline", next to Home/Composer/Run History) - owner
# 2026-09-13: "composer and real pipeline should be in the localhost port,
# just different page, just like the home and run history." Streamlit's own
# documented way to sit behind a sub-path reverse proxy (docs.streamlit.io);
# composer-ui/vite.config.ts's dev-server proxy is the other half, and must
# use this exact same path. Still directly reachable on its own at
# http://localhost:8501/run-app too, not just through the proxy.
# --server.enableCORS=false --server.enableXsrfProtection=false: Streamlit's
# own recommended pairing when running behind a reverse proxy that changes
# the browser-visible origin (its default XSRF/CORS protection assumes it's
# the direct origin) - no multi-user auth exists here anyway (PLAN.md §6.8
# item 10), so this trades nothing away that mattered.
setsid nohup "$STREAMLIT" run ui/app.py --server.address 127.0.0.1 --server.port 8501 \
  --server.baseUrlPath run-app --server.enableCORS false --server.enableXsrfProtection false \
  > "$LOG_FILE" 2>&1 < /dev/null &
PID=$!
disown

echo "Streamlit UI running (PID $PID), detached from this shell."
echo "  Direct URL:    http://localhost:8501/run-app"
echo "  Via composer:  http://localhost:5173/run (when composer-ui's dev server is also running)"
echo "  Logs: $LOG_FILE"
echo ""
echo "IMPORTANT (verified, not assumed - docs/KNOWN_ISSUES.md has the full"
echo "writeup): keep this terminal WINDOW open (minimizing it is fine) for"
echo "as long as you want the UI and any run it launches to keep going."
echo "Fully closing the terminal app tears down the whole WSL VM within"
echo "seconds, killing everything in it regardless of setsid/nohup/disown -"
echo "that's WSL2's own idle-shutdown behavior, not something this script"
echo "can override from inside Linux. To stop it deliberately: kill $PID."
echo "bin/run.sh already runs with -resume, so if a run does get killed"
echo "(machine sleep/shutdown, or closing the terminal anyway), re-running"
echo "the same command afterward picks up cached progress rather than"
echo "starting over (docs/planning/PLAN.md §6.14)."
