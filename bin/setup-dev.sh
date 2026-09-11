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

echo "=== 1/6: DNS fix (corporate/VPN networks stall apt on PTR lookups) ==="
# WSL2 auto-generates /etc/resolv.conf from the Windows host's DNS, which on
# a corporate network can stall every apt-get update for tens of seconds per
# host. Point at public resolvers instead - confirmed fix, not a guess.
if ! grep -q "generateResolvConf = false" /etc/wsl.conf 2>/dev/null; then
  printf '[network]\ngenerateResolvConf = false\n' | sudo tee -a /etc/wsl.conf > /dev/null
fi
sudo rm -f /etc/resolv.conf
printf 'nameserver 8.8.8.8\nnameserver 1.1.1.1\n' | sudo tee /etc/resolv.conf > /dev/null
sudo chattr +i /etc/resolv.conf 2>/dev/null || true
echo "  (if this is the first run, restart WSL now: wsl --terminate <distro>, then re-run this script)"

echo "=== 2/6: apt prerequisites (IPv4 forced - WSL2's IPv6 routing is commonly broken) ==="
printf 'Acquire::ForceIPv4 "true";\n' | sudo tee /etc/apt/apt.conf.d/99force-ipv4 > /dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq curl unzip zip ca-certificates python3-pip python3-venv

echo "=== 3/6: Java 21 (Temurin) via SDKMAN ==="
if [ ! -d "$HOME/.sdkman" ]; then
  curl -s "https://get.sdkman.io" | bash
fi
source "$HOME/.sdkman/bin/sdkman-init.sh"
if ! sdk current java 2>/dev/null | grep -q 21.0; then
  echo 'y' | sdk install java 21.0.12-tem
fi
source "$HOME/.sdkman/bin/sdkman-init.sh"
java -version

echo "=== 4/6: Nextflow (pinned) ==="
export NXF_VER=26.04.6
if ! command -v nextflow >/dev/null || ! nextflow -version 2>&1 | grep -q "$NXF_VER"; then
  curl -s https://get.nextflow.io | bash
  chmod +x nextflow
  sudo mv nextflow /usr/local/bin/nextflow
fi
grep -q NXF_VER ~/.bashrc || echo "export NXF_VER=$NXF_VER" >> ~/.bashrc
nextflow -version

echo "=== 5/6: Docker credential-helper fix ==="
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

echo "=== 6/6: Python venv for the Streamlit UI ==="
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [ ! -d .venv-ui ]; then
  python3 -m venv .venv-ui
fi
source .venv-ui/bin/activate
pip install --quiet -r ui/requirements.txt
streamlit --version

echo ""
echo "=== Setup complete ==="
echo "Next: nextflow run main.nf -profile test,docker    (first pipeline smoke test)"
echo "  or: bin/run-ui.sh                                (launch the UI)"
