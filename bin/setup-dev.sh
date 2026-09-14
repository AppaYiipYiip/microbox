#!/usr/bin/env bash
# One-time dev environment setup, run INSIDE a WSL2 Ubuntu distro (not native
# Windows). Installs everything this repo needs to actually run: Java 21
# (Temurin via SDKMAN), Nextflow (pinned), Docker CLI fixes, Python for the UI.
#
# Prerequisites this script does NOT do for you (see docs/planning/PLAN.md
# §6, Track A - these need a human at a real terminal, admin rights, and a
# reboot):
#   1. `wsl --install` (as Administrator) + reboot
#   2. Docker Desktop installed on Windows, with WSL Integration enabled for
#      this distro (Docker Desktop Settings -> Resources -> WSL Integration)
#
# Run this from inside the distro, in the repo root:
#   bash bin/setup-dev.sh
#
# Safe to re-run - every step is idempotent.
set -euo pipefail

echo "=== 1/8: DNS fix (corporate/VPN networks stall apt on PTR lookups) ==="
# WSL2 auto-generates /etc/resolv.conf from the Windows host's DNS, which on
# a corporate network can stall every apt-get update for tens of seconds per
# host. Point at public resolvers instead - confirmed fix, not a guess.
if ! grep -q "generateResolvConf = false" /etc/wsl.conf 2>/dev/null; then
  printf '[network]\ngenerateResolvConf = false\n' | sudo tee -a /etc/wsl.conf > /dev/null
fi
# Genuinely idempotent, not just labeled that way: found 2026-09-11
# re-verifying this exact script end to end (after the #18 set -u fix
# below) - once this step has run once, /etc/resolv.conf is `chattr +i`
# locked (line below), and an unconditional `rm -f` on an immutable file
# fails with "Operation not permitted" even as root - `-f` only suppresses
# "file doesn't exist," not a permission/immutability error - which aborted
# the *entire script* under `set -e` on every re-run from here on. Only
# touch the file (unlock -> rewrite -> relock) when its content doesn't
# already match, so a script whose own header says "Safe to re-run - every
# step is idempotent" actually is, for this step too.
if ! grep -qx 'nameserver 8.8.8.8' /etc/resolv.conf 2>/dev/null; then
  sudo chattr -i /etc/resolv.conf 2>/dev/null || true
  sudo rm -f /etc/resolv.conf
  printf 'nameserver 8.8.8.8\nnameserver 1.1.1.1\n' | sudo tee /etc/resolv.conf > /dev/null
  sudo chattr +i /etc/resolv.conf 2>/dev/null || true
fi
echo "  (if this is the first run, restart WSL now: wsl --terminate <distro>, then re-run this script)"

echo "=== 2/8: apt prerequisites (IPv4 forced - WSL2's IPv6 routing is commonly broken) ==="
printf 'Acquire::ForceIPv4 "true";\n' | sudo tee /etc/apt/apt.conf.d/99force-ipv4 > /dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq curl unzip zip ca-certificates python3-pip python3-venv shellcheck

echo "=== 3/8: Java 21 (Temurin) via SDKMAN ==="
if [ ! -d "$HOME/.sdkman" ]; then
  curl -s "https://get.sdkman.io" | bash
fi
# `set +u`/`set -u` bracket every sdkman-init.sh source in this script
# deliberately: SDKMAN's own script (as installed 2026-09-11) references
# SDKMAN_CANDIDATES_API without ever setting a default, which is fatal
# ("unbound variable") under this script's own `set -euo pipefail`. Hit for
# real on first run - had to be worked around by hand at the time, never
# fixed in the script itself until bin/run.sh hit the identical issue
# later the same session (docs/KNOWN_ISSUES.md Fixed #18) and this got
# fixed too, for consistency. SDKMAN is third-party and out of our
# control; keep `set -u` on for everything else in this script.
set +u
# shellcheck disable=SC1091  # doesn't exist at lint time - SDKMAN installs it a few lines above
source "$HOME/.sdkman/bin/sdkman-init.sh"
set -u
if ! sdk current java 2>/dev/null | grep -q 21.0; then
  echo 'y' | sdk install java 21.0.12-tem
fi
set +u
# shellcheck disable=SC1091  # same as above
source "$HOME/.sdkman/bin/sdkman-init.sh"
set -u
java -version

