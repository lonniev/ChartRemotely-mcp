#!/bin/sh
# ChartRemotely installer — what "Download ChartRemotely Setup" runs.
#
#   curl -fsSL https://chartremotely.tollbooth-dpyc.com/install.sh | sh
#
# It installs the ChartRemotely agent from PyPI and starts its guided setup.
# Nothing here asks for a key; setup does that, interactively, in this window.
set -eu

# 1. The agent drives thinkorswim through macOS Accessibility, so it runs on a Mac.
if [ "$(uname -s)" != "Darwin" ]; then
  echo "ChartRemotely setup runs on the Mac that drives your thinkorswim display." >&2
  exit 1
fi

# 2. uv installs Python tools in their own environments. Install it only if absent,
#    using its official installer.
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# 3. uv places tools in ~/.local/bin; make sure this run can find them.
PATH="$HOME/.local/bin:$PATH"
export PATH

# 4. Install (or upgrade) the agent with its macOS drivers and its setup tools.
uv tool install --upgrade 'chartremotely[macos,setup]'

# 5. Hand over to the guided setup. It reads answers from this terminal.
exec chartremotely setup </dev/tty