echo "=== 4/8: Nextflow (pinned) ==="
export NXF_VER=26.04.6
if ! command -v nextflow >/dev/null || ! nextflow -version 2>&1 | grep -q "$NXF_VER"; then
  curl -s https://get.nextflow.io | bash
  chmod +x nextflow
  sudo mv nextflow /usr/local/bin/nextflow
fi
grep -q NXF_VER ~/.bashrc || echo "export NXF_VER=$NXF_VER" >> ~/.bashrc
nextflow -version

echo "=== 5/8: Docker credential-helper fix ==="
# Docker Desktop sometimes writes a Windows-side credential helper
# (desktop.exe) into the WSL distro's config, which can't execute from
# Linux ("exec format error"). Public images need no credentials at all, so
# just clear it and lock the file so Docker Desktop can't rewrite it.
mkdir -p ~/.docker
echo '{}' > ~/.docker/config.json
sudo chattr +i ~/.docker/config.json 2>/dev/null || true
if command -v docker >/dev/null; then
  docker --version
  docker info > /dev/null 2>&1 && echo "  docker daemon reachable" || echo "  WARNING: docker CLI present but daemon unreachable - enable WSL Integration for this distro in Docker Desktop settings"
else
  echo "  WARNING: docker not found - enable WSL Integration for this distro in Docker Desktop settings, then re-run this script"
fi

echo "=== 6/8: Python venv for the Streamlit UI ==="
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [ ! -d .venv-ui ]; then
  python3 -m venv .venv-ui
fi
# shellcheck disable=SC1091  # doesn't exist at lint time - created by python3 -m venv above
source .venv-ui/bin/activate
# requirements-dev.txt pulls in requirements.txt (streamlit) plus pytest/ruff -
# added 2026-09-13 so a fresh machine has the UI's test/lint tooling from the
# start, instead of a maintainer discovering `ui/test_app.py`/ruff exist only
# by reading docs/TESTING.md and installing them by hand, as this session did.
pip install --quiet -r ui/requirements-dev.txt
streamlit --version

echo "=== 7/8: Python venv for the real backend (server/) ==="
# Added 2026-09-14 (PLAN.md §6.12 / full-architecture Phase 1) - the real
# FastAPI backend that will eventually let Composer's own Run button work
# and replace composer-ui's dev-only serve-results-plugin.ts. Same pattern
# as step 6/8's .venv-ui: its own venv, not merged into .venv-ui, since this
# is a genuinely separate app with its own dependency set (FastAPI/uvicorn,
# not Streamlit) that shouldn't need reinstalling/upgrading together.
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [ ! -d .venv-server ]; then
  python3 -m venv .venv-server
fi
# shellcheck disable=SC1091  # doesn't exist at lint time - created by python3 -m venv above
source .venv-server/bin/activate
pip install --quiet -r server/requirements-dev.txt
python -c "import fastapi; print('fastapi', fastapi.__version__)"

echo "=== 8/8: nf-test (pinned) ==="
# Added 2026-09-11 - a real gap, not an oversight to leave alone: nf-test
# has been this project's whole test suite (docs/planning/PLAN.md §6.2
# layer 1, `tests/main.nf.test`) since early in development, extensively
# used throughout this session (22+ test cases), yet was never actually
# added to the one script that's supposed to make a fresh machine fully
# ready - it had only ever been installed by hand. Installed the same way
# as Nextflow above (pinned version, moved to /usr/local/bin, kept out of
# the tracked repo tree - not left sitting in the repo root as a stray
# binary the way an ad hoc install leaves it).
NFT_VER=0.9.5
if ! command -v nf-test >/dev/null || ! nf-test version 2>&1 | grep -q "$NFT_VER"; then
  curl -sL https://code.askimed.com/install/nf-test | bash -s -- "$NFT_VER"
  chmod +x nf-test
  sudo mv nf-test /usr/local/bin/nf-test
fi
nf-test version

echo ""
echo "=== Setup complete ==="
echo "Next: nextflow run main.nf -profile test,docker    (first pipeline smoke test)"
echo "  or: nf-test test --tag basic --profile test,docker  (the automated test suite)"
echo "  or: bin/run-ui.sh                                (launch the UI)"
